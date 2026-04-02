const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

// Hardcoded installation constants (from v9 SOLAR config, line 1771)
const INSTALL = {
  model: 'NOVA585TG144',
  panelAreaEach: 2.278 * 1.134,  // 2278×1134mm from datasheet
  installDate: new Date(2026, 2, 1),
  yr1Loss: 0.01,
  annualLoss: 0.004,
  tempCoeffPmax: -0.0029,
  noct: 42,
  systemDerate: 0.882,
  monthlyClarity: [0.95, 0.93, 0.90, 0.88, 0.85, 0.80, 0.70, 0.72, 0.78, 0.85, 0.92, 0.95],
};

export class SolarEngine {
  constructor(lat, lon, altitude = 0) {
    this.lat = lat;
    this.lon = lon;
    this.altitude = altitude;
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

    return { elevation, azimuth, zenith };
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

    const panelArea = panelConfig.count * INSTALL.panelAreaEach;
    const watts = poa * 1000 * panelArea * panelConfig.efficiency * degradationFactor * cloudFactor * tempDerate * monthClarity * INSTALL.systemDerate;

    return { watts: Math.max(0, Math.round(watts)), elevation: pos.elevation, azimuth: pos.azimuth, poaKW: poa };
  }

  // Degradation factor (v9 line 1978)
  _degradationFactor(date) {
    const msAge = date - INSTALL.installDate;
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

    return totalWh / 1000; // kWh
  }

  // Degradation info for display (v9 line 1975 / calcSolar)
  getDegradationInfo(date, panelConfig) {
    const msAge = date - INSTALL.installDate;
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
    const installStr = months[INSTALL.installDate.getMonth()] + ' ' + INSTALL.installDate.getFullYear();
    const totalMonths = Math.floor(yearsAge * 12);
    const ageYears = Math.floor(totalMonths / 12);
    const ageMonths = totalMonths % 12;
    const ageStr = ageYears > 0 ? `${ageYears} yr${ageYears !== 1 ? 's' : ''} ${ageMonths} mo` : `${ageMonths} mo`;

    return {
      model: INSTALL.model,
      yr1Loss: INSTALL.yr1Loss,
      annualLoss: INSTALL.annualLoss,
      yearsAge,
      degradationPct: degradation * 100,
      currentMaxW,
      nextYrW,
      totalRatedW,
      installStr,
      ageStr,
      healthPct: (1 - degradation) * 100,
    };
  }
}
