const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

// Installation constants — model, area, installDate are now passed dynamically
const INSTALL = {
  yr1Loss: 0.01,
  annualLoss: 0.004,
  tempCoeffPmax: -0.0029,
  noct: 42,
  systemDerate: 0.882,
  monthlyClarity: [0.95, 0.93, 0.90, 0.88, 0.85, 0.80, 0.70, 0.72, 0.78, 0.85, 0.92, 0.95],
};

export function cloudTransmission(cloudPct) {
  const bands = [
    [0,  10,  0.95, 1.0 ],
    [10, 50,  0.75, 0.95],
    [50, 70,  0.40, 0.75],
    [70, 90,  0.20, 0.40],
    [90, 100, 0.10, 0.25],
  ];
  const c = Math.max(0, Math.min(100, cloudPct));
  for (const [lo, hi, tLo, tHi] of bands) {
    if (c <= hi) {
      const frac = (c - lo) / (hi - lo);
      return tHi - frac * (tHi - tLo);
    }
  }
  return 0.10;
}

export class SolarEngine {
  constructor(lat, lon, altitude = 0, installDate = new Date(2026, 2, 1)) {
    this.lat = lat;
    this.lon = lon;
    this.altitude = altitude;
    this.installDate = installDate;
    this._posCache = null;
    this._forecastCache = null;
  }

  // --- Solar Position (NOAA/Meeus) ---
  // Port from v9 lines 1787-1867

  _julianCentury(date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    return (JD - 2451545.0) / 36525;
  }

  // v9 line 1798: solarDeclination
  // NOTE: omega is converted to radians before use; e0 uses division form matching v9 line 1809
  _solarDeclination(T) {
    const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const Mr = toRad(M);
    const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
            + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T)
            + Math.sin(3 * Mr) * 0.000289;
    const sunLon = L0 + C;
    const omega = toRad(125.04 - 1934.136 * T);  // v9: toRad applied here
    const lambda = toRad(sunLon - 0.00569 - 0.00478 * Math.sin(omega));
    // v9 line 1809: e0 formula uses division form, not nested parentheses
    const e0 = 23 + (26 + 21.448 / 60) / 60 - T * (46.815 + T * (0.00059 - T * 0.001813)) / 3600;
    const eps = toRad(e0 + 0.00256 * Math.cos(omega));
    return toDeg(Math.asin(Math.sin(eps) * Math.sin(lambda)));
  }

  // v9 line 1814: equationOfTime
  // NOTE: L0 and M are converted to radians up front; y = tan(eps/2)^2 where eps is already radians
  _equationOfTime(T) {
    const L0 = toRad((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360);
    const M = toRad(357.52911 + T * (35999.05029 - 0.0001537 * T));
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const omega = toRad(125.04 - 1934.136 * T);
    const e0 = 23 + (26 + 21.448 / 60) / 60 - T * (46.815 + T * (0.00059 - T * 0.001813)) / 3600;
    const eps = toRad(e0 + 0.00256 * Math.cos(omega));
    const y = Math.tan(eps / 2) ** 2;  // eps is already radians; divide by 2 then tan
    return 4 * toDeg(
      y * Math.sin(2 * L0)
      - 2 * e * Math.sin(M)
      + 4 * e * y * Math.sin(M) * Math.cos(2 * L0)
      - 0.5 * y * y * Math.sin(4 * L0)
      - 1.25 * e * e * Math.sin(2 * M)
    ); // result in minutes
  }

  // v9 line 1831: solarPosition
  // NOTE: azimuth uses sinZen (sin of zenith) in denominator, not cos(elevation)
  getPosition(date) {
    const minuteKey = Math.floor(date.getTime() / 60000);
    if (this._posCache && this._posCache.key === minuteKey) return this._posCache.val;
    const T = this._julianCentury(date);
    const decl = this._solarDeclination(T);
    const eot = this._equationOfTime(T);
    const timezone = date.getTimezoneOffset() / -60;
    const offset = eot + 4 * this.lon - 60 * timezone;
    const tst = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + offset;
    const ha = tst / 4 - 180;

    const latR = toRad(this.lat), declR = toRad(decl), haR = toRad(ha);
    const cosZen = Math.sin(latR) * Math.sin(declR) + Math.cos(latR) * Math.cos(declR) * Math.cos(haR);
    const zenith = toDeg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
    let elevation = 90 - zenith;

    // Atmospheric refraction correction (v9 line 1845)
    if (elevation > 85) { /* no correction */ }
    else if (elevation > 5) {
      const tanE = Math.tan(toRad(elevation));
      elevation += (58.1 / tanE - 0.07 / (tanE ** 3) + 0.000086 / (tanE ** 5)) / 3600;
    } else if (elevation > -0.575) {
      elevation += (1735 - 518.2 * elevation + 103.4 * elevation ** 2 - 12.79 * elevation ** 3 + 0.711 * elevation ** 4) / 3600;
    } else {
      elevation += (-20.774 / Math.tan(toRad(elevation))) / 3600;
    }

    // Azimuth (v9 line 1856): uses sinZen in denominator
    const sinZen = Math.sin(toRad(zenith));
    let azimuth;
    if (sinZen === 0) {
      azimuth = 180;
    } else {
      const cosAz = (Math.sin(latR) * cosZen - Math.sin(declR)) / (Math.cos(latR) * sinZen);
      azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
      if (ha > 0) azimuth = 360 - azimuth;
    }

    const result = { elevation, azimuth, zenith };
    this._posCache = { key: minuteKey, val: result };
    return result;
  }

  // Moon position — Meeus Ch.47 simplified (main perturbation terms only)
  // Returns { elevation, azimuth } in degrees; elevation < 0 means below horizon.
  getMoonPosition(date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    const T  = (JD - 2451545.0) / 36525;

    // Fundamental arguments
    const L0 = (218.3164477 + 481267.88123421 * T) % 360;
    const M  = toRad((134.9633964 + 477198.8675055 * T) % 360);
    const Ms = toRad((357.5291092 +  35999.0502909 * T) % 360);
    const F  = toRad(( 93.2720950 + 483202.0175233 * T) % 360);
    const D  = toRad((297.8501921 + 445267.1114034 * T) % 360);

    // Longitude perturbations (units: 1e-6 degrees)
    const dL = 6288774 * Math.sin(M)
      + 1274027 * Math.sin(2*D - M)
      +  658314 * Math.sin(2*D)
      +  213618 * Math.sin(2*M)
      -  185116 * Math.sin(Ms)
      -  114332 * Math.sin(2*F)
      +   58793 * Math.sin(2*D - 2*M)
      +   57066 * Math.sin(2*D - Ms - M)
      +   53322 * Math.sin(2*D + M)
      +   45758 * Math.sin(2*D - Ms);

    // Latitude perturbations (units: 1e-6 degrees)
    const dB = 5128122 * Math.sin(F)
      +  280602 * Math.sin(M + F)
      +  277693 * Math.sin(M - F)
      +  173237 * Math.sin(2*D - F)
      +   55413 * Math.sin(2*D - M + F)
      +   46271 * Math.sin(2*D - M - F)
      +   32573 * Math.sin(2*D + F);

    // Ecliptic coordinates
    const lambda = toRad(L0 + dL / 1000000);
    const beta   = toRad(dB / 1000000);

    // Obliquity of ecliptic
    const eps = toRad(23.439291 - 0.013004 * T);

    // Ecliptic → equatorial (RA, Dec)
    const RA  = Math.atan2(
      Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
      Math.cos(lambda)
    );
    const Dec = Math.asin(
      Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda)
    );

    // Greenwich Mean Sidereal Time → Local Hour Angle
    const GST = toRad((280.46061837 + 360.98564736629 * (JD - 2451545.0)) % 360);
    const HA  = GST + toRad(this.lon) - RA;

    // Equatorial → horizontal
    const latR   = toRad(this.lat);
    const sinAlt = Math.sin(Dec) * Math.sin(latR) + Math.cos(Dec) * Math.cos(latR) * Math.cos(HA);
    const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));

    const cosAz = (Math.sin(Dec) - sinAlt * Math.sin(latR))
      / (Math.cos(toRad(elevation)) * Math.cos(latR));
    let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
    if (Math.sin(HA) > 0) azimuth = 360 - azimuth;

    return { elevation, azimuth };
  }

  getPlanetPositions(date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    const d  = JD - 2451543.5; // days since J2000.0 (Schlyter epoch)

    // Obliquity of ecliptic (degrees → radians)
    const eps = toRad(23.4393 - 3.563e-7 * d);

    // Orbital elements helper — returns { N, i, w, a, e, M } all in radians
    // Schlyter Table: N=asc.node, i=inclination, w=arg.perihelion, a=semi-major axis (AU), e=eccentricity, M=mean anomaly
    const el = (N0, Nr, i0, ir, w0, wr, a, e0, er, M0, Mr) => ({
      N: toRad(N0 + Nr * d),
      i: toRad(i0 + ir * d),
      w: toRad(w0 + wr * d),
      a,
      e: e0 + er * d,
      M: toRad(((M0 + Mr * d) % 360 + 360) % 360),
    });

    // Earth (used to compute geocentric positions)
    const earth = el(0, 0, 0, 0, 282.9404, 4.70935e-5, 1.000000, 0.016709, -1.151e-9, 356.0470, 0.9856002585);

    // Visible planets
    const PLANET_DEFS = [
      { name: 'Venus',   color: [255, 252, 220], radius: 3.5,
        ...el(76.6799, 2.46590e-5, 3.3946,  2.75e-8,   54.8910,  1.38374e-5, 0.723330, 0.006773, -1.302e-9,  48.0052, 1.6021302244) },
      { name: 'Mars',    color: [255, 110, 55],  radius: 2.5,
        ...el(49.5574, 2.11081e-5, 1.8497, -1.78e-8,  286.5016,  2.92961e-5, 1.523688, 0.093405,  2.516e-9,  18.6021, 0.5240207766) },
      { name: 'Jupiter', color: [255, 220, 175], radius: 3.0,
        ...el(100.4542,2.76854e-5, 1.3030, -1.557e-7, 273.8777,  1.64505e-5, 5.202560, 0.048498,  4.469e-9,  19.8950, 0.0830853001) },
      { name: 'Saturn',  color: [255, 240, 185], radius: 2.5,
        ...el(113.6634,2.38980e-5, 2.4886, -1.081e-7, 339.3939,  2.97661e-5, 9.554750, 0.055546, -9.499e-9, 316.9670, 0.0334442282) },
    ];

    // Solve Kepler's equation: E = M + e·sin(E), iterate until convergence
    const kepler = (M, e) => {
      let E = M;
      for (let i = 0; i < 12; i++) {
        const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-9) break;
      }
      return E;
    };

    // Heliocentric ecliptic XYZ (AU)
    const helio = ({ N, i, w, a, e, M }) => {
      const E  = kepler(M, e);
      const xv = a * (Math.cos(E) - e);
      const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const v  = Math.atan2(yv, xv);
      const r  = Math.sqrt(xv * xv + yv * yv);
      const lon = v + w; // argument of latitude = true anomaly + arg of perihelion
      return {
        x: r * (Math.cos(N) * Math.cos(lon) - Math.sin(N) * Math.sin(lon) * Math.cos(i)),
        y: r * (Math.sin(N) * Math.cos(lon) + Math.cos(N) * Math.sin(lon) * Math.cos(i)),
        z: r * Math.sin(lon) * Math.sin(i),
      };
    };

    // Greenwich Sidereal Time
    const GST  = toRad(((280.46061837 + 360.98564736629 * (JD - 2451545.0)) % 360 + 360) % 360);
    const latR = toRad(this.lat);
    const lonR = toRad(this.lon);

    const earthXYZ = helio(earth);

    return PLANET_DEFS.map(p => {
      const ph = helio(p);
      // Geocentric ecliptic
      const gx = ph.x - earthXYZ.x;
      const gy = ph.y - earthXYZ.y;
      const gz = ph.z - earthXYZ.z;
      // Ecliptic → equatorial
      const x2 = gx;
      const y2 = gy * Math.cos(eps) - gz * Math.sin(eps);
      const z2 = gy * Math.sin(eps) + gz * Math.cos(eps);
      const RA  = Math.atan2(y2, x2);
      const Dec = Math.atan2(z2, Math.sqrt(x2 * x2 + y2 * y2));
      // Local Hour Angle
      const HA = GST + lonR - RA;
      // Equatorial → horizontal
      const sinAlt = Math.sin(Dec) * Math.sin(latR) + Math.cos(Dec) * Math.cos(latR) * Math.cos(HA);
      const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
      const cosAz = (Math.sin(Dec) - sinAlt * Math.sin(latR))
        / (Math.cos(toRad(elevation)) * Math.cos(latR));
      let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
      if (Math.sin(HA) > 0) azimuth = 360 - azimuth;
      return { name: p.name, elevation, azimuth, color: p.color, radius: p.radius };
    });
  }

  getGalacticCenterPos(date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    const GST  = toRad(((280.46061837 + 360.98564736629 * (JD - 2451545.0)) % 360 + 360) % 360);
    const RA   = toRad(266.417);
    const Dec  = toRad(-29.008);
    const latR = toRad(this.lat);
    const HA   = GST + toRad(this.lon) - RA;
    const sinAlt = Math.sin(Dec) * Math.sin(latR) + Math.cos(Dec) * Math.cos(latR) * Math.cos(HA);
    const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
    const cosAz = (Math.sin(Dec) - sinAlt * Math.sin(latR))
      / (Math.cos(toRad(elevation)) * Math.cos(latR));
    let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
    if (Math.sin(HA) > 0) azimuth = 360 - azimuth;
    return { elevation, azimuth };
  }

  // Air mass — Kasten-Young 1989 (v9 line 1870)
  _airMass(zenithDeg) {
    if (zenithDeg >= 90) return Infinity;
    const z = toRad(zenithDeg);
    return 1 / (Math.cos(z) + 0.50572 * Math.pow(96.07995 - zenithDeg, -1.6364));
  }

  // Clear-sky irradiance with altitude correction (v9 line 1876)
  // Returns { direct, global } in kW/m²
  _clearSkyIrradiance(am, altitudeKm) {
    if (!isFinite(am) || am <= 0) return { direct: 0, global: 0 };
    const h = altitudeKm || 0;
    const ID = 1.353 * ((1 - 0.14 * h) * Math.pow(0.7, Math.pow(am, 0.678)) + 0.14 * h);
    return { direct: ID, global: 1.1 * ID }; // kW/m²
  }

  // Angle of incidence (v9 line 1883)
  _angleOfIncidence(zenithDeg, azimuthDeg, tiltDeg, panelAzDeg) {
    const zR = toRad(zenithDeg), tR = toRad(tiltDeg);
    const cosAOI = Math.cos(zR) * Math.cos(tR) + Math.sin(zR) * Math.sin(tR) * Math.cos(toRad(azimuthDeg - panelAzDeg));
    return toDeg(Math.acos(Math.max(-1, Math.min(1, cosAOI))));
  }

  // Temperature derating (v9 line 1890) — null guard for missing weather data
  _tempDerate(poaKW, ambientC) {
    if (ambientC == null) return 1;
    const G = poaKW * 1000; // W/m²
    const Tcell = ambientC + (INSTALL.noct - 20) * (G / 800);
    return 1 + INSTALL.tempCoeffPmax * (Tcell - 25);
  }

  // Cloud transmission model — 5-band linear interpolation (v9 line 774)
  _cloudTransmission(cloudPct) {
    return cloudTransmission(cloudPct);
  }

  // panelConfig: { count, efficiency, tilt, azimuth, ratedWatts } from HABridge helpers
  // v9 line 1897: calcSolarOutput — uses irr.global for POA
  calcSolarOutput(date, panelConfig, cloudCoverPct = 0, ambientC = null) {
    const pos = this.getPosition(date);
    if (pos.elevation <= 0) return { watts: 0, elevation: pos.elevation, azimuth: pos.azimuth };

    const am = this._airMass(pos.zenith);
    const altKm = this.altitude / 1000; // hass.config.elevation is in meters
    const irr = this._clearSkyIrradiance(am, altKm);
    const aoi = this._angleOfIncidence(pos.zenith, pos.azimuth, panelConfig.tilt, panelConfig.azimuth);

    let poa = 0;
    if (aoi < 90) {
      poa = irr.global * Math.cos(toRad(aoi)); // kW/m² — uses global (includes diffuse)
    }

    const cloudFactor = this._cloudTransmission(cloudCoverPct);
    const monthClarity = INSTALL.monthlyClarity[date.getMonth()];
    const tempDerate = this._tempDerate(poa * cloudFactor, ambientC);
    const degradationFactor = this._degradationFactor(date);

    const panelArea = panelConfig.count * panelConfig.areaEach;
    const watts = poa * 1000 * panelArea * panelConfig.efficiency * degradationFactor * cloudFactor * tempDerate * monthClarity * INSTALL.systemDerate;

    return { watts: Math.max(0, Math.round(watts)), elevation: pos.elevation, azimuth: pos.azimuth, poaKW: poa };
  }

  // Degradation factor (v9 line 1978)
  _degradationFactor(date) {
    const msAge = date - this.installDate;
    if (msAge <= 0) return 1;
    const yearsAge = msAge / (365.25 * 24 * 3600000);
    let degradation;
    if (yearsAge <= 1) degradation = INSTALL.yr1Loss * yearsAge;
    else degradation = INSTALL.yr1Loss + INSTALL.annualLoss * (yearsAge - 1);
    return Math.max(0.2, 1 - degradation);
  }

  // Daily kWh forecast (v9 line 1923)
  // NOTE: v9 iterates from actual sunrise to sunset (minute-by-minute scan), then 15-min intervals
  calcDailyForecast(date, panelConfig, cloudCoverPct = 0, ambientC = null) {
    const dayKey = date.toISOString().slice(0, 10);
    const cacheKey = `${dayKey}_${cloudCoverPct ?? 0}_${ambientC ?? 'null'}`;
    if (this._forecastCache && this._forecastCache.key === cacheKey) return this._forecastCache.val;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    let totalWh = 0;

    // Find sunrise and sunset by scanning every minute
    let sunriseMin = null, sunsetMin = null;
    for (let m = 0; m < 1440; m++) {
      const t = new Date(dayStart.getTime() + m * 60000);
      const pos = this.getPosition(t);
      if (pos.elevation > 0 && sunriseMin === null) sunriseMin = m;
      if (pos.elevation <= 0 && sunriseMin !== null && sunsetMin === null) sunsetMin = m;
    }
    if (sunriseMin === null) return 0;
    if (sunsetMin === null) sunsetMin = 1440;

    // Integrate in 15-minute intervals between sunrise and sunset
    for (let m = sunriseMin; m < sunsetMin; m += 15) {
      const t = new Date(dayStart.getTime() + m * 60000);
      const { watts } = this.calcSolarOutput(t, panelConfig, cloudCoverPct, ambientC);
      totalWh += watts * 0.25; // 15-minute interval = 0.25 h
    }

    const result = totalWh / 1000; // kWh
    this._forecastCache = { key: dayKey, val: result };
    return result;
  }

  // Degradation info for display (v9 line 1975 / calcSolar)
  getDegradationInfo(date, panelConfig) {
    const msAge = date - this.installDate;
    const yearsAge = Math.max(0, msAge / (365.25 * 24 * 3600000));
    const totalRatedW = panelConfig.count * panelConfig.ratedWatts;
    let degradation;
    if (yearsAge <= 1) degradation = INSTALL.yr1Loss * yearsAge;
    else degradation = INSTALL.yr1Loss + INSTALL.annualLoss * (yearsAge - 1);
    degradation = Math.min(degradation, 0.80);
    const currentMaxW = Math.round(totalRatedW * (1 - degradation));
    const nextYrDeg = Math.min(degradation + INSTALL.annualLoss, 0.80);
    const nextYrW = Math.round(totalRatedW * (1 - nextYrDeg));
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const installStr = months[this.installDate.getMonth()] + ' ' + this.installDate.getFullYear();
    const totalMonths = Math.floor(yearsAge * 12);
    const ageYears = Math.floor(totalMonths / 12);
    const ageMonths = totalMonths % 12;
    const ageStr = ageYears > 0 ? `${ageYears} yr${ageYears !== 1 ? 's' : ''} ${ageMonths} mo` : `${ageMonths} mo`;

    return {
      model: panelConfig.model ?? 'Unknown',
      type: panelConfig.type ?? 'Unknown',
      installStr,
      yr1Loss: INSTALL.yr1Loss,
      annualLoss: INSTALL.annualLoss,
      yearsAge,
      degradationPct: degradation * 100,
      currentMaxW,
      nextYrW,
      totalRatedW,
      ageStr,
      healthPct: (1 - degradation) * 100,
    };
  }
}
