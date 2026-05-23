// weather-fx.js — Weather particle system
// Ported from solar-v9.html lines 792-1230
import { snFBM } from './noise.js';

const CONDITION_PARTICLE_MAP = {
  'sunny': 'sunny', 'clear-night': 'night',
  'partlycloudy': 'cloudy', 'cloudy': 'cloudy',
  'rainy': 'rainy', 'pouring': 'pouring',
  'snowy': 'snowy', 'hail': 'snowy',
  'fog': 'fog',
  'lightning': 'storm', 'lightning-rainy': 'storm',
  'windy': 'cloudy', 'windy-variant': 'cloudy',
  'exceptional': 'cloudy', 'snowy-rainy': 'sleet',
};

const RAIN_SEVERITY = {
  rainy: 0.55,
  pouring: 1.0,
  storm: 0.80,
  sleet: 0.45,
};

const RAIN_LAYERS = {
  far:  { depth: 0.4, windMult: 0.5,  speedMult: 0.5,  alphaMult: 0.5  },
  mid:  { depth: 0.7, windMult: 0.75, speedMult: 0.75, alphaMult: 0.75 },
  near: { depth: 1.0, windMult: 1.0,  speedMult: 1.0,  alphaMult: 1.0  },
};

const LIGHTNING_STROKE_PAUSES = [
  { alpha: 1.0, decay: 8, pauseMin: 80,  pauseMax: 150 },
  { alpha: 0.7, decay: 8, pauseMin: 50,  pauseMax: 100 },
  { alpha: 0.4, decay: 8, pauseMin: 0,   pauseMax: 0   },
];

// How much the sun disc is visible through each condition (0=hidden, 1=full)
// < 0.3 → diffuse glow only; >= 0.3 → disc + glow
const SUN_CLOUD_DIM = {
  'sunny': 1.0,
  'windy': 0.85, 'windy-variant': 0.80,
  'partlycloudy': 0.55,
  'exceptional': 0.20,
  'cloudy': 0.18,
  'fog': 0.20,
  'snowy': 0.18,
  'hail': 0.10,
  'snowy-rainy': 0.10,
  'rainy': 0.08,
  'pouring': 0.04,
  'lightning': 0.0,
  'lightning-rainy': 0.0,
};

// How much the moon disc is visible through each condition (0=hidden, 1=full)
// < 0.35 → diffuse glow only (disc edge not drawn); >= 0.35 → disc + glow
const MOON_CLOUD_DIM = {
  'clear-night': 1.0,
  'windy': 0.85, 'windy-variant': 0.80,
  'partlycloudy': 0.55,
  'exceptional': 0.30,
  'cloudy': 0.15,
  'fog': 0.15,
  'snowy': 0.20,
  'hail': 0.08,
  'snowy-rainy': 0.08,
  'rainy': 0.05,
  'pouring': 0.03,
  'lightning': 0.0,
  'lightning-rainy': 0.0,
};

function lerp(a, b, t) { return a + (b - a) * t; }

function intensityToSpawnCount(layerKey, intensity) {
  const baseByDepth = { far: 0.3, mid: 0.45, near: 0.25 };
  const total = 15 + Math.pow(intensity, 0.65) * 40;
  return Math.round(total * baseByDepth[layerKey]);
}

function computeTwilightTarget(sunElevation) {
  if (sunElevation > 0)   return 0.0;
  if (sunElevation > -6)  return 0.25;
  if (sunElevation > -12) return 0.50;
  if (sunElevation > -18) return 0.75;
  return 1.0;
}

export class WeatherFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._theme = 'dark';
    this._isNight = false;
    this._particles = [];
    this._animFrameId = null;
    this._currentType = null;
    this._alpha = 1;
    this._fading = false;
    this._nextType = null;
    this._lastFrame = 0;
    // C5: Canvas context loss handling
    this._contextLost = false;
    this._contextLostHandler = () => {
      this._contextLost = true;
      if (this._animFrameId) {
        cancelAnimationFrame(this._animFrameId);
        this._animFrameId = null;
      }
    };
    this._contextRestoredHandler = () => {
      this._contextLost = false;
      this.ctx = this.canvas.getContext('2d');
      // Restart particle system with last known state
      if (this._currentType) {
        this._particles = this._createParticles(this._currentType, this.canvas);
        this._particlesByType = this._bucketize(this._particles);
        this._startRenderLoop();
      }
    };
    canvas.addEventListener('webglcontextlost', this._contextLostHandler);
    canvas.addEventListener('contextlost', this._contextLostHandler);
    canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler);
    canvas.addEventListener('contextrestored', this._contextRestoredHandler);
    // Ambient overlay — stars/aurora at night, sun rays/glow by day
    this._overlayParticles = [];
    this._overlayType = null;
    this._overlayTypeCur = null;  // what's currently rendering (for cross-fade)
    this._overlayTypePrev = null; // previous overlay type during cross-fade
    this._overlayParticlesPrev = [];
    this._overlayAlphaPrevCur = 0;
    this._overlayAlpha = 0;
    this._fadeGen = 0;
    this._windSpeed = 0;         // km/h
    this._windBearing = 180;     // meteorological: direction wind comes FROM (0=N,90=E,180=S,270=W)
    this._windFactor = 0;        // cached: 0→1 at Beaufort 7
    this._windDx = 0;            // cached: downwind X component (+1=right)
    this._windDy = 0;            // cached: downwind Y component (+1=down, spawn convention)
    this._windDyRender = 0;      // cached: downwind Y component for render loop (+1=down, canvas convention)
    this._weatherCondition = null;
    this._moonBrightness = 0;    // 0=new moon, 1=full moon
    this._moonElevation = -90;
    this._moonAzimuth = 180;
    this._sunElevation = -90;
    this._sunAzimuth = 180;
    this._sunElevCur  = -90;
    this._sunAzCur    = 180;
    this._moonElevCur = -90;
    this._moonAzCur   = 180;
    this._posInitialized = false;
    this._cloudCovCur  = null;
    this._moonBrightCur = 0;
    this._overlayAlphaCur = 0;
    this._haloStrengthCur = 0;
    this._cloudCoverage = null;
    this._visibility = null;        // km, null = unknown
    this._uvIdx = null;
    this._humidity = null;
    this._temperature = null;
    this._precipProbability = null;
    this._windGustSpeed = 0;
    this._dewPoint = null;
    this._pressure = null;
    this._particlesByType = {};        // keyed by particle.kind
    this._overlayParticlesByType = {}; // same for overlay particles
    this._flashAlpha = 0;              // reserved for Task 7
    this._flashDecay = 0;
    this._boltCache = null;
    this._rainbowFade = 0;             // reserved for Task 9
    this._rainLayerAlpha = { far: 0, mid: 0, near: 0 };
    this._sheetLightningAlpha = 0;     // T2.4: distant-storm sheet lightning
    this._activeDendrites = 0;         // T2.5: cap concurrent dendrite snowflakes
    this._planets = [];           // [{name, elevation, azimuth, color:[r,g,b], radius}]
    this._galCenterEl = -90;
    this._galCenterAz = 180;
    this._issPos = null;          // {elevation, azimuth} when visible, else null
    this._issElevCur = -90;
    this._issAzCur   = 180;
    this._milkyWayAlpha = 0;      // lerped opacity for Milky Way
    this._twilightFactor = 0;
    this._starField = [];
    this._updateWindCache();
  }

  /** Recompute cached wind derived values after _windSpeed or _windBearing change. */
  _updateWindCache() {
    this._windFactor = Math.max(0, Math.min((this._windSpeed || 0) / 54, 1.0));
    const bearing = Number.isFinite(this._windBearing) ? this._windBearing : 180;
    const downwindRad = ((bearing + 180) % 360) * Math.PI / 180;
    this._windDx       =  Math.sin(downwindRad); // +1 = right
    this._windDy       =  Math.cos(downwindRad); // +1 = down (spawn convention, Y increases down)
    this._windDyRender = -Math.cos(downwindRad); // +1 = down (render convention, negated for canvas)
  }

  /**
   * Start weather particle effects for a given HA weather condition.
   * @param {string} weatherCondition - HA condition string (e.g. 'sunny', 'rainy')
   * @param {boolean} isNight - whether it is currently nighttime
   * @param {string} theme - 'dark' or 'light' (affects particle colors)
   */
  _initStarField() {
    this._starField = [];
    const W = this.canvas.width, H = this.canvas.height;
    for (let i = 0; i < 250; i++) {
      const mag = Math.pow(Math.random(), 0.5) * 6;
      const baseBrightness = Math.pow(2.512, -mag);
      const r = mag < 2 ? 1.2 + Math.random() * 1.3 :
                mag < 3 ? 0.8 + Math.random() * 0.4 :
                          0.2 + Math.random() * 0.4;
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      this._starField.push({
        x: sx,
        y: sy,
        r, mag, baseBrightness,
        horizonProximity: sy / H,
        twinkleSpeed: 0.2 + Math.random() * 0.8,
        twinklePhase: Math.random() * Math.PI * 2,
        colorTemp: mag < 2 ? 'blue' : mag < 4 ? 'white' : 'warm',
      });
    }
  }

  _renderStarField(ctx, now, twilightStarAlpha) {
    if (!this._starField || !this._starField.length) return;
    const cloudDim = this._calcCloudDim(this._cloudCovCur ?? 0, this._weatherCondition ?? '');
    const moonWash = (this._moonBrightCur ?? 0) * 0.65;
    const baseAlpha = twilightStarAlpha * cloudDim * (1 - moonWash);
    if (baseAlpha <= 0.01) return;

    const rgbMap = { blue: '180,200,255', white: '255,255,255', warm: '255,230,180' };

    for (const s of this._starField) {
      const horizBoost = 1 + 2 * s.horizonProximity;
      const twinkle = s.baseBrightness * (0.7 + 0.3 * Math.sin(now * s.twinkleSpeed * 0.001 + s.twinklePhase) * horizBoost);
      const alpha = Math.min(baseAlpha * twinkle, 1);
      if (alpha <= 0.01) continue;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgbMap[s.colorTemp]},${alpha.toFixed(3)})`;
      ctx.fill();
    }

    // Diffraction spikes for bright stars (mag < 2.5) — only when stars are bright enough
    if (baseAlpha > 0.3) {
      for (const s of this._starField) {
        if (s.mag >= 2.5) continue;
        const a = baseAlpha * s.baseBrightness * 0.6;
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = `rgba(200,220,255,${(a * 0.4).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y);
        ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4);
        ctx.stroke();
        ctx.strokeStyle = `rgba(220,230,255,${(a * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(s.x - s.r * 2, s.y); ctx.lineTo(s.x + s.r * 2, s.y);
        ctx.moveTo(s.x, s.y - s.r * 2); ctx.lineTo(s.x, s.y + s.r * 2);
        ctx.stroke();
      }
    }
  }

  _renderGoldenHourOverlay(ctx, sunElevation) {
    const ghFactor = Math.cos((sunElevation / 15) * Math.PI / 2);
    const cloudDim = this._calcCloudDim(this._cloudCovCur ?? 0, this._weatherCondition ?? '');
    const alpha = ghFactor * cloudDim * 0.06;
    if (alpha < 0.005) return;
    ctx.fillStyle = `rgba(255, 140, 40, ${alpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Pre-render a cloud particle to an off-screen canvas and store it on p.
  // Called once at spawn so the render loop can just blit p.off each frame.
  _renderCloudToOffscreen(p, isNight) {
    const cloudR = p.r;
    const DEG = Math.PI / 180;

    // Use fixed origin with morph headroom if available, otherwise compute from current lobes
    let ox, oy, offW, offH;
    if (p._fixedOx != null && p._fixedOy != null) {
      // Compute canvas size from fixed origin + worst-case lobe extent
      let maxX = -Infinity, maxY = -Infinity;
      let minX = Infinity, minY = Infinity;
      for (const lobe of p.lobes) {
        const lx = lobe.dx * cloudR, ly = lobe.dy * cloudR, lr = (lobe.rs + 0.03) * cloudR;
        if (lx - lr < minX) minX = lx - lr;
        if (lx + lr > maxX) maxX = lx + lr;
        if (ly - lr < minY) minY = ly - lr;
        if (ly + lr > maxY) maxY = ly + lr;
      }
      const pad = cloudR * 0.4;
      offW = Math.ceil(maxX - minX + pad * 2 + cloudR * 0.12);
      offH = Math.ceil(maxY - minY + pad * 2 + cloudR * 0.08);
      ox = p._fixedOx;
      oy = p._fixedOy;
    } else {
      // Fallback: compute tight bounds from actual lobe positions
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const lobe of p.lobes) {
        const lx = lobe.dx * cloudR, ly = lobe.dy * cloudR, lr = lobe.rs * cloudR;
        if (lx - lr < minX) minX = lx - lr;
        if (lx + lr > maxX) maxX = lx + lr;
        if (ly - lr < minY) minY = ly - lr;
        if (ly + lr > maxY) maxY = ly + lr;
      }
      const pad = cloudR * 0.4;
      offW = Math.ceil(maxX - minX + pad * 2);
      offH = Math.ceil(maxY - minY + pad * 2);
      ox = -minX + pad;
      oy = -minY + pad;
    }

    // C6: Per-cloud offscreen canvas — eliminates pool collision where same-dimension clouds share lobe shapes
    if (!p.off || p.off.width !== Math.max(offW, 1) || p.off.height !== Math.max(offH, 1)) {
      const el = document.createElement('canvas');
      el.width = Math.max(offW, 1); el.height = Math.max(offH, 1);
      p.off = el;
    }
    const off = p.off;
    const octx = off.getContext('2d');
    octx.clearRect(0, 0, off.width, off.height);

    // T2.3 item 9: composite mode per archetype
    octx.globalCompositeOperation = 'source-over';

    // T2.3 item 7: atmospheric perspective for far-layer clouds when visibility < 10 km
    const isFar = p.layer === 0;
    const lowVis = (this._visibility != null && this._visibility < 10);

    // T2.3 item 6: precipProbability-driven underside colour
    // 0% → hsl(0,0%,90%) = rgb(230,230,230); 90% → hsl(220,20%,35%) = ~rgb(71,88,107)
    const precip = Math.min(1, (this._precipProbability ?? 0) / 90);
    const undersideR = Math.round(230 - precip * 159); // 230→71
    const undersideG = Math.round(230 - precip * 142); // 230→88
    const undersideB = Math.round(230 - precip * 123); // 230→107

    // T2.3 item 8: directional lighting from sun azimuth
    const sunAz = this._sunAzimuth;
    const hasSunDir = sunAz != null && Number.isFinite(sunAz);
    const sunDirX = hasSunDir ? Math.sin(sunAz * DEG) : 0;
    const sunDirY = hasSunDir ? -Math.cos(sunAz * DEG) : 0;

    // --- Phase 1: compute gradient extents from lobe positions ---
    let gradTop = Infinity, gradBot = -Infinity;
    for (const lobe of p.lobes) {
      const ly = oy + lobe.dy * cloudR;
      const lr = lobe.rs * cloudR;
      if (ly - lr < gradTop) gradTop = ly - lr;
      if (ly + lr > gradBot) gradBot = ly + lr;
    }
    gradTop = Math.max(0, gradTop);
    gradBot = Math.min(off.height, Math.max(gradTop + 1, gradBot));

    // --- Phase 2: fill gradient over full canvas ---
    const grd = octx.createLinearGradient(0, gradTop, 0, gradBot);
    if (isNight) {
      grd.addColorStop(0,    'rgba(95, 115, 160, 0.92)');
      grd.addColorStop(0.45, 'rgba(58,  70, 108, 0.87)');
      grd.addColorStop(1,    'rgba(28,  35,  68, 0.80)');
    } else {
      const sunBiasR = hasSunDir ? 12 : 0;
      const sunBiasG = hasSunDir ? 6  : 0;
      const hi = 245, mid = 210;
      grd.addColorStop(0,    'rgba(255, 255, 255, 0.97)');
      grd.addColorStop(0.30, `rgba(${Math.min(255, hi + sunBiasR)}, ${Math.min(255, hi + sunBiasG)}, ${hi}, 0.92)`);
      grd.addColorStop(0.65, `rgba(${Math.min(255, mid + sunBiasR)}, ${Math.min(255, mid + sunBiasG + 4)}, ${mid + 10}, 0.87)`);
      grd.addColorStop(1,    `rgba(${undersideR}, ${undersideG}, ${undersideB}, 0.82)`);
    }
    octx.fillStyle = grd;
    octx.fillRect(0, 0, off.width, off.height);

    // Directional sun overlay (additive warmth from sun side)
    if (!isNight && hasSunDir) {
      const lightX = ox + sunDirX * cloudR * 1.8;
      const lightY = oy + sunDirY * cloudR * 1.8;
      const lgrd = octx.createRadialGradient(lightX, lightY, 0, lightX, lightY, cloudR * 2.2);
      lgrd.addColorStop(0, 'rgba(255, 248, 220, 0.14)');
      lgrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = lgrd;
      octx.fillRect(0, 0, off.width, off.height);
    }

    // Atmospheric perspective on far-layer clouds
    if (isFar && lowVis) {
      octx.fillStyle = 'rgba(160, 185, 220, 0.12)';
      octx.fillRect(0, 0, off.width, off.height);
    }

    // --- Phase 3: mask gradient to lobe silhouette using destination-in ---
    // destination-in keeps only the pixels where the mask (lobe circles) is opaque.
    octx.globalCompositeOperation = 'destination-in';
    octx.beginPath();
    for (const lobe of p.lobes) {
      const lx = ox + lobe.dx * cloudR;
      const ly = oy + lobe.dy * cloudR;
      const lr = lobe.rs * cloudR;
      octx.moveTo(lx + lr, ly);
      octx.arc(lx, ly, lr, 0, Math.PI * 2);
    }
    octx.fillStyle = 'rgba(0, 0, 0, 1)';
    octx.fill();
    octx.globalCompositeOperation = 'source-over';

    // --- Phase 4: soft edge feathering (faint halo beyond each lobe) ---
    for (const lobe of p.lobes) {
      const lx = ox + lobe.dx * cloudR;
      const ly = oy + lobe.dy * cloudR;
      const lr = lobe.rs * cloudR;
      const eGrd = octx.createRadialGradient(lx, ly, lr * 0.82, lx, ly, lr * 1.12);
      eGrd.addColorStop(0, 'rgba(255,255,255,0)');
      eGrd.addColorStop(1, isNight
        ? 'rgba(60, 80, 130, 0.06)'
        : 'rgba(255, 255, 255, 0.07)');
      octx.fillStyle = eGrd;
      octx.beginPath();
      octx.arc(lx, ly, lr * 1.12, 0, Math.PI * 2);
      octx.fill();
    }

    p.off = off;
    p.ox = ox;
    p.oy = oy;
  }

  /**
   * Generate a fresh lobe array for a cloud archetype using noise-guided placement.
   * Returns exactly the same lobe count structure as the spawn-time generator.
   */
  _generateCloudLobes(archetype) {
    const ARCH = this._archetypes;
    if (!ARCH || !ARCH[archetype]) return [];
    const arch = ARCH[archetype];
    const [loMin, loMax] = arch.lobeCount;
    const lobeCount = loMin + Math.floor(Math.random() * (loMax - loMin + 1));
    const [rsMin, rsMax] = arch.rsRange;
    const lobes = [];
    // Center lobe
    lobes.push({ dx: 0, dy: 0, rs: 1.0, phase: Math.random() * Math.PI * 2 });
    // Crown anchors (1–2 lobes near top)
    const crownCount = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < crownCount; k++) {
      lobes.push({
        dx: (Math.random() - 0.5) * arch.spreadX * 0.6,
        dy: arch.spreadY * (0.7 + Math.random() * 0.3),
        rs: 0.7 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // Fill lobes — noise-guided placement
    const fillCount = lobeCount - 1 - crownCount;
    const noiseSeed  = Math.random() * 1000;
    const noiseScale = 1.5 + Math.random() * 1.5;
    let placed = 0;
    for (let gy = -3; gy <= 3; gy++) {
      for (let gx = -3; gx <= 3 && placed < fillCount; gx++) {
        const nx = gx / 3;
        const ny = gy / 3;
        const nVal = snFBM(noiseSeed + nx * noiseScale, noiseSeed + ny * noiseScale, 3);
        const threshold = -0.2 + (arch.spreadY < -0.5 ? 0.15 : 0);
        if (nVal > threshold) {
          const dx = nx * arch.spreadX * (0.7 + nVal * 0.3);
          const dy = ny * Math.abs(arch.spreadY) * (0.7 + nVal * 0.3);
          const rs = rsMin + (rsMax - rsMin) * (0.5 + nVal * 0.5);
          lobes.push({ dx, dy: -dy, rs: Math.max(0.25, Math.min(1.0, rs)), phase: Math.random() * Math.PI * 2 });
          placed++;
        }
      }
    }
    // Fallback for any remaining lobes not placed by noise
    while (placed < fillCount) {
      lobes.push({
        dx: (Math.random() - 0.5) * arch.spreadX,
        dy: -(Math.random() * Math.abs(arch.spreadY)),
        rs: rsMin + Math.random() * (rsMax - rsMin),
        phase: Math.random() * Math.PI * 2,
      });
      placed++;
    }
    // Per-lobe shade from vertical position: 1.0 = topmost, 0.0 = bottommost
    const dyVals = lobes.map(l => l.dy);
    const minDy = Math.min(...dyVals), maxDy = Math.max(...dyVals);
    lobes.forEach(l => {
      l.shade = (maxDy === minDy) ? 0.5 : 1.0 - (l.dy - minDy) / (maxDy - minDy);
    });
    // Enforce exact fill count before returning (safety)
    while (lobes.length < lobeCount) {
      lobes.push({ dx: 0, dy: 0, rs: rsMin, phase: 0, shade: 0.5 });
    }
    return lobes;
  }

  // Continuous cloud dimming from coverage % (0-100) + condition modifier
  // Sigmoid: gentle at extremes, steep mid-range — matches human perception
  _calcCloudDim(cloudCoverage, condition) {
    const c = Math.max(0, Math.min(100, cloudCoverage ?? 50));
    const sigmoid = 1 / (1 + Math.exp((c - 50) / 15));
    let dim = 0.10 + sigmoid * 0.90; // [0.10, 1.0]
    const MOD = { fog: 0.70, rainy: 0.85, pouring: 0.75, snowy: 0.80,
                  hail: 0.70, lightning: 0.65, 'lightning-rainy': 0.65 };
    return dim * (MOD[condition] ?? 1.0);
  }

  
  _getLightningInterval() {
    return lerp(8000, 100, Math.min((this._thunderstormProb ?? 0) / 100, 1));
  }

  updateSunMoon(sunElevation, sunAzimuth, moonElevation, moonAzimuth, moonBrightness) {
    this._sunElevation   = sunElevation;
    this._sunAzimuth     = sunAzimuth;
    this._moonElevation  = moonElevation;
    this._moonAzimuth    = moonAzimuth;
    this._moonBrightness = moonBrightness;
    // 24/7: restart rAF loop if it stopped (sun/moon may have risen)
    if (!this._animFrameId && this._shouldKeepRendering()) {
      this._startRenderLoop();
    }
  }

  /** Update dynamic values (cloud, wind, positions) without rebuilding particles.
   *  Called when fxKey hasn't changed but subordinate values have shifted. */
  updateDynamic(cloudCoverage, windBearing, sunElevation, sunAzimuth, moonElevation, moonAzimuth, moonBrightness, visibility = null, precipIntensity = null, thunderstormProb = null, heatIndex = null, windChill = null, precipProbability = null, windGustSpeed = undefined, dewPoint = undefined, pressure = undefined) {
    this._cloudCoverage  = cloudCoverage;
    if (visibility != null) this._visibility = parseFloat(visibility);
    if (precipIntensity != null) this._precipIntensity = precipIntensity;
    if (thunderstormProb != null) this._thunderstormProb = thunderstormProb;
    if (heatIndex != null) this._heatIndex = heatIndex;
    if (windChill != null) this._windChill = windChill;
    if (precipProbability != null) this._precipProbability = precipProbability;
    if (windGustSpeed !== undefined) this._windGustSpeed = windGustSpeed;
    if (dewPoint !== undefined) this._dewPoint = dewPoint;
    if (pressure !== undefined) this._pressure = pressure;
    this._windBearing    = Number.isFinite(windBearing) ? windBearing : 180;
    this._updateWindCache();
    this._sunElevation   = sunElevation;
    this._sunAzimuth     = sunAzimuth;
    this._moonElevation  = moonElevation;
    this._moonAzimuth    = moonAzimuth;
    this._moonBrightness = Number.isFinite(moonBrightness) ? moonBrightness : this._moonBrightness;
    // 24/7: restart rAF loop if it stopped
    if (!this._animFrameId && this._shouldKeepRendering()) {
      this._startRenderLoop();
    }
    this._ensureFogParticles();
  }

  
  updateNightSky(planets, galCenterAz, galCenterEl, issPos) {
    this._planets    = planets   || [];
    this._galCenterAz = galCenterAz;
    this._galCenterEl = galCenterEl;
    this._issPos     = issPos;
    // 24/7: restart rAF loop if it stopped (ISS may have become visible)
    if (!this._animFrameId && this._shouldKeepRendering()) {
      this._startRenderLoop();
    }
    this._ensureFogParticles();
  }

  start(weatherCondition, isNight, theme = 'dark', windSpeed = 0, moonBrightness = 0, moonElevation = -90, moonAzimuth = 180, sunElevation = -90, sunAzimuth = 180, cloudCoverage = null, windBearing = 180, visibility = null, precipIntensity = null, thunderstormProb = null, heatIndex = null, windChill = null, uvIndex = null, humidity = null, temperature = null, precipProbability = null, windGustSpeed = 0, dewPoint = null, pressure = null) {
    this._theme = theme;
    this._isNight = isNight;
    this._windSpeed = windSpeed;
    this._windBearing = Number.isFinite(windBearing) ? windBearing : 180;
    this._updateWindCache();
    this._weatherCondition = weatherCondition;
    // Moon values update every call — position changes continuously, no particle rebuild needed
    this._moonBrightness = Number.isFinite(moonBrightness) ? moonBrightness : 0;
    this._moonElevation  = moonElevation;
    this._moonAzimuth    = moonAzimuth;
    this._sunElevation   = sunElevation;
    this._sunAzimuth     = sunAzimuth;
    if (!this._posInitialized) {
      this._sunElevCur  = sunElevation;
      this._sunAzCur    = sunAzimuth;
      this._moonElevCur = moonElevation;
      this._moonAzCur   = moonAzimuth;
      this._posInitialized = true;
    }
    if (this._cloudCovCur === null) {
      this._cloudCovCur   = cloudCoverage ?? 50;
      this._moonBrightCur = moonBrightness;
    }
    this._cloudCoverage  = cloudCoverage;
    if (visibility != null) this._visibility = parseFloat(visibility);
    if (precipIntensity != null) this._precipIntensity = precipIntensity;
    if (thunderstormProb != null) this._thunderstormProb = thunderstormProb;
    if (heatIndex != null) this._heatIndex = heatIndex;
    if (windChill != null) this._windChill = windChill;
        if (uvIndex != null) this._uvIdx = uvIndex;
        if (humidity != null) this._humidity = humidity;
        if (temperature != null) this._temperature = temperature;
        if (precipProbability != null) this._precipProbability = precipProbability;
        this._windGustSpeed = windGustSpeed ?? 0;
        this._dewPoint = dewPoint ?? null;
        this._pressure = pressure ?? null;
    // _lastArchetypeCov is only updated in _startParticles() after threshold comparison (C7)
    // Determine particle type
    let particleType = CONDITION_PARTICLE_MAP[weatherCondition] || null;
    if (isNight && (!particleType || particleType === 'sunny')) particleType = 'night';

    // Overlay: render ambient effects behind weather particles.
    // Night = stars/aurora. Day = sun rays or diffuse warm glow.
    const NIGHT_OVERLAY_ALPHA = {
      'partlycloudy': 0.5, 'windy': 0.45, 'windy-variant': 0.45,
      'cloudy': 0.3, 'exceptional': 0.3, 'fog': 0.15, 'rainy': 0.2,
      'pouring': 0.07, 'snowy': 0.18, 'hail': 0.12, 'snowy-rainy': 0.10,
      'lightning': 0.03, 'lightning-rainy': 0.03,
    };
    const DAY_OVERLAY = {
      'partlycloudy':    { type: 'sunrays', alpha: 0.65 },
      'windy':           { type: 'sunrays', alpha: 0.60 },
      'windy-variant':   { type: 'sunrays', alpha: 0.60 },
      'cloudy':          { type: 'sunrays', alpha: 0.20 },
      'exceptional':     { type: 'sunrays', alpha: 0.15 },
      'fog':             { type: 'sunrays', alpha: 0.25 },
      'rainy':           { type: 'sunrays', alpha: 0.12 },
      'pouring':         { type: 'sunrays', alpha: 0.07 },
      'snowy':           { type: 'sunrays', alpha: 0.18 },
      'hail':            { type: 'sunrays', alpha: 0.12 },
      'snowy-rainy':     { type: 'sunrays', alpha: 0.10 },
      'lightning':       { type: 'sunrays', alpha: 0.05 },
      'lightning-rainy': { type: 'sunrays', alpha: 0.05 },
    };

    let newOverlayType = null, newOverlayAlpha = 0;
    if (isNight && particleType !== 'night') {
      newOverlayAlpha = NIGHT_OVERLAY_ALPHA[weatherCondition] ?? 0;
      if (newOverlayAlpha > 0) newOverlayType = 'night';
    } else if (!isNight) {
      const d = DAY_OVERLAY[weatherCondition];
      if (d) { newOverlayType = d.type; newOverlayAlpha = d.alpha; }
    }

    if (newOverlayType) {
      if (this._overlayType !== newOverlayType) {
        // Cross-fade: keep old overlay particles, fade them out while new ones fade in
        this._overlayTypePrev = this._overlayType;
        this._overlayParticlesPrev = this._overlayParticlesByType[this._overlayType] || [];
        this._overlayAlphaPrevCur = 1;
        this._overlayParticles = this._createParticles(newOverlayType, this.canvas);
        this._overlayParticlesByType = this._bucketize(this._overlayParticles);
      }
      this._overlayType = newOverlayType;
      this._overlayAlpha = newOverlayAlpha;
    } else {
      if (this._overlayType) {
        this._overlayTypePrev = this._overlayType;
        this._overlayParticlesPrev = this._overlayParticlesByType[this._overlayType] || [];
      }
      this._overlayParticles = [];
      this._overlayParticlesByType = {};
      this._overlayType = null;
      this._overlayAlpha = 0;
    }
    this._overlayTypeCur = this._overlayType;

    this._startParticles(particleType);
    this._ensureFogParticles();
    if (!this._starField || !this._starField.length) this._initStarField();
  }

  /** Stop all weather effects and clear canvas. */
  stop() {
    this._fadeGen++;
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this._currentType = null;
    this._particles = [];
    this._particlesByType = {};
    this._alpha = 1;
    this._fading = false;
    this._newParticlesCreated = false;
    this._overlayParticles = [];
    this._overlayParticlesByType = {};
    this._overlayType = null;
    this._overlayAlpha = 0;
    this._flashAlpha = 0; this._flashDecay = 0; this._rainbowFade = 0; this._boltCache = null; this._sheetLightningAlpha = 0;
    this._planets = []; this._issPos = null; this._milkyWayAlpha = 0;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Resize the particle canvas (call on container resize). */
  resize(width, height) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    // Recreate particles for new dimensions
    if (this._currentType) {
      this._particles = this._createParticles(this._currentType, this.canvas);
      this._particlesByType = this._bucketize(this._particles);
    }
    if (this._overlayType) {
      this._overlayParticles = this._createParticles(this._overlayType, this.canvas);
      this._overlayParticlesByType = this._bucketize(this._overlayParticles);
    }
    this._initStarField();
  }

  /** Full cleanup — call from disconnectedCallback. */
  destroy() {
    this.stop();
    // C5: Remove context loss/restore listeners
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
      this.canvas.removeEventListener('contextlost', this._contextLostHandler);
      this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
      this.canvas.removeEventListener('contextrestored', this._contextRestoredHandler);
    }
    this.canvas = null;
    this.ctx = null;
  }

  // ---- Private: particle lifecycle ----

  /** C5: Start the rAF render loop with error recovery. */
  _startRenderLoop() {
    const state = this;
    const canvas = this.canvas;
    if (!canvas || !state.ctx) return;
    if (state._animFrameId) return;
    const loop = (ts) => {
      if (ts - state._lastFrame >= 16) {
        state._lastFrame = ts;
        try {
          if (!state.ctx || state._contextLost) { state._animFrameId = requestAnimationFrame(loop); return; }
          if (state._currentType) {
            state._render(ts);
          } else {
            state.ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (e) {
          console.error('[WeatherFX] render error:', e);
          if (state.ctx) state.ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      // 24/7: dirty-flag — stop rAF when nothing is animating
      if (state._shouldKeepRendering()) {
        state._animFrameId = requestAnimationFrame(loop);
      } else {
        state._animFrameId = null;
      }
    };
    state._animFrameId = requestAnimationFrame(loop);
  }

  /** 24/7: Check if there's anything worth rendering this frame. */
  _shouldKeepRendering() {
    // Particles active → keep rendering
    if (this._currentType && this._particles.length > 0) return true;
    // Overlay active → keep rendering
    if (this._overlayType && this._overlayAlphaCur > 0.005) return true;
    // Sun above horizon → keep rendering
    if (this._sunElevCur > -2) return true;
    // Moon above horizon → keep rendering
    if (this._moonElevCur > 0) return true;
    // ISS tracking → keep rendering
    if (this._issPos && this._issElevCur > 0) return true;
    // Nothing to render — stop rAF until state changes
    return false;
  }

  _ensureFogParticles() {
    const vis = this._visibility ?? 99;
    const hasFog = !!(this._particlesByType && this._particlesByType.fogBlob && this._particlesByType.fogBlob.length);
    if (vis < 5 && !hasFog) {
      const fogParts = this._createParticles('fog', this.canvas);
      if (fogParts.length) {
        this._particles.push(...fogParts);
        if (!this._particlesByType) this._particlesByType = {};
        this._particlesByType.fogBlob = (this._particlesByType.fogBlob || []).concat(fogParts);
      }
    } else if (vis >= 5 && hasFog) {
      this._particles = this._particles.filter(p => p.kind !== 'fogBlob');
      delete this._particlesByType.fogBlob;
    }
  }

  _startParticles(type) {
    const canvas = this.canvas;
    const state = this;

    // Same type — check if cloud coverage crossed an archetype threshold
    if (state._currentType === type && !state._fading) {
      if (type === 'cloudy') {
        const cov = state._cloudCoverage ?? 50;
        const prevCov = state._lastArchetypeCov ?? cov;
        const thresholds = [25, 50, 75, 85];
        const crossed = thresholds.some(t => (prevCov < t && cov >= t) || (prevCov >= t && cov < t));
        if (!crossed) return;
        state._lastArchetypeCov = cov;
      } else {
        return;
      }
    }

    // B23: Guard against redundant calls during active fade
    if (state._fading && type === state._currentType) return;
    if (state._fading && type === state._nextType) return;

    // Early return: if new type is null and no current type
    if (!type && !state._currentType) return;

    // Fade out current, then switch — overlap fade-in to avoid blank frame
    if (state._currentType && state._currentType !== type) {
      state._fading = true;
      state._nextType = type;
      const gen = ++state._fadeGen;
      const fadeStep = () => {
        if (state._fadeGen !== gen) return; // cancelled by stop() or a newer transition
        state._alpha -= 0.02;
        if (state._alpha <= 0.15) {
          // Start fade-in before fade-out completes — overlap avoids blank frame
          if (!state._newParticlesCreated) {
            state._alpha = 0.15;
            state._newParticlesCreated = true;
            state._currentType = state._nextType;
            state._particles = state._currentType
              ? state._createParticles(state._currentType, canvas) : [];
            state._particlesByType = state._currentType ? state._bucketize(state._particles) : {};
          }
          state._alpha += 0.02;
          if (state._alpha >= 1) {
            state._alpha = 1;
            state._fading = false;
            state._newParticlesCreated = false;
            state._animFrameId = null;
            return;
          }
          state._animFrameId = requestAnimationFrame(fadeStep);
          return;
        }
        state._animFrameId = requestAnimationFrame(fadeStep);
      };
      state._newParticlesCreated = false;
      state._animFrameId = requestAnimationFrame(fadeStep);
      return;
    }

    // Same type but threshold crossed — rebuild clouds without fade
    if (state._currentType === type && type === 'cloudy') {
      state._particles = state._createParticles(type, canvas);
      state._particlesByType = state._bucketize(state._particles);
      return;
    }

    // First time — just start
    state._currentType = type;
    state._particles = type ? state._createParticles(type, canvas) : [];
    state._particlesByType = type ? state._bucketize(state._particles) : {};
    state._alpha = 1;

    this._startRenderLoop();
  }

  // ---- Private: particle creation (from v9 createWeatherParticles) ----

  _createParticles(type, canvas) {
    const w = canvas.width, h = canvas.height;
    const particles = [];
    // Use cached wind values (updated by _updateWindCache() on each start() call)
    const windFactor = this._windFactor;
    const windDx     = this._windDx;
    const windDy     = this._windDy; // +1 = down (spawn convention)

    if (type === 'sunny') {
      // Dust motes floating upward
      for (let i = 0; i < 25; i++) {
        particles.push({
          kind: 'mote', x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 2.5,
          vy: -(0.15 + Math.random() * 0.3), vx: (Math.random() - 0.5) * 0.3,
          o: 0.12 + Math.random() * 0.2, phase: Math.random() * Math.PI * 2
        });
      }
      // God rays — 10 beams radiating from sun in all directions
      // Crepuscular effect: only visible at low elevation (< 15°), peak below 6.5°
      for (let i = 0; i < 10; i++) {
        const baseAngle = (i / 10) * Math.PI * 2;
        particles.push({
          kind: 'ray', angle: baseAngle + (Math.random() - 0.5) * 0.4,
          width: 0.04 + Math.random() * 0.06,
          o: 0.025 + Math.random() * 0.025, phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.25
        });
      }
    } else if (type === 'pouring') {
      // Heavy downpour — dense, long, fast streaks with strong wind
      const mmh = this._precipIntensity ?? null;
      const sev = mmh != null ? Math.max(0.1, Math.min(1.2, Math.pow(mmh / 25, 0.45))) : (RAIN_SEVERITY[type] ?? 0.55);
      const spawnWF = Math.min(1, (this._windSpeed || 0) / 54);
      const lenBase = 8 + sev * 14, lenRange = 10 + sev * 12;
      const speedBase = 3 + sev * 8, speedRange = 3 + sev * 7;
      const oBase = 0.12 + sev * 0.20, oRange = 0.12 + sev * 0.18;
      const lwMin = 0.6 + sev * 0.5, lwRange = 0.8 + sev * 1.4;
      const windBase = 0.3 + sev * 0.2, windRangeW = 0.4 + sev * 0.4;
      const precipIntensity = this._precipIntensity ?? (RAIN_SEVERITY[type] * ((this._cloudCoverage ?? 80) / 100));
      for (const [layerKey, layer] of Object.entries(RAIN_LAYERS)) {
        let spawnCount = intensityToSpawnCount(layerKey, precipIntensity);
        spawnCount = Math.round(spawnCount * (0.7 + (this._cloudCoverage ?? 80) / 300));
        for (let i = 0; i < spawnCount; i++) {
          const depth = layer.depth * (0.85 + Math.random() * 0.3);
          const depthScale = 0.5 + depth * 0.5;
          particles.push({
            kind: 'drop',
            x: Math.random() * w,
            y: Math.random() * h,
            len: (lenBase + Math.random() * lenRange) * depthScale * (1 + spawnWF * 0.5),
            speed: (speedBase + Math.random() * speedRange) * depthScale * layer.speedMult,
            o: (oBase + Math.random() * oRange) * (0.45 + depth * 0.55),
            lw: (lwMin + depth * lwRange) * layer.depth,
            gustPhase: Math.random() * Math.PI * 2,
            windDx: windDx * (windBase + spawnWF * windRangeW) * layer.windMult,
            layer: layerKey,
            depth: layer.depth,
            windMult: layer.windMult,
            speedMult: layer.speedMult,
            alphaMult: layer.alphaMult,
          });
        }
      }
      // More frequent, larger splash ripples
      for (let i = 0; i < 16; i++) {
        particles.push({
          kind: 'ripple', x: Math.random() * w, y: h * (0.82 + Math.random() * 0.18),
          r: 0, maxR: 10 + Math.random() * 14, o: 0.18, life: 0,
          lifespan: 45 + Math.random() * 30
        });
      }
    } else if (type === 'rainy' || type === 'storm') {
      // Streak rain with parallax depth layers
      const mmh = this._precipIntensity ?? null;
      const sev = mmh != null ? Math.max(0.1, Math.min(1.2, Math.pow(mmh / 25, 0.45))) : (RAIN_SEVERITY[type] ?? 0.55);
      const spawnWF = Math.min(1, (this._windSpeed || 0) / 54);
      const lenBase = 8 + sev * 14, lenRange = 10 + sev * 12;
      const speedBase = 3 + sev * 8, speedRange = 3 + sev * 7;
      const oBase = 0.12 + sev * 0.20, oRange = 0.12 + sev * 0.18;
      const lwMin = 0.6 + sev * 0.5, lwRange = 0.8 + sev * 1.4;
      const windBase = 0.3 + sev * 0.2, windRangeW = 0.4 + sev * 0.4;
      const precipIntensity = this._precipIntensity ?? (RAIN_SEVERITY[type] * ((this._cloudCoverage ?? 80) / 100));
      for (const [layerKey, layer] of Object.entries(RAIN_LAYERS)) {
        let spawnCount = intensityToSpawnCount(layerKey, precipIntensity);
        spawnCount = Math.round(spawnCount * (0.7 + (this._cloudCoverage ?? 80) / 300));
        for (let i = 0; i < spawnCount; i++) {
          const depth = layer.depth * (0.85 + Math.random() * 0.3);
          const depthScale = 0.5 + depth * 0.5;
          particles.push({
            kind: 'drop',
            x: Math.random() * w,
            y: Math.random() * h,
            len: (lenBase + Math.random() * lenRange) * depthScale * (1 + spawnWF * 0.5),
            speed: (speedBase + Math.random() * speedRange) * depthScale * layer.speedMult,
            o: (oBase + Math.random() * oRange) * (0.45 + depth * 0.55),
            lw: (lwMin + depth * lwRange) * layer.depth,
            gustPhase: Math.random() * Math.PI * 2,
            windDx: windDx * (windBase + spawnWF * windRangeW) * layer.windMult,
            layer: layerKey,
            depth: layer.depth,
            windMult: layer.windMult,
            speedMult: layer.speedMult,
            alphaMult: layer.alphaMult,
          });
        }
      }
      // Splash ripples at bottom
      for (let i = 0; i < 8; i++) {
        particles.push({
          kind: 'ripple', x: Math.random() * w, y: h * (0.85 + Math.random() * 0.15),
          r: 0, maxR: 8 + Math.random() * 12, o: 0.15, life: 0,
          lifespan: 60 + Math.random() * 40
        });
      }
      // Lightning bolt state for storms
      if (type === 'storm') {
        particles.push({
          kind: 'lightning', timer: 0, interval: this._getLightningInterval(),
          bolt: null, flashAlpha: 0, flickerPhase: 0,
          _strokeSequence: 2 + Math.floor(Math.random() * 3), // 2–4 strokes
          _strokeIndex: 0,
          _strokePauseUntil: 0,
        });
      }
    } else if (type === 'sleet') {
      // Rain streaks — denser, shorter, steeper than pure rain; parallax depth layers
      const mmh = this._precipIntensity ?? null;
      const sev = mmh != null ? Math.max(0.1, Math.min(1.2, Math.pow(mmh / 25, 0.45))) : (RAIN_SEVERITY[type] ?? 0.55);
      const spawnWF = Math.min(1, (this._windSpeed || 0) / 54);
      const lenBase = 8 + sev * 14, lenRange = 10 + sev * 12;
      const speedBase = 3 + sev * 8, speedRange = 3 + sev * 7;
      const oBase = 0.12 + sev * 0.20, oRange = 0.12 + sev * 0.18;
      const lwMin = 0.6 + sev * 0.5, lwRange = 0.8 + sev * 1.4;
      const windBase = 0.3 + sev * 0.2, windRangeW = 0.4 + sev * 0.4;
      const precipIntensity = this._precipIntensity ?? (RAIN_SEVERITY[type] * ((this._cloudCoverage ?? 80) / 100));
      for (const [layerKey, layer] of Object.entries(RAIN_LAYERS)) {
        let spawnCount = intensityToSpawnCount(layerKey, precipIntensity);
        spawnCount = Math.round(spawnCount * (0.7 + (this._cloudCoverage ?? 80) / 300));
        for (let i = 0; i < spawnCount; i++) {
          const depth = layer.depth * (0.85 + Math.random() * 0.3);
          const depthScale = 0.5 + depth * 0.5;
          particles.push({
            kind: 'drop',
            x: Math.random() * w,
            y: Math.random() * h,
            len: (lenBase + Math.random() * lenRange) * depthScale * (1 + spawnWF * 0.5),
            speed: (speedBase + Math.random() * speedRange) * depthScale * layer.speedMult,
            o: (oBase + Math.random() * oRange) * (0.45 + depth * 0.55),
            lw: (lwMin + depth * lwRange) * layer.depth,
            gustPhase: Math.random() * Math.PI * 2,
            windDx: windDx * (windBase + spawnWF * windRangeW) * layer.windMult,
            layer: layerKey,
            depth: layer.depth,
            windMult: layer.windMult,
            speedMult: layer.speedMult,
            alphaMult: layer.alphaMult,
          });
        }
      }
      // Ice pellets — small solid circles with wind-driven horizontal drift
      for (let i = 0; i < 25; i++) {
        const depth = Math.random();
        particles.push({
          kind: 'pellet', x: Math.random() * w, y: Math.random() * h,
          r: (1 + Math.random() * 1.5) * (0.5 + depth * 0.5),
          speed: (3 + Math.random() * 4) * (0.5 + depth * 0.5),
          vx: (Math.random() - 0.5) * 1.5 + windDx * windFactor * 2.5 * (0.5 + depth * 0.5),
          o: (0.15 + Math.random() * 0.2) * (0.4 + depth * 0.6),
        });
      }
      // Splash ripples at bottom
      for (let i = 0; i < 6; i++) {
        particles.push({
          kind: 'ripple', x: Math.random() * w, y: h * (0.85 + Math.random() * 0.15),
          r: 0, maxR: 5 + Math.random() * 8, o: 0.12, life: 0,
          lifespan: 50 + Math.random() * 30
        });
      }
    } else if (type === 'night') {
      // Aurora bands — 4 sine waves across top
      const auroraCount = 4;
      for (let i = 0; i < auroraCount; i++) {
        // Extended aurora hue palette: green (dominant), cyan, blue-violet, purple, rare red
        const AURORA_HUES = [120, 120, 120, 180, 240, 270]; // weighted toward green
        const yBase = h * (0.08 + i * 0.07);
        particles.push({
          kind: 'aurora', yBase, yBaseInitial: yBase,
          hue: AURORA_HUES[Math.floor(Math.random() * AURORA_HUES.length)],
          amplitude: 15 + Math.random() * 25, freq: 0.002 + Math.random() * 0.002,
          phase: Math.random() * Math.PI * 2, speed: 0.003 + Math.random() * 0.003,
          thickness: 30 + Math.random() * 40, o: 0.06 + Math.random() * 0.04
        });
      }
      // Shooting star state
      particles.push({
        kind: 'shootingStar', timer: 0, interval: 400 + Math.random() * 800,
        active: false, x: 0, y: 0, vx: 0, vy: 0, trail: [], life: 0
      });
    } else if (type === 'snowy') {
      if (!this._weatherCondition.match(/snow|hail|sleet/i)) return particles;
      this._activeDendrites = 0; // reset before spawning fresh batch
      // Layered snowflakes with turbulent wobble
      const snowDensity = Math.round(10 + Math.pow(Math.min(this._precipIntensity ?? 1, 10), 0.7) * 8);
      for (let i = 0; i < snowDensity; i++) {
        const depth = Math.random();
        const baseVy = (0.2 + Math.random() * 0.4) * (0.4 + depth * 0.6);
        const baseSwayAmp = (0.3 + depth * 0.7) * (1 - windFactor * 0.7);
        // Step 1: depth-based shape selection (no counter increment yet)
        let shape;
        if (depth < 0.4) {
          shape = 'circle';
        } else if (depth <= 0.7) {
          shape = 'hexplate';
        } else {
          shape = (this._activeDendrites < 8) ? 'dendrite' : 'hexplate';
        }
        // Step 2: temperature-based character (may override shape)
        const temp = this._temperature;
        let swayAmpMod = baseSwayAmp;
        let opacityMod = (0.15 + Math.random() * 0.25) * (0.5 + depth * 0.5);
        let vyMod = baseVy;
        let sparkle = false;
        let bokehTag = false;
        if (temp !== null && temp > -1) {
          // wet heavy snow
          swayAmpMod *= 0.3;
          opacityMod *= 0.9;
          vyMod *= 1.5;
          shape = 'circle'; // wet snow overrides to circle
        } else if (temp !== null && temp < -15) {
          // diamond dust
          swayAmpMod *= 2.0;
          sparkle = true;
          vyMod *= 0.4;
        } else {
          // medium dry — bokeh tag for deep particles
          if (depth > 0.7) bokehTag = true;
        }
        // Step 3: only count dendrites after temperature may have overridden shape
        if (shape === 'dendrite') {
          this._activeDendrites += 1;
        }
        particles.push({
          kind: 'flake', x: Math.random() * w, y: Math.random() * h,
          r: (1 + Math.random() * 2) * (0.5 + depth * 0.5),
          vy: vyMod,
          sway: Math.random() * Math.PI * 2,
          swaySpeed: 0.3 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
          // Strong wind reduces random sway and replaces with directional drift
          swayAmp: swayAmpMod,
          windDrift: windDx * windFactor * 2.0 * (0.3 + depth * 0.7),
          o: opacityMod,
          angle: Math.random() * Math.PI * 2,
          depth,
          shape,
          sparkle,
          bokeh: bokehTag,
        });
      }
      // Bokeh foreground flakes
      for (let i = 0; i < 5; i++) {
        particles.push({
          kind: 'bokeh', x: Math.random() * w, y: Math.random() * h,
          r: 10 + Math.random() * 15, vy: 0.1 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.3 - windFactor * 1.2,
          o: 0.04 + Math.random() * 0.04,
          angle: Math.random() * Math.PI / 3
        });
      }
    } else if (type === 'fog') {
      const FOG_LAYERS = [
        { yBase: 0.75, speed: 0.15, count: 5, alphaMin: 0.18, alphaMax: 0.24, amp: 18 },
        { yBase: 0.55, speed: 0.22, count: 4, alphaMin: 0.12, alphaMax: 0.18, amp: 14 },
        { yBase: 0.38, speed: 0.30, count: 4, alphaMin: 0.08, alphaMax: 0.12, amp: 10 },
        { yBase: 0.22, speed: 0.40, count: 3, alphaMin: 0.04, alphaMax: 0.08, amp:  8 },
      ];
      FOG_LAYERS.forEach((layer, li) => {
        for (let bi = 0; bi < layer.count; bi++) {
          particles.push({
            kind: 'fogBlob',
            x: Math.random() * w,
            yBase: h * layer.yBase,
            layer: li, blobIndex: bi,
            rx: 90 + Math.random() * 70,
            ry: 24 + Math.random() * 16,
            vx: (layer.speed * windDx + (Math.random() - 0.5) * 0.1) * (1 + windFactor * 0.3),
            o: layer.alphaMin + Math.random() * (layer.alphaMax - layer.alphaMin),
            amp: layer.amp
          });
        }
      });
    } else if (type === 'cloudy') {
      // Archetype inference from condition + cloud_coverage
      const cond = this._weatherCondition || '';
      const cov  = this._cloudCoverage != null ? this._cloudCoverage : 50;
      let archetype;
      if (cond === 'lightning' || cond === 'hail') {
        archetype = 'cumulonimbus';
      } else if (cond === 'rainy' || cond === 'pouring' || cond === 'snowy' || cond === 'snowy-rainy') {
        archetype = 'nimbostratus';
      } else if (cov > 85) {
        archetype = 'stratus';
      } else if (cov >= 65) {
        archetype = 'stratocumulus';
      } else if (cov >= 40) {
        archetype = 'altocumulus';
      } else if (cov <= 10) {
        archetype = 'cirrus';
      } else {
        archetype = 'cumulus';
      }
      // Step 2: thunderstorm probability override
      if ((this._thunderstormProb ?? 0) > 40) archetype = 'cumulonimbus';
      // Per-archetype lobe constraints (spec §1–§2)
      const ARCH = {
        cumulus:       { lobeCount: [5, 8],  spreadX: 0.80, spreadY: -0.70, rsRange: [0.55, 0.90] },
        altocumulus:   { lobeCount: [5, 9],  spreadX: 1.00, spreadY: -0.30, rsRange: [0.45, 0.75] },
        stratocumulus: { lobeCount: [7, 11], spreadX: 1.30, spreadY: -0.20, rsRange: [0.40, 0.70] },
        stratus:       { lobeCount: [8, 14], spreadX: 1.80, spreadY: -0.10, rsRange: [0.35, 0.60] },
        nimbostratus:  { lobeCount: [7, 12], spreadX: 1.50, spreadY: -0.15, rsRange: [0.40, 0.65] },
        cumulonimbus:  { lobeCount: [6, 10], spreadX: 0.90, spreadY: -1.00, rsRange: [0.55, 0.85] },
        cirrus:        { lobeCount: [3, 5],  spreadX: 2.50, spreadY: -0.10, rsRange: [0.35, 0.60], alpha: [0.15, 0.25], layers: 2 },
      };
      // Store archetypes on instance so _generateCloudLobes can reference them
      this._archetypes = ARCH;
      const arch = ARCH[archetype];
      // 2 depth layers — aggressively differentiated (spec §4)
      const LAYERS = [
        { count: 3, rMin:  40, rMax:  80, speedRange: [0.07, 0.13], alphaRange: [0.35, 0.50], yRange: [0.03, 0.30], windMult: 0.10 },
        { count: 4, rMin: 110, rMax: 200, speedRange: [0.20, 0.35], alphaRange: [0.70, 0.90], yRange: [0.15, 0.55], windMult: 0.25 },
      ];
      LAYERS.forEach((layer, li) => {
        for (let ci = 0; ci < layer.count; ci++) {
          const r = layer.rMin + Math.random() * (layer.rMax - layer.rMin);
          const baseSpeed = layer.speedRange[0] + Math.random() * (layer.speedRange[1] - layer.speedRange[0]);
          const alpha     = layer.alphaRange[0] + Math.random() * (layer.alphaRange[1] - layer.alphaRange[0]);
          const yBaseRaw  = h * (layer.yRange[0] + Math.random() * (layer.yRange[1] - layer.yRange[0]));
          // Dew-point cloud base height (T2.2): larger temp-dew spread = higher clouds
          const _tdSpread = (this._temperature ?? 20) - (this._dewPoint ?? 10);
          const _yBaseFactor = Math.min(Math.max((_tdSpread - 3) / 9, 0), 1);
          const yBase = archetype !== 'cirrus'
            ? yBaseRaw - _yBaseFactor * (h * 0.3)
            : h * 0.15; // cirrus always fixed to upper 20% of canvas
          // Procedural lobe generation (spec §2)
          const [loMin, loMax] = arch.lobeCount;
          const lobeCount = loMin + Math.floor(Math.random() * (loMax - loMin + 1));
          const [rsMin, rsMax] = arch.rsRange;
          const lobes = [];
          // Center lobe
          lobes.push({ dx: 0, dy: 0, rs: 1.0, phase: Math.random() * Math.PI * 2 });
          // Crown anchors (1–2 lobes near top)
          const crownCount = 1 + Math.floor(Math.random() * 2);
          for (let k = 0; k < crownCount; k++) {
            lobes.push({
              dx: (Math.random() - 0.5) * arch.spreadX * 0.6,
              dy: arch.spreadY * (0.7 + Math.random() * 0.3),
              rs: 0.7 + Math.random() * 0.2,
              phase: Math.random() * Math.PI * 2,
            });
          }
          // Fill lobes — noise-guided placement (T2.2)
          const fillCount = lobeCount - 1 - crownCount;
          const noiseSeed = Math.random() * 1000;
          const noiseScale = 1.5 + Math.random() * 1.5;
          let placed = 0;

          for (let gy = -3; gy <= 3; gy++) {
            for (let gx = -3; gx <= 3 && placed < fillCount; gx++) {
              const nx = gx / 3;
              const ny = gy / 3;
              const nVal = snFBM(noiseSeed + nx * noiseScale, noiseSeed + ny * noiseScale, 3);
              const threshold = -0.2 + (arch.spreadY < -0.5 ? 0.15 : 0);
              if (nVal > threshold) {
                const dx = nx * arch.spreadX * (0.7 + nVal * 0.3);
                const dy = ny * Math.abs(arch.spreadY) * (0.7 + nVal * 0.3);
                const rs = rsMin + (rsMax - rsMin) * (0.5 + nVal * 0.5);
                lobes.push({ dx, dy: -dy, rs: Math.max(0.25, Math.min(1.0, rs)), phase: Math.random() * Math.PI * 2 });
                placed++;
              }
            }
          }
          // Fallback for any remaining lobes not placed by noise:
          while (placed < fillCount) {
            lobes.push({
              dx: (Math.random() - 0.5) * arch.spreadX,
              dy: -(Math.random() * Math.abs(arch.spreadY)),
              rs: rsMin + Math.random() * (rsMax - rsMin),
              phase: Math.random() * Math.PI * 2,
            });
            placed++;
          }
          // Per-lobe shade from vertical position (spec §2): 1.0 = topmost, 0.0 = bottommost
          const dyVals = lobes.map(l => l.dy);
          const minDy = Math.min(...dyVals), maxDy = Math.max(...dyVals);
          lobes.forEach(l => {
            l.shade = (maxDy === minDy) ? 0.5 : 1.0 - (l.dy - minDy) / (maxDy - minDy);
          });
          // Pre-compute fixed offscreen origin with morph headroom (items 11)
          // Bounds from all lobes + ±0.06 dx, ±0.04 dy, ±0.03 rs headroom
          const _pad = r * 0.4;
          let _bMinX = Infinity, _bMaxX = -Infinity, _bMinY = Infinity, _bMaxY = -Infinity;
          for (const lb of lobes) {
            const _lr = (lb.rs + 0.03) * r;
            const _lx = (Math.abs(lb.dx) + 0.06) * r;
            const _ly = (Math.abs(lb.dy) + 0.04) * r;
            if (-_lx - _lr < _bMinX) _bMinX = -_lx - _lr;
            if ( _lx + _lr > _bMaxX) _bMaxX =  _lx + _lr;
            if (-_ly - _lr < _bMinY) _bMinY = -_ly - _lr;
            if ( _ly + _lr > _bMaxY) _bMaxY =  _ly + _lr;
          }
          const _fixedOx = -_bMinX + _pad;
          const _fixedOy = -_bMinY + _pad;

          const p = {
            kind: 'cloud',
            x: Math.random() * w,
            yBase, y: yBase,
            r,
            vx: baseSpeed,
            alpha,
            layer: li,
            windMult: layer.windMult,
            archetype,
            lobes,
            phase:    Math.random() * Math.PI * 2,
            bobSpeed: 0.0003 + Math.random() * 0.0002,
            bobAmp:   3 + Math.random() * 5,
            // T2.3: morph state
            _morphProgress: 0,
            _morphFrom: lobes.map(l => ({ ...l })),
            _morphTo: null, // set after _archetypes is populated
            // T2.3: precip bucket for underside colour dirty-flag
            _precipThresholdBucket: Math.floor((this._precipProbability ?? 0) / 25),
            // T2.3: fixed offscreen origin with morph headroom
            _fixedOx,
            _fixedOy,
          };
          // _morphTo needs _generateCloudLobes which needs this._archetypes — set now
          p._morphTo = this._generateCloudLobes(archetype);
          // Clamp both arrays to same length to prevent silent lobe freezing
          const morphLen = Math.min(p._morphFrom.length, p._morphTo.length);
          p._morphFrom = p._morphFrom.slice(0, morphLen);
          p._morphTo = p._morphTo.slice(0, morphLen);
          p.lobes = p.lobes.slice(0, morphLen);
          this._renderCloudToOffscreen(p, this._isNight);
          particles.push(p);
        }
      });
    } else if (type === 'sunrays') {
      // 16 directional crepuscular beams — fan downward from sun in ±90° cone
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        particles.push({
          kind: 'ray',
          angleOffset: (t - 0.5) * Math.PI + (Math.random() - 0.5) * 0.2,
          width: 0.012 + Math.random() * 0.018,
          baseO: 0.04 + Math.random() * 0.05,
          phase1: Math.random() * Math.PI * 2,
          phase2: Math.random() * Math.PI * 2,
          freq1: 0.0003 + Math.random() * 0.0004,
          freq2: 0.0011 + Math.random() * 0.0019,
          reachBase: 0.65 + Math.random() * 0.35,
          reachPhase: Math.random() * Math.PI * 2,
          reachFreq: 0.00018 + Math.random() * 0.00025,
        });
      }
      // Golden motes drifting slowly upward
      for (let i = 0; i < 10; i++) {
        particles.push({
          kind: 'mote', x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 2,
          vy: -(0.1 + Math.random() * 0.2), vx: (Math.random() - 0.5) * 0.2,
          o: 0.12 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2,
        });
      }
    } else if (type === 'diffuse') {
      // Large soft warm-light halos — ambient sky glow behind overcast conditions
      for (let i = 0; i < 5; i++) {
        particles.push({
          kind: 'halo', x: Math.random() * w, y: h * (0.05 + Math.random() * 0.4),
          rx: 120 + Math.random() * 180, ry: 60 + Math.random() * 80,
          vx: (Math.random() - 0.5) * 0.15,
          o: 0.04 + Math.random() * 0.04,
          phase: Math.random() * Math.PI * 2,
          breatheSpeed: 0.003 + Math.random() * 0.004
        });
      }
    }

    // Visibility fog overlay — append fog blobs for any non-fog condition when vis < 5km
    if (type !== 'fog' && this._visibility != null && this._visibility < 5) {
      const fogDensity = Math.max(0.15, 1 - this._visibility / 5);
      const FOG_VIS_LAYERS = [
        { yBase: 0.75, speed: 0.15, count: Math.round(5 * fogDensity), alphaMin: 0.14, alphaMax: 0.20, amp: 18 },
        { yBase: 0.55, speed: 0.22, count: Math.round(4 * fogDensity), alphaMin: 0.09, alphaMax: 0.14, amp: 14 },
        { yBase: 0.38, speed: 0.30, count: Math.round(3 * fogDensity), alphaMin: 0.05, alphaMax: 0.09, amp: 10 },
        { yBase: 0.22, speed: 0.40, count: Math.round(2 * fogDensity), alphaMin: 0.03, alphaMax: 0.06, amp:  8 },
      ];
      FOG_VIS_LAYERS.forEach((layer, li) => {
        for (let bi = 0; bi < layer.count; bi++) {
          particles.push({
            kind: 'fogBlob',
            x: Math.random() * w,
            yBase: h * layer.yBase,
            layer: li, blobIndex: bi,
            rx: 90 + Math.random() * 70,
            ry: 24 + Math.random() * 16,
            vx: (layer.speed * windDx + (Math.random() - 0.5) * 0.1) * (1 + windFactor * 0.3),
            o: layer.alphaMin + Math.random() * (layer.alphaMax - layer.alphaMin),
            amp: layer.amp,
          });
        }
      });
    }

    return particles;
  }

  _bucketize(arr) {
    const b = {};
    for (const p of arr) {
      if (!b[p.kind]) b[p.kind] = [];
      b[p.kind].push(p);
    }
    return b;
  }

  // ---- Private: lightning bolt generation (from v9 generateBolt) ----

  _generateBolt(x1, y1, x2, y2, depth, baseAlpha = 1.0) {
    if (depth === 0) return { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], branches: [], baseAlpha, decayMult: 1 };
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * Math.abs(y2 - y1) * 0.4;
    const my = (y1 + y2) / 2;
    const left  = this._generateBolt(x1, y1, mx, my, depth - 1, baseAlpha);
    const right = this._generateBolt(mx, my, x2, y2, depth - 1, baseAlpha);
    const allPoints = left.points.concat(right.points.slice(1));
    const branches = [...left.branches, ...right.branches];
    // 30% chance of child branch at this midpoint
    if (depth >= 2 && Math.random() < 0.3) {
      const angle = (Math.random() - 0.5) * Math.PI / 3; // ±30° from vertical
      const len = Math.abs(y2 - y1) * (0.5 + Math.random() * 0.2);
      const ex = mx + Math.sin(angle) * len * 0.5;
      const ey = my + len;
      const child = this._generateBolt(mx, my, ex, ey, depth - 2, baseAlpha * (0.4 + Math.random() * 0.2));
      child.decayMult = 1.5;
      branches.push(child);
    }
    return { points: allPoints, branches, baseAlpha, decayMult: 1 };
  }

  _renderDrops(ctx, particles, now, night, light, windFactor, windDx, alpha) {
    // Unified gust ratio: how much stronger gusts are than mean wind (1–3×)
    const gustRatio = Math.min(Math.max(this._windGustSpeed / Math.max(this._windSpeed, 1), 1), 3.0);
    // windFeel: temperature + wind chill / heat index tint applied to drop colour
    const windFeel = this._temperature < 5 && this._windSpeed > 15 ? 'cold_bite'
      : this._temperature > 30 && this._windSpeed > 10 ? 'hot_blast'
      : 'neutral';
    const WIND_FEEL_TINT = {
      cold_bite: { r: -15, g: -10, b: 25 },
      hot_blast:  { r: 20,  g: 8,   b: -10 },
      neutral:    { r: 0,   g: 0,   b: 0 },
    };
    const tint = WIND_FEEL_TINT[windFeel];
    const baseR = night ? 140 : 200;
    const baseG = night ? 170 : 225;
    const baseB = night ? 220 : 255;
    const rH = Math.min(255, Math.max(0, baseR + tint.r));
    const gH = Math.min(255, Math.max(0, baseG + tint.g));
    const bH = Math.min(255, Math.max(0, baseB + tint.b));
    const w = this.canvas.width, h = this.canvas.height;
    particles.forEach(p => {
      const gustFactor = 1 + (gustRatio - 1) * 0.5 * Math.sin(now * 0.0007 + p.gustPhase);
      const effDx = p.windDx * gustFactor;
      p.x += effDx;
      p.y += p.speed;
      if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      const x0 = p.x, y0 = p.y;
      const x1 = p.x + p.len * effDx, y1 = p.y - p.len;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const layerAlpha = p.layer ? (this._rainLayerAlpha[p.layer] ?? 1) : 1;
      const ao = alpha * p.o * (p.alphaMult ?? 1) * layerAlpha;
      grad.addColorStop(0, `rgba(${rH},${gH},${bH},${ao})`);
      grad.addColorStop(1, `rgba(${rH},${gH},${bH},0)`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.lw;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    });
  }

  _drawBolt(ctx, boltTree, alpha) {
    if (!boltTree || !boltTree.points.length) return;
    ctx.globalAlpha = alpha * boltTree.baseAlpha;
    ctx.beginPath();
    boltTree.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    for (const branch of boltTree.branches) {
      this._drawBolt(ctx, branch, alpha * 0.6 / (branch.decayMult || 1));
    }
  }

  // ---- Private: ambient overlay (night: stars/aurora, day: sunrays/diffuse glow) ----

  _renderOverlay(now, cloudDim) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const w = canvas.width, h = canvas.height;
    // Night star overlay: scale by cloud transmittance so dense clouds occlude stars
    const cloudTransmit = (this._overlayType === 'night' && this._cloudCovCur !== null)
      ? cloudDim
      : 1.0;
    const scale = this._alpha * this._overlayAlphaCur * cloudTransmit;
    const light = this._theme === 'light';
    if (scale <= 0 || !this._overlayParticles.length) return;

    // ---- Day overlays ----
    if (this._overlayType === 'sunrays') {
      if (this._sunElevCur <= 0) return;
      const { x: sunX, y: sunY } = WeatherFX._getSunCanvasPos(w, h, this._sunAzCur, this._sunElevCur);

      // Cloud intensity gate: shafts peak at 40-70% coverage, fade on clear or overcast
      const cc = this._cloudCovCur ?? 50;
      const cloudGate = cc < 15  ? cc / 15 * 0.35
                      : cc < 40  ? 0.35 + (cc - 15) / 25 * 0.65
                      : cc < 70  ? 1.0
                      : cc < 90  ? 1.0 - (cc - 70) / 20 * 0.65
                      : 0.35;

      // Elevation colour ramp: deep amber at horizon → near-white at zenith
      const el = this._sunElevation;
      const [rr, gg, bb] = el < 10 ? [255, 140,  60]
                         : el < 30 ? [255, 190,  80]
                         : el < 60 ? [255, 225, 130]
                                   : [255, 248, 210];

      if (cloudGate > 0.04) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const rayLen = Math.max(w, h) * 1.6;

        // Direction from sun toward canvas center — adapts as sun moves through the sky
        const baseDir = Math.atan2(h / 2 - sunY, w / 2 - sunX);
        // T1.4: UV, visibility, humidity and temperature modulate ray alpha and reach
        const _uvIdxRay = this._uvIdx ?? 5;
        const _visRay   = this._visibility ?? 10;
        const _humRay   = this._humidity ?? 50;
        const _tempRay  = this._temperature ?? 20;
        const _uvAlphaFactor  = lerp(0.05, 1.0, Math.min(_uvIdxRay / 8, 1));
        const _visReachFactor = lerp(0.4,  1.0, Math.min(_visRay / 10, 1));
        const _humidFactor    = lerp(1.0,  0.65, Math.min(_humRay / 100, 1));
        const _tempFactor     = lerp(0.88, 1.12, Math.min(Math.max(_tempRay, 0) / 40, 1));
        (this._overlayParticlesByType.ray || []).forEach(p => {
          // Dual-oscillator flicker — independent shimmer per beam
          const flicker = 0.55
            + 0.30 * Math.sin(now * p.freq1 + p.phase1)
            + 0.15 * Math.sin(now * p.freq2 + p.phase2);
          // Variable reach simulates cloud gap opening/closing
          const reach = Math.max(0.3, p.reachBase + 0.3 * Math.sin(now * p.reachFreq + p.reachPhase));
          const effLen = rayLen * reach * _visReachFactor;
          const effAlpha = scale * p.baseO * flicker * cloudGate * (light ? 0.55 : 1.0) * _uvAlphaFactor * _humidFactor * _tempFactor;
          if (effAlpha < 0.003) return;

          const angle = baseDir + p.angleOffset;
          const tipX = sunX + Math.cos(angle) * effLen;
          const tipY = sunY + Math.sin(angle) * effLen;
          const grd = ctx.createLinearGradient(sunX, sunY, tipX, tipY);
          grd.addColorStop(0,    `rgba(${rr},${gg},${bb},${effAlpha.toFixed(3)})`);
          grd.addColorStop(0.35, `rgba(${rr},${gg},${bb},${(effAlpha * 0.4).toFixed(3)})`);
          grd.addColorStop(1,    `rgba(${rr},${gg},${bb},0)`);

          const a1 = angle - p.width / 2;
          const a2 = angle + p.width / 2;
          ctx.globalAlpha = 1;
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.moveTo(sunX, sunY);
          ctx.lineTo(sunX + Math.cos(a1) * effLen, sunY + Math.sin(a1) * effLen);
          ctx.lineTo(sunX + Math.cos(a2) * effLen, sunY + Math.sin(a2) * effLen);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }

      const moteColor = light ? 'rgba(200,160,40,' : 'rgba(255,200,80,';
      (this._overlayParticlesByType.mote || []).forEach(p => {
        p.phase += 0.01;
        p.x += p.vx + Math.sin(p.phase) * 0.2;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.globalAlpha = scale * p.o * cloudGate;
        ctx.fillStyle = moteColor + p.o + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = this._alpha;
      return;
    }

    if (this._overlayType === 'diffuse') {
      const haloColor = light ? 'rgba(240,215,130,1)' : 'rgba(255,225,160,1)';
      (this._overlayParticlesByType.halo || []).forEach(p => {
        p.x += p.vx;
        p.phase += p.breatheSpeed;
        if (p.x > w + p.rx) p.x = -p.rx;
        if (p.x < -p.rx) p.x = w + p.rx;
        const breathe = 0.6 + 0.4 * Math.sin(p.phase);
        ctx.globalAlpha = scale * p.o * breathe;
        ctx.fillStyle = haloColor;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = this._alpha;
      return;
    }

    // ---- Night overlay (stars + aurora) ----
    const overlayStarDim  = 1 - this._moonBrightCur * 0.65;
    const overlayAurDim   = 1 - this._moonBrightCur * 0.65;
    // Aurora bands
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    (this._overlayParticlesByType.aurora || []).forEach((p, bandIndex) => {
      p.phase += p.speed;
      const t = p.phase;
      const yBase = p.yBaseInitial + Math.sin(t * 0.015 + bandIndex * 0.8) * 12;
      const lineWidth = 6 + 4 * Math.sin(t * 0.03 + bandIndex);
      const halfW = lineWidth / 2;
      // Build 10 control points
      const pts = [];
      for (let i = 0; i <= 9; i++) {
        const x = w * i / 9;
        const y = yBase
          + Math.sin(x * p.freq + t) * p.amplitude
          + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3;
        pts.push({ x, y });
      }
      // Vertical curtain gradient: transparent top → core colour → cool/warm fringe at bottom
      const midY = pts[Math.floor(pts.length / 2)].y;
      const isOvercast = ['rainy','pouring','storm','fog','snowy','hail','snowy-rainy','lightning','lightning-rainy'].includes(this._weatherCondition);
      const fringeHue = isOvercast ? 210 : 0;   // cool blue for rain, red for clear
      const fringeSat = isOvercast ? 50 : 80;
      const fringeLit = isOvercast ? 45 : 50;
      const fringeAlpha = isOvercast ? 0.25 : 0.4;
      const grad = ctx.createLinearGradient(0, midY - halfW, 0, midY + halfW);
        grad.addColorStop(0,   `hsla(${p.hue}, 80%, 60%, 0)`);
        grad.addColorStop(0.35, `hsla(${p.hue}, 85%, 60%, 1)`);
        grad.addColorStop(0.7,  `hsla(${p.hue}, 80%, 55%, 0.8)`);
        grad.addColorStop(1,    `hsla(${fringeHue}, ${fringeSat}%, ${fringeLit}%, ${fringeAlpha})`);
      ctx.globalAlpha = scale * p.o * overlayAurDim;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.shadowBlur = 0;
      ctx.stroke();
    });
    ctx.restore();
    ctx.shadowBlur = 0;

    // Shooting star
    const ss = (this._overlayParticlesByType.shootingStar || [])[0];
    if (ss) {
      ss.timer++;
      if (ss.active) {
        ss.x += ss.vx; ss.y += ss.vy; ss.life++;
        ss.trail.push({ x: ss.x, y: ss.y });
        if (ss.trail.length > 12) ss.trail.shift();
        ss.trail.forEach((pt, i) => {
          const fade = (i + 1) / ss.trail.length;
          ctx.globalAlpha = scale * fade * 0.6;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5 * fade, 0, Math.PI * 2);
          ctx.fill();
        });
        if (ss.life > 40 || ss.x > w || ss.y > h) { ss.active = false; ss.trail = []; }
      } else if (ss.timer > ss.interval) {
        ss.timer = 0; ss.interval = 400 + Math.random() * 800;
        ss.active = true; ss.life = 0;
        ss.x = Math.random() * w * 0.7; ss.y = Math.random() * h * 0.3;
        ss.vx = 4 + Math.random() * 4; ss.vy = 2 + Math.random() * 2;
      }
    }

    ctx.globalAlpha = this._alpha;
  }

  // ---- Private: render loop (from v9 renderWeatherParticles) ----

  _render(now) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const w = canvas.width, h = canvas.height;
    const state = this;
    const light = this._theme === 'light';
    const night = this._isNight;

    const _L = 0.015;
    state._sunElevCur += (state._sunElevation - state._sunElevCur) * _L;
    let _dSA = state._sunAzimuth - state._sunAzCur;
    if (_dSA > 180) _dSA -= 360; if (_dSA < -180) _dSA += 360;
    state._sunAzCur = (state._sunAzCur + _dSA * _L + 360) % 360;
    state._moonElevCur += (state._moonElevation - state._moonElevCur) * _L;
    let _dMA = state._moonAzimuth - state._moonAzCur;
    if (_dMA > 180) _dMA -= 360; if (_dMA < -180) _dMA += 360;
    state._moonAzCur = (state._moonAzCur + _dMA * _L + 360) % 360;
    if (state._cloudCovCur === null) state._cloudCovCur = state._cloudCoverage ?? 50;
    state._cloudCovCur   += ((state._cloudCoverage ?? 50) - state._cloudCovCur) * 0.005;
    // Lerp wind factor for smooth acceleration/deceleration
    if (state._windFactorCur === undefined) state._windFactorCur = state._windFactor ?? 0;
    state._windFactorCur += ((state._windFactor ?? 0) - state._windFactorCur) * 0.02;
    // T2.1: Layer stagger alpha — far fades in first, near last; reversal order inverted
    const _isRainingNow = ['rainy','pouring','storm','sleet'].includes(state._currentType);
    if (_isRainingNow) {
      state._rainLayerAlpha.far  = Math.min(state._rainLayerAlpha.far  + 0.03, 1.0);
      if (state._rainLayerAlpha.far  >= 0.5) state._rainLayerAlpha.mid  = Math.min(state._rainLayerAlpha.mid  + 0.03, 1.0);
      if (state._rainLayerAlpha.mid  >= 0.5) state._rainLayerAlpha.near = Math.min(state._rainLayerAlpha.near + 0.03, 1.0);
    } else {
      state._rainLayerAlpha.near = Math.max(state._rainLayerAlpha.near - 0.03, 0);
      if (state._rainLayerAlpha.near <= 0.5) state._rainLayerAlpha.mid  = Math.max(state._rainLayerAlpha.mid  - 0.03, 0);
      if (state._rainLayerAlpha.mid  <= 0.5) state._rainLayerAlpha.far  = Math.max(state._rainLayerAlpha.far  - 0.03, 0);
    }
    // Wind-feel tint — computed once per frame, shared by rain/fog/snow
    const _windFeel = (state._temperature != null && state._windSpeed != null)
      ? (state._temperature < 5 && state._windSpeed > 15 ? 'cold_bite'
        : state._temperature > 30 && state._windSpeed > 10 ? 'hot_blast'
        : 'neutral')
      : 'neutral';
    const _WIND_FEEL_TINT = { cold_bite: { r: -15, g: -10, b: 25 }, hot_blast: { r: 20, g: 8, b: -10 }, neutral: { r: 0, g: 0, b: 0 } };
    const _wft = _WIND_FEEL_TINT[_windFeel];
    state._moonBrightCur += (state._moonBrightness - state._moonBrightCur) * 0.01;
    const _elevScaleDay   = Math.max(0, Math.min(1, (state._sunElevCur + 18) / 28));
    state._twilightFactor = lerp(state._twilightFactor, computeTwilightTarget(state._sunElevCur), 0.015);
    const _elevScaleNight = Math.max(0, Math.min(1, -state._sunElevCur / 8));
    const _oaTarget = state._overlayType === 'night'
      ? state._overlayAlpha * _elevScaleNight
      : state._overlayAlpha * _elevScaleDay;
    state._overlayAlphaCur += (_oaTarget - state._overlayAlphaCur) * 0.02;
    // ISS position lerp — uses faster factor since ISS moves quickly
    if (state._issPos) {
      const _issL = 0.06;
      state._issElevCur += (state._issPos.elevation - state._issElevCur) * _issL;
      let _dIA = state._issPos.azimuth - state._issAzCur;
      if (_dIA > 180) _dIA -= 360; if (_dIA < -180) _dIA += 360;
      state._issAzCur = (state._issAzCur + _dIA * _issL + 360) % 360;
    } else {
      state._issElevCur += (-90 - state._issElevCur) * 0.04; // fade below horizon
    }

    ctx.clearRect(0, 0, w, h);

    // Draw ambient overlay (stars/aurora at night; sun rays/glow by day) behind weather particles
    const cloudDim = state._calcCloudDim(state._cloudCovCur, state._weatherCondition);

    // Persistent star field — rendered before overlay (aurora sits in front of stars)
    if (state._isNight && state._starField && state._starField.length) {
      const _tsa =
        state._twilightFactor < 0.25 ? 0 :
        state._twilightFactor < 0.50 ? (state._twilightFactor - 0.25) / 0.25 * 0.10 :
        state._twilightFactor < 0.75 ? 0.10 + (state._twilightFactor - 0.50) / 0.25 * 0.30 :
        state._twilightFactor < 1.00 ? 0.40 + (state._twilightFactor - 0.75) / 0.25 * 0.40 :
        1.0;
      state._renderStarField(ctx, now, _tsa);
    }

    // Cross-fade overlay types: render old overlay fading out, then new overlay fading in
    if (state._overlayTypePrev) {
      const prevAlpha = state._overlayAlphaPrevCur ?? 1;
      const newPrevAlpha = prevAlpha - 0.015;
      state._overlayAlphaPrevCur = Math.max(0, newPrevAlpha);
      if (state._overlayAlphaPrevCur <= 0) {
        state._overlayTypePrev = null;
        state._overlayParticlesPrev = [];
        state._overlayAlphaPrevCur = 0;
      } else {
        const savedAlpha = state._overlayAlphaCur;
        state._overlayAlphaCur = state._overlayAlphaPrevCur;
        const savedType = state._overlayType;
        const savedParticles = state._overlayParticlesByType;
        state._overlayType = state._overlayTypePrev;
        state._overlayParticlesByType = { [state._overlayTypePrev]: state._overlayParticlesPrev };
        state._renderOverlay(now, cloudDim);
        state._overlayType = savedType;
        state._overlayParticlesByType = savedParticles;
        state._overlayAlphaCur = savedAlpha;
      }
    }
    if (state._overlayType) state._renderOverlay(now, cloudDim);

    ctx.globalAlpha = state._alpha;

    // Golden hour warm overlay — daytime only, sun 0°–15°
    if (!state._isNight && state._sunElevCur >= 0 && state._sunElevCur <= 15) {
      state._renderGoldenHourOverlay(ctx, state._sunElevCur);
    }

    // ---- Sun disc — rendered for all daytime conditions, dimmed by cloud cover ----
    if (state._sunElevCur > -2) {
      const sunHorizonFade = Math.max(0, Math.min(1, state._sunElevCur / 5));
      if (cloudDim > 0 && sunHorizonFade > 0) {
        const elev = state._sunElevCur;
        const { x: sunX, y: sunY } = WeatherFX._getSunCanvasPos(w, h, state._sunAzCur, elev);
        ctx.save();
        ctx.globalAlpha = sunHorizonFade;

        // Color by elevation — deep orange at horizon, pale yellow-white at zenith
        let r, g, b;
        if (elev < 5) {
          r = 255; g = Math.round(130 + elev * 10); b = Math.round(15 + elev * 5);
        } else if (elev < 20) {
          const t = (elev - 5) / 15;
          r = 255; g = Math.round(180 + t * 35); b = Math.round(65 + t * 45);
        } else if (elev < 45) {
          const t = (elev - 20) / 25;
          r = 255; g = Math.round(215 + t * 20); b = Math.round(110 + t * 60);
        } else {
          r = 255; g = 242; b = 180;
        }

        // Disc slightly larger near horizon (atmospheric refraction / Moon illusion)
        const sunR = 28 + Math.max(0, (12 - elev) * 1.2);
        // Glow spreads wider near horizon (more atmosphere to scatter through)
        const glowMult = 3.5 + Math.max(0, (30 - elev) / 8);
        // Overcast: cloud scatters light broadly → wider diffuse patch
        const diffuseSpread = (cloudDim > 0 && cloudDim < 0.3) ? 1.8 : 1.0;
        const glowR = sunR * glowMult * diffuseSpread;
        // T1.4: UV/visibility modulate disc and glow — neutral fallbacks when not available
        const _uvIdx = this._uvIdx ?? 5;
        const _vis   = this._visibility ?? 10;
        const glowRVis = _vis < 2 ? 0 : glowR * lerp(1.5, 1.0, Math.min(_vis / 5, 1));
        // Overcast: use a flat base + scaled component so the patch stays visible
        // Needs higher alpha to show through the semi-transparent mesh gradient backdrop
        const glowAlpha = cloudDim >= 0.3
          ? (0.18 + (elev < 15 ? 0.10 : 0)) * cloudDim
          : cloudDim > 0 ? 0.10 + cloudDim * 0.25 : 0;

        // Atmospheric glow
        const sunGrd = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, glowRVis);
        sunGrd.addColorStop(0, `rgba(${r},${g},${b},${glowAlpha})`);
        sunGrd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.globalAlpha = state._alpha;
        ctx.fillStyle = sunGrd;
        ctx.beginPath();
        ctx.arc(sunX, sunY, glowRVis, 0, Math.PI * 2);
        ctx.fill();

        // Disc — only when sky is clear enough
        if (cloudDim >= 0.3) {
          const discAlpha = state._alpha * cloudDim;
          // UV brightens disc — UV 0→60% brightness, UV 6+→100%
          const discAlphaUV = discAlpha * lerp(0.6, 1.0, Math.min(_uvIdx / 6, 1));
          const discGrd = ctx.createRadialGradient(
            sunX - sunR * 0.30, sunY - sunR * 0.30, sunR * 0.05,
            sunX, sunY, sunR
          );
          discGrd.addColorStop(0,   `rgba(255,255,245,${discAlphaUV})`);
          discGrd.addColorStop(0.5, `rgba(${r},${Math.min(255, g + 5)},${b},${discAlphaUV})`);
          discGrd.addColorStop(1,   `rgba(${Math.round(r * 0.92)},${Math.round(g * 0.85)},${Math.round(Math.max(0, b * 0.70))},${(discAlphaUV * 0.72).toFixed(3)})`);
          ctx.fillStyle = discGrd;
          ctx.beginPath();
          ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
          ctx.fill();
          // Bloom ring — wide soft corona using screen compositing
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const bloom = ctx.createRadialGradient(sunX, sunY, sunR * 1.0, sunX, sunY, sunR * 3.5);
          bloom.addColorStop(0, `rgba(255, 240, 180, ${(0.15 * cloudDim).toFixed(3)})`);
          bloom.addColorStop(1, 'rgba(255, 240, 180, 0)');
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(sunX, sunY, sunR * 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Solar halo — lerped strength for smooth fade, shimmer for organic life
        const haloStrength = Math.max(0, cloudDim - 0.45) / 0.55;
        state._haloStrengthCur += (haloStrength - state._haloStrengthCur) * 0.006;
        const hs = state._haloStrengthCur;
        if (hs > 0.005 && elev > 5) {
          const shimmer  = 1 + 0.07 * Math.sin(now * 0.0005);
          const haloR    = sunR * 2.8 * (1 + 0.012 * Math.sin(now * 0.00032));
          const halfW    = sunR * (0.45 + (1 - hs) * 0.55) * shimmer;
          ctx.save();

          // Inner darkening — sky is depleted inside the 22° ring
          const darkGrd = ctx.createRadialGradient(sunX, sunY, sunR * 1.8, sunX, sunY, haloR - halfW);
          darkGrd.addColorStop(0, 'rgba(0,0,0,0)');
          darkGrd.addColorStop(1, `rgba(0,0,0,${(hs * 0.09).toFixed(3)})`);
          ctx.globalAlpha = state._alpha;
          ctx.fillStyle = darkGrd;
          ctx.beginPath();
          ctx.arc(sunX, sunY, haloR - halfW, 0, Math.PI * 2);
          ctx.fill();

          // Prismatic ring — screen composite makes it glow additively
          ctx.globalCompositeOperation = 'screen';
          const shimmerA = 1 + 0.08 * Math.sin(now * 0.0007 + 1.3);
          const ringGrd = ctx.createRadialGradient(sunX, sunY, haloR - halfW, sunX, sunY, haloR + halfW);
          ringGrd.addColorStop(0,    'rgba(255,  80,  20, 0)');
          ringGrd.addColorStop(0.18, `rgba(255,  80,  20, ${(hs * 0.70 * shimmerA).toFixed(3)})`);
          ringGrd.addColorStop(0.42, `rgba(255, 170,  80, ${(hs * 0.65 * shimmerA).toFixed(3)})`);
          ringGrd.addColorStop(0.68, `rgba(255, 255, 230, ${(hs * 0.55 * shimmerA).toFixed(3)})`);
          ringGrd.addColorStop(1,    'rgba(220, 235, 255, 0)');
          ctx.globalAlpha = state._alpha;
          ctx.beginPath();
          ctx.arc(sunX, sunY, haloR, 0, Math.PI * 2);
          ctx.strokeStyle = ringGrd;
          ctx.lineWidth = halfW * 2;
          ctx.stroke();

          ctx.restore();
        }
        ctx.globalAlpha = state._alpha;
        ctx.restore();
      }
    }

    // ---- Moon disc — rendered for all night conditions, dimmed by cloud cover ----
    if (state._moonElevCur > -2) {
      const moonHorizonFade = Math.max(0, Math.min(1, state._moonElevCur / 5));
      const skyWash = 0.9 * Math.max(0, Math.sin(state._sunElevCur * Math.PI / 180));
      const mb = state._moonBrightCur * moonHorizonFade * (1 - skyWash);
      const totalBright = mb * cloudDim; // phase × cloud transmittance
      if (totalBright > 0 || cloudDim > 0) {
        const moonX = w * (state._moonAzCur / 360);
        const moonY = h * (0.8 - state._moonElevCur / 90 * 0.75);
        const moonR  = 20 + mb * 14;
        const glowR  = moonR * (2.5 + mb * 2) * (1 + (1 - cloudDim) * 1.5);

        // Diffuse glow — always shown when moon is up (even behind clouds)
        // Rainy/storm/fog: cool blue-grey glow; clear/partlycloudy: warm yellow
        const isOvercast = ['rainy','pouring','storm','fog','snowy','hail','snowy-rainy','lightning','lightning-rainy'].includes(state._weatherCondition);
        const [mgR, mgG, mgB] = isOvercast ? [170, 185, 210] : [220, 220, 170];
        const glowAlpha = state._alpha * Math.max(totalBright * 0.25, cloudDim > 0 ? 0.04 : 0);
        const grd = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, glowR);
        grd.addColorStop(0, `rgba(${mgR},${mgG},${mgB},${glowAlpha})`);
        grd.addColorStop(1, `rgba(${mgR},${mgG},${mgB},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(moonX, moonY, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Sharp disc — only when cloud transmittance is high enough to see it
        if (cloudDim >= 0.35) {
          const discAlpha = state._alpha * (0.35 + mb * 0.65) * cloudDim;
          const discGrd = ctx.createRadialGradient(
            moonX - moonR * 0.3, moonY - moonR * 0.3, moonR * 0.1,
            moonX, moonY, moonR
          );
          discGrd.addColorStop(0,   `rgba(255,255,245,${discAlpha})`);
          discGrd.addColorStop(0.7, `rgba(225,225,210,${discAlpha * 0.9})`);
          discGrd.addColorStop(1,   `rgba(190,190,175,${discAlpha * 0.75})`);
          ctx.fillStyle = discGrd;
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
          ctx.fill();
        }
        // Lunar halo — same radial-gradient ring technique, silvery tones
        const moonHaloStrength = Math.max(0, cloudDim - 0.45) / 0.55 * mb;
        if (moonHaloStrength > 0 && state._moonElevCur > 5) {
          const mHaloR = moonR * 4.2;
          const mHalfW = moonR * 0.9;
          ctx.save();

          // Inner darkening
          const mDarkGrd = ctx.createRadialGradient(moonX, moonY, moonR * 1.8, moonX, moonY, mHaloR - mHalfW);
          mDarkGrd.addColorStop(0, 'rgba(0,0,0,0)');
          mDarkGrd.addColorStop(1, `rgba(0,0,0,${(moonHaloStrength * 0.05).toFixed(3)})`);
          ctx.globalAlpha = state._alpha;
          ctx.fillStyle = mDarkGrd;
          ctx.beginPath();
          ctx.arc(moonX, moonY, mHaloR - mHalfW, 0, Math.PI * 2);
          ctx.fill();

          // Ring — silvery: faint orange inner → white → transparent blue-silver outer
          const mRingGrd = ctx.createRadialGradient(moonX, moonY, mHaloR - mHalfW, moonX, moonY, mHaloR + mHalfW);
          mRingGrd.addColorStop(0,    'rgba(210, 185, 155, 0)');                                       // transparent inner edge
          mRingGrd.addColorStop(0.20, `rgba(210, 185, 155, ${(moonHaloStrength * 0.35).toFixed(3)})`);
          mRingGrd.addColorStop(0.50, `rgba(230, 230, 220, ${(moonHaloStrength * 0.30).toFixed(3)})`);
          mRingGrd.addColorStop(0.75, `rgba(220, 228, 245, ${(moonHaloStrength * 0.22).toFixed(3)})`);
          mRingGrd.addColorStop(1,    'rgba(200, 215, 240, 0)');
          ctx.globalAlpha = state._alpha;
          ctx.beginPath();
          ctx.arc(moonX, moonY, mHaloR, 0, Math.PI * 2);
          ctx.strokeStyle = mRingGrd;
          ctx.lineWidth = mHalfW * 2;
          ctx.stroke();

          ctx.restore();
        }
        ctx.globalAlpha = state._alpha;
      }
    }

    // ---- Milky Way band — faint galactic glow on clear nights ----
    if (night && state._galCenterEl > -20) {
      const mwTarget = state._isNight
        ? Math.max(0, Math.min(1, (state._galCenterEl + 20) / 40)) * cloudDim * (1 - state._moonBrightCur * 0.7) * 0.06
        : 0;
      state._milkyWayAlpha += (mwTarget - state._milkyWayAlpha) * 0.01;
      if (state._milkyWayAlpha > 0.002) {
        const { x: gcX, y: gcY } = WeatherFX._getSunCanvasPos(w, h, state._galCenterAz, Math.max(0, state._galCenterEl));
        // Draw a wide soft band through the galactic center — orientation based on azimuth
        // Band runs perpendicular to the direction from galactic center toward zenith on canvas
        const _zenithX = w * 0.5, _zenithY = h * 0.05;
        const bandAngle = Math.atan2(_zenithY - gcY, _zenithX - gcX) + Math.PI / 2;
        ctx.save();
        ctx.globalAlpha = state._milkyWayAlpha;
        // Core blob at galactic center
        const coreGrd = ctx.createRadialGradient(gcX, gcY, 0, gcX, gcY, h * 0.55);
        coreGrd.addColorStop(0,   'rgba(200, 210, 255, 0.9)');
        coreGrd.addColorStop(0.3, 'rgba(180, 195, 240, 0.4)');
        coreGrd.addColorStop(0.7, 'rgba(160, 180, 230, 0.15)');
        coreGrd.addColorStop(1,   'rgba(140, 165, 220, 0)');
        ctx.fillStyle = coreGrd;
        ctx.beginPath(); ctx.arc(gcX, gcY, h * 0.55, 0, Math.PI * 2); ctx.fill();
        // Extended band — two offset lobes perpendicular to galactic center direction
        const perpX = Math.cos(bandAngle + Math.PI / 2);
        const perpY = Math.sin(bandAngle + Math.PI / 2);
        [0.45, -0.45].forEach(t => {
          const bx = gcX + perpX * h * t;
          const by = gcY + perpY * h * t;
          const bGrd = ctx.createRadialGradient(bx, by, 0, bx, by, h * 0.38);
          bGrd.addColorStop(0,   'rgba(160, 175, 230, 0.5)');
          bGrd.addColorStop(0.5, 'rgba(140, 160, 215, 0.15)');
          bGrd.addColorStop(1,   'rgba(120, 145, 200, 0)');
          ctx.fillStyle = bGrd;
          ctx.beginPath(); ctx.arc(bx, by, h * 0.38, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }
    }

    // ---- Planets — bright dots at calculated sky positions ----
    if (night && state._planets.length) {
      const moonWash = state._moonBrightCur * 0.55; // full moon dims all but brightest planets
      state._planets.forEach(p => {
        if (p.elevation < 1) return;
        const horizFade = Math.min(1, p.elevation / 8);
        const pAlpha = state._alpha * cloudDim * (1 - moonWash) * horizFade;
        if (pAlpha < 0.02) return;
        const { x: px, y: py } = WeatherFX._getSunCanvasPos(w, h, p.azimuth, p.elevation);
        const pr = p.radius;
        const [r, g, b] = p.color;
        // Glow
        const pGlowR = pr * 4.5;
        const pGrd = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pGlowR);
        pGrd.addColorStop(0,   `rgba(${r},${g},${b},${(pAlpha * 0.35).toFixed(3)})`);
        pGrd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = pGrd;
        ctx.beginPath(); ctx.arc(px, py, pGlowR, 0, Math.PI * 2); ctx.fill();
        // Sharp disc
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = state._alpha;
    }

    // ---- ISS — bright moving dot when visible pass ----
    if (state._issElevCur > 5 && night) {
      const { x: issX, y: issY } = WeatherFX._getSunCanvasPos(w, h, state._issAzCur, state._issElevCur);
      const issAlpha = state._alpha * Math.min(1, (state._issElevCur - 5) / 15) * cloudDim;
      if (issAlpha > 0.05) {
        // Bright white-blue dot with a small glow
        const issGrd = ctx.createRadialGradient(issX, issY, 0, issX, issY, 12);
        issGrd.addColorStop(0,   `rgba(220,240,255,${(issAlpha * 0.6).toFixed(3)})`);
        issGrd.addColorStop(1,   'rgba(200,225,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = issGrd;
        ctx.beginPath(); ctx.arc(issX, issY, 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = issAlpha;
        ctx.fillStyle = 'rgb(240,248,255)';
        ctx.beginPath(); ctx.arc(issX, issY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = state._alpha;
      }
    }

    // ---- Rainbow arc — rainy/pouring daytime, sun above 5° ----
    const isRainyCond = state._weatherCondition === 'rainy' || state._weatherCondition === 'pouring';
    if (isRainyCond && !night && state._sunElevCur > 5) {
      state._rainbowFade = Math.min(1, state._rainbowFade + 1 / 180); // fade in over ~3s at 60fps
    } else {
      state._rainbowFade = Math.max(0, state._rainbowFade - 0.05);    // fade out quickly
    }
    if (state._rainbowFade > 0 && isRainyCond && !night && state._sunElevCur > 5) {
      const antisolarAz = (state._sunAzCur + 180) % 360;
      const arcX = w * (antisolarAz / 360);
      const arcRadius = h * 0.55;
      const arcCenterY = h * (0.62 + (state._sunElevCur / 90) * 0.35);
      const baseAlpha = (state._weatherCondition === 'pouring' ? 0.28 : 0.22)
        * state._rainbowFade * state._alpha;
      // 6 spectral bands, inner (red) to outer (violet), each 5px wide
      const BANDS = [
        { r: 255, g:  30, b:   0, am: 1.00, dr: -2.5 },
        { r: 255, g: 120, b:   0, am: 0.90, dr: -1.0 },
        { r: 255, g: 230, b:   0, am: 0.85, dr:  0.5 },
        { r:   0, g: 200, b:  60, am: 0.80, dr:  2.0 },
        { r:   0, g:  80, b: 255, am: 0.85, dr:  3.5 },
        { r: 100, g:   0, b: 220, am: 0.75, dr:  5.0 },
      ];
      ctx.lineWidth = 5;
      BANDS.forEach(band => {
        ctx.globalAlpha = baseAlpha * band.am;
        ctx.strokeStyle = `rgb(${band.r},${band.g},${band.b})`;
        ctx.beginPath();
        // anticlockwise=true draws the top arc (hill shape) when center is at/below horizon
        ctx.arc(arcX, arcCenterY, arcRadius + band.dr * 5, Math.PI, 0, true);
        ctx.stroke();
      });
      ctx.globalAlpha = state._alpha;
    }

    if ((state._particlesByType.fogBlob || []).length && state._currentType !== 'fog') {
      const _fogOverlayBase = light
        ? (night ? [90,90,110] : [160,160,170])
        : (night ? [120,120,140] : [200,200,210]);
      const fogColor = `rgba(${Math.min(255,Math.max(0,_fogOverlayBase[0]+_wft.r))},${Math.min(255,Math.max(0,_fogOverlayBase[1]+_wft.g))},${Math.min(255,Math.max(0,_fogOverlayBase[2]+_wft.b))},1)`;
      const t = now * 0.001;
      const gustRatio_fog = Math.min(Math.max(state._windGustSpeed / Math.max(state._windSpeed, 1), 1), 3.0);
      const gustFactor_fog = 1 + (gustRatio_fog - 1) * 0.5 * Math.sin(now * 0.0007 + 3.8);
      (state._particlesByType.fogBlob || []).forEach(p => {
        p.x += p.vx * gustFactor_fog;
        if (p.x > w + p.rx) p.x = -p.rx;
        if (p.x < -p.rx) p.x = w + p.rx;
        const y = p.yBase + Math.sin(p.x * 0.04 + t * 0.025 + p.blobIndex) * p.amp;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = fogColor;
        ctx.beginPath();
        ctx.ellipse(p.x, y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;
    }

    if (state._currentType === 'sunny') {
      // God rays
      const rayColor = light ? 'rgba(255,190,50,1)' : 'rgba(255,220,100,1)';
      const { x: _raySunX, y: _raySunY } = WeatherFX._getSunCanvasPos(w, h, state._sunAzCur, state._sunElevCur);
      // Crepuscular rays: full below 6.5°, fade to invisible at 15°
      const _rayElevFade = Math.max(0, 1 - Math.max(0, state._sunElevCur - 6.5) / 8.5);
      if (_rayElevFade > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        (state._particlesByType.ray || []).forEach(p => {
          if (state._sunElevCur <= 0) return;
          const pulse = 0.7 + 0.3 * Math.sin(now * 0.001 * p.speed + p.phase);
          const cx = _raySunX, cy = _raySunY;
          const aMid = p.angle;
          const rayLen = Math.max(w, h) * 1.5;
          const tipX = cx + Math.cos(aMid) * rayLen;
          const tipY = cy + Math.sin(aMid) * rayLen;
          // Linear gradient: bright at sun origin, transparent at tip
          const rayGrd = ctx.createLinearGradient(cx, cy, tipX, tipY);
          rayGrd.addColorStop(0,   `rgba(255, 230, 140, ${(p.o * pulse * _rayElevFade * (light ? 0.5 : 0.7)).toFixed(3)})`);
          rayGrd.addColorStop(0.4, `rgba(255, 220, 120, ${(p.o * pulse * _rayElevFade * (light ? 0.2 : 0.35)).toFixed(3)})`);
          rayGrd.addColorStop(1,   'rgba(255, 220, 100, 0)');
          const a1 = p.angle - p.width / 2, a2 = p.angle + p.width / 2;
          ctx.globalAlpha = state._alpha;
          ctx.fillStyle = rayGrd;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a1) * rayLen, cy + Math.sin(a1) * rayLen);
          ctx.lineTo(cx + Math.cos(a2) * rayLen, cy + Math.sin(a2) * rayLen);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }
      ctx.globalAlpha = state._alpha;
      // Dust motes with gentle drift
      const moteColor = light ? 'rgba(200,160,40,' : 'rgba(255,200,80,';
      const moteShadow = light ? 'rgba(200,160,40,0.2)' : 'rgba(255,200,80,0.3)';
      (state._particlesByType.mote || []).forEach(p => {
        p.phase += 0.01;
        p.x += p.vx + Math.sin(p.phase) * 0.2;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.fillStyle = moteColor + p.o + ')';
        ctx.shadowBlur = 6;
        ctx.shadowColor = moteShadow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

    } else if (state._currentType === 'pouring') {
      // Heavy downpour streaks — darker, denser, more angled
      const dropColor = light
        ? (night ? 'rgba(30,50,105,1)' : 'rgba(55,80,145,1)')
        : (night ? 'rgba(85,115,175,1)' : 'rgba(120,155,210,1)');
      const windFactor = state._windFactorCur ?? 0;
      const downwindRad = ((state._windBearing + 180) % 360) * Math.PI / 180;
      const windDx = Math.sin(downwindRad);
      state._renderDrops(ctx, state._particlesByType.drop || [], now, night, light, windFactor, windDx, state._alpha);
      (state._particlesByType.ripple || []).forEach(p => {
        p.life++;
        if (p.life > p.lifespan) {
          p.life = 0; p.r = 0; p.x = Math.random() * w;
          p.y = h * (0.82 + Math.random() * 0.18); p.o = 0.18;
        }
        p.r = (p.life / p.lifespan) * p.maxR;
        const fade = 1 - p.life / p.lifespan;
        ctx.globalAlpha = state._alpha * p.o * fade;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'rainy' || state._currentType === 'storm') {
      // Rain streaks
      const dropColor = light
        ? (night ? 'rgba(50,70,120,1)' : 'rgba(80,110,160,1)')
        : (night ? 'rgba(100,130,190,1)' : 'rgba(150,180,220,1)');
      const rippleColor = dropColor;
      const windFactor = state._windFactorCur ?? 0;
      const downwindRad = ((state._windBearing + 180) % 360) * Math.PI / 180;
      const windDx = Math.sin(downwindRad);
      state._renderDrops(ctx, state._particlesByType.drop || [], now, night, light, windFactor, windDx, state._alpha);
      // Splash ripples
      (state._particlesByType.ripple || []).forEach(p => {
        p.life++;
        if (p.life > p.lifespan) {
          p.life = 0; p.r = 0; p.x = Math.random() * w;
          p.y = h * (0.85 + Math.random() * 0.15);
          p.o = 0.15;
        }
        p.r = (p.life / p.lifespan) * p.maxR;
        const fade = 1 - p.life / p.lifespan;
        ctx.globalAlpha = state._alpha * p.o * fade;
        ctx.strokeStyle = rippleColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Lightning bolt + flash for storms
      const lp = (state._particlesByType.lightning || [])[0];
      if (lp) {
        // Step 8: gate particle interval by condition + prob
        state._particles.filter(p => p.kind === 'lightning').forEach(p => {
          const conditionQualifies = (state._weatherCondition || '').includes('lightning');
          const probQualifies = (state._thunderstormProb ?? 0) >= 25;
          if (!conditionQualifies || !probQualifies) {
            p.interval = Infinity;
          }
        });

        if (!lp._lastBoltTime) lp._lastBoltTime = now - Math.min(lp.interval, 15000); // initialise on first frame

        // Step 3: multi-stroke decay — if currently in a stroke, decay flashAlpha
        if (lp.flashAlpha > 0 && now >= lp._strokePauseUntil) {
          const strokeDef = LIGHTNING_STROKE_PAUSES[lp._strokeIndex] ?? LIGHTNING_STROKE_PAUSES[LIGHTNING_STROKE_PAUSES.length - 1];
          const dtMs = Math.min(now - (lp._lastDecayTime ?? now), 100);
          lp._lastDecayTime = now;
          lp.flashAlpha = Math.max(0, lp.flashAlpha - (strokeDef.decay / 1000) * dtMs);
          if (lp.flashAlpha < 0.05) {
            // This stroke is done — check if more strokes remain
            const nextIndex = lp._strokeIndex + 1;
            if (nextIndex < lp._strokeSequence) {
              const pause = strokeDef.pauseMin + Math.random() * (strokeDef.pauseMax - strokeDef.pauseMin);
              lp._strokePauseUntil = now + pause;
              lp._strokeIndex = nextIndex;
              const nextDef = LIGHTNING_STROKE_PAUSES[nextIndex] ?? LIGHTNING_STROKE_PAUSES[LIGHTNING_STROKE_PAUSES.length - 1];
              lp.flashAlpha = nextDef.alpha;
            } else {
              lp.flashAlpha = 0;
              lp._strokeIndex = 0;
              lp._strokePauseUntil = 0;
            }
          }
        }

        // Step 6: pressure-based bolt colour
        let _bR, _bG, _bB;
        if (state._pressure != null) {
          const _pT = Math.min(Math.max((state._pressure - 1005) / 10, 0), 1);
          _bR = Math.round(255 + (180 - 255) * _pT);
          _bG = 200;
          _bB = Math.round(80  + (255 - 80)  * _pT);
        } else {
          _bR = 180; _bG = 200; _bB = 255; // null pressure fallback
        }
        const boltColor = light ? 'rgba(60,60,120,1)' : `rgb(${_bR},${_bG},${_bB})`;
        const boltShadow = light ? 'rgba(60,60,120,0.6)' : `rgba(${_bR},${_bG},${_bB},0.8)`;

        if (lp.bolt && lp.flashAlpha > 0 && now >= lp._strokePauseUntil) {
          ctx.strokeStyle = boltColor;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = boltShadow;
          state._drawBolt(ctx, lp.bolt, state._alpha * lp.flashAlpha * 0.7);
          ctx.shadowBlur = 0;
        }

        if ((now - lp._lastBoltTime) > lp.interval && lp.flashAlpha <= 0) {
          lp._lastBoltTime = now;
          lp.interval = state._getLightningInterval();
          lp._strokeSequence = 2 + Math.floor(Math.random() * 3);
          lp._strokeIndex = 0;
          lp._strokePauseUntil = 0;

          // Step 5: thunderstormProb-driven bolt depth + branch chance
          const _prob = state._thunderstormProb ?? 50;
          const boltDepth = 2 + Math.floor(_prob / 25); // 2–5
          const branchChance = 0.1 + (_prob / 100) * 0.3; // 0.1–0.4 (stored for future use)

          const bx = w * (0.2 + Math.random() * 0.6);
          state._boltCache = state._generateBolt(bx, 0, bx + (Math.random() - 0.5) * w * 0.2, h * 0.6, boltDepth);
          lp.bolt = state._boltCache;
          lp.flashAlpha = LIGHTNING_STROKE_PAUSES[0].alpha;
          lp._lastDecayTime = now;

          // Step 7: UV flash gating
          let flashAlpha;
          if (!state._isNight && (state._uvIdx ?? 0) >= 6) {
            flashAlpha = lerp(0.25, 0.15, ((state._uvIdx ?? 6) - 6) / 6);
          } else {
            flashAlpha = lerp(0.8, 1.0, Math.random());
          }
          const peakAlpha = (state._weatherCondition === 'lightning' ? 0.45 : 0.35) * flashAlpha;
          state._flashAlpha = Math.max(state._flashAlpha, peakAlpha);
          let glowRadius = w * 0.5;
          if ((state._precipIntensity ?? 0) > 3) glowRadius *= 1.4;
          state._flashDecay = peakAlpha / 7.2; // ~120ms at 60fps

          // Step 4: sheet lightning for distant storms
          const sheetLightningActive = (state._precipIntensity ?? 0) < 1.0;
          if (sheetLightningActive) {
            state._sheetLightningAlpha = Math.min(state._sheetLightningAlpha + 0.015, 0.15);
          }
        }

        // Step 4: decay sheet lightning continuously
        const sheetLightningActive = (state._precipIntensity ?? 0) < 1.0;
        if (!sheetLightningActive) {
          state._sheetLightningAlpha = Math.max(state._sheetLightningAlpha - 0.003, 0);
        }

        // Step 4: render sheet lightning as diffuse radial gradient over cloud centroid
        const sheetAlpha = state._sheetLightningAlpha * cloudDim;
        if (sheetAlpha > 0.01) {
          const cloudParticles = state._particles.filter(p => p.kind === 'cloud' || p.kind === 'cloudy');
          if (cloudParticles.length > 0) {
            const cx = cloudParticles.reduce((s, p) => s + p.x, 0) / cloudParticles.length;
            const cy = cloudParticles.reduce((s, p) => s + p.y, 0) / cloudParticles.length;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
            grad.addColorStop(0, `rgba(255, 255, 200, ${sheetAlpha})`);
            grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'night') {
      const mb = state._moonBrightness;
      const starDim  = 1 - mb * 0.65; // full moon washes out stars
      const auroraDim = 1 - mb * 0.65;

      // Aurora borealis
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      (state._particlesByType.aurora || []).forEach((p, bandIndex) => {
        p.phase += p.speed;
        const t = p.phase;
        const yBase = p.yBaseInitial + Math.sin(t * 0.015 + bandIndex * 0.8) * 12;
        const lineWidth = 6 + 4 * Math.sin(t * 0.03 + bandIndex);
        const halfW = lineWidth / 2;
        const pts = [];
        for (let i = 0; i <= 9; i++) {
          const x = w * i / 9;
          const y = yBase
            + Math.sin(x * p.freq + t) * p.amplitude
            + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3;
          pts.push({ x, y });
        }
        const midY = pts[Math.floor(pts.length / 2)].y;
        const grad = ctx.createLinearGradient(0, midY - halfW, 0, midY + halfW);
        grad.addColorStop(0,    `hsla(${p.hue}, 80%, 60%, 0)`);
        grad.addColorStop(0.35, `hsla(${p.hue}, 85%, 60%, 1)`);
        grad.addColorStop(0.7,  `hsla(${p.hue}, 80%, 55%, 0.8)`);
        grad.addColorStop(1,    `hsla(0, 80%, 50%, 0.4)`);
        ctx.globalAlpha = state._alpha * p.o * auroraDim;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = 0;
        ctx.stroke();
      });
      ctx.restore();
      ctx.shadowBlur = 0;
      // Twinkling stars — dimmed by moonlight
      (state._particlesByType.star || []).forEach(p => {
        p.phase += p.speed * 0.02;
        const twinkle = 0.2 + 0.8 * ((Math.sin(p.phase) + 1) / 2);
        ctx.globalAlpha = state._alpha * twinkle * p.brightness * 0.5 * starDim;
        ctx.fillStyle = p.color || '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.r > 1.2) {
          ctx.globalAlpha = state._alpha * twinkle * p.brightness * 0.15 * starDim;
          ctx.strokeStyle = p.color || '#fff';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x - p.r * 2, p.y);
          ctx.lineTo(p.x + p.r * 2, p.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.r * 2);
          ctx.lineTo(p.x, p.y + p.r * 2);
          ctx.stroke();
        }
      });
      // Shooting star — less frequent in bright moonlight
      const ss = (state._particlesByType.shootingStar || [])[0];
      if (ss) {
        ss.timer++;
        if (ss.active) {
          ss.x += ss.vx; ss.y += ss.vy; ss.life++;
          ss.trail.push({ x: ss.x, y: ss.y });
          if (ss.trail.length > 12) ss.trail.shift();
          ss.trail.forEach((pt, i) => {
            const fade = (i + 1) / ss.trail.length;
            ctx.globalAlpha = state._alpha * fade * 0.6 * starDim;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.5 * fade, 0, Math.PI * 2);
            ctx.fill();
          });
          if (ss.life > 40 || ss.x > w || ss.y > h) { ss.active = false; ss.trail = []; }
        } else if (ss.timer > ss.interval) {
          ss.timer = 0;
          // Full moon doubles the interval (harder to see shooting stars)
          ss.interval = (400 + Math.random() * 800) * (1 + mb);
          ss.active = true; ss.life = 0;
          ss.x = Math.random() * w * 0.7; ss.y = Math.random() * h * 0.3;
          ss.vx = 4 + Math.random() * 4; ss.vy = 2 + Math.random() * 2;
        }
      }
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'snowy') {
      // Apply wind-feel tint to snowflake base colour (alpha appended per-particle)
      const _flakeBase = light
        ? (night ? [100,110,140] : [140,150,170])
        : (night ? [180,195,230] : [255,255,255]);
      const gustRatio_snow = Math.min(Math.max(state._windGustSpeed / Math.max(state._windSpeed, 1), 1), 3.0);
      const gustFactor_snow = 1 + (gustRatio_snow - 1) * 0.5 * Math.sin(now * 0.0007 + 5.1);
      (state._particlesByType.flake || []).forEach(p => {
        p.y += p.vy;
        // Step 5: dual-frequency Kármán vortex sway (replaces single-frequency formula)
        const wf = state._windFactorCur ?? 0;
        const wDx = Math.sin(((state._windBearing + 180) % 360) * Math.PI / 180);
        const windDrift = wDx * wf * 2.0 * (p.depth ?? 0.5) * gustFactor_snow;
        const f = 0.0008 + (p.depth ?? 0.5) * 0.0004;
        const phase = p.phase ?? p.sway;
        const sway = p.swayAmp * Math.sin(now * f + phase)
                   + 0.4 * p.swayAmp * Math.sin(now * f * 1.7 + phase * 1.3);
        p.x += sway + windDrift;
        p.angle += 0.008;
        if (p.y > h + 10) {
          if (p.shape === 'dendrite') state._activeDendrites = Math.max(0, (state._activeDendrites ?? 1) - 1);
          p.y = -10; p.x = Math.random() * w;
        }
        if (p.x > w + 10) p.x = -10;

        // Step 6: dew-point sparkle — compute effective fill colour
        const pr = p.r, px = p.x, py = p.y;
        let [fr, fg, fb] = [_flakeBase[0] + _wft.r, _flakeBase[1] + _wft.g, _flakeBase[2] + _wft.b];
        if (state._temperature !== null && state._temperature < 0) {
          const dewSpread = state._temperature - (state._dewPoint ?? state._temperature);
          const sparkleIntensity = Math.min(Math.max(dewSpread / 8, 0), 1);
          fr = Math.round(fr + (255 - fr) * sparkleIntensity);
          fg = Math.round(fg + (255 - fg) * sparkleIntensity);
          fb = Math.round(fb + (255 - fb) * sparkleIntensity);
        }
        const fillC = `rgba(${Math.min(255,Math.max(0,fr))},${Math.min(255,Math.max(0,fg))},${Math.min(255,Math.max(0,fb))},`;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.angle);

        // Step 7: shape-based rendering
        const shape = p.shape || 'dendrite';
        ctx.beginPath();
        if (shape === 'circle') {
          ctx.fillStyle = fillC + p.o + ')';
          ctx.arc(0, 0, pr, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 'hexplate') {
          ctx.fillStyle = fillC + p.o + ')';
          ctx.moveTo(pr * Math.cos(0), pr * Math.sin(0));
          for (let k = 1; k <= 6; k++) {
            ctx.lineTo(pr * Math.cos(k * Math.PI / 3), pr * Math.sin(k * Math.PI / 3));
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // dendrite — 6 arms with 2 side branches each at 60°
          ctx.strokeStyle = fillC + p.o + ')';
          ctx.lineWidth = 0.8;
          for (let arm = 0; arm < 6; arm++) {
            const angle = arm * Math.PI / 3;
            const ax = Math.cos(angle) * pr;
            const ay = Math.sin(angle) * pr;
            ctx.moveTo(0, 0);
            ctx.lineTo(ax, ay);
            const branch = pr * 0.35;
            for (const frac of [0.35, 0.65]) {
              const bx = Math.cos(angle) * pr * frac;
              const by = Math.sin(angle) * pr * frac;
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle + Math.PI / 3) * branch, by + Math.sin(angle + Math.PI / 3) * branch);
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle - Math.PI / 3) * branch, by + Math.sin(angle - Math.PI / 3) * branch);
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      });
      (state._particlesByType.bokeh || []).forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w; }
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = light
          ? (night ? 'rgba(100,110,140,1)' : 'rgba(140,150,170,1)')
          : (night ? 'rgba(180,195,230,1)' : 'rgba(255,255,255,1)');
        ctx.shadowBlur = 20;
        ctx.shadowColor = light
          ? (night ? 'rgba(100,110,140,0.2)' : 'rgba(140,150,170,0.2)')
          : (night ? 'rgba(180,195,230,0.3)' : 'rgba(255,255,255,0.3)');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Aperture blades — 6 faint lines at 60° intervals
        ctx.shadowBlur = 0;
        const bladeAlpha = state._alpha * p.o * 0.35;
        if (bladeAlpha > 0.001) {
          ctx.globalAlpha = bladeAlpha;
          ctx.strokeStyle = light
            ? (night ? 'rgba(100,110,140,1)' : 'rgba(140,150,170,1)')
            : (night ? 'rgba(180,195,230,1)' : 'rgba(255,255,255,1)');
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          for (let b = 0; b < 6; b++) {
            const ang = p.angle + b * Math.PI / 3;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(ang) * p.r * 0.8, p.y + Math.sin(ang) * p.r * 0.8);
          }
          ctx.stroke();
        }
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'fog') {
      // Apply wind-feel tint to fog blob base colour
      const _fogBase = light
        ? (night ? [90,90,110] : [160,160,170])
        : (night ? [120,120,140] : [200,200,210]);
      const fogColor = `rgba(${Math.min(255,Math.max(0,_fogBase[0]+_wft.r))},${Math.min(255,Math.max(0,_fogBase[1]+_wft.g))},${Math.min(255,Math.max(0,_fogBase[2]+_wft.b))},1)`;
      const t = now * 0.001;
      const gustRatio_fog2 = Math.min(Math.max(state._windGustSpeed / Math.max(state._windSpeed, 1), 1), 3.0);
      const gustFactor_fog2 = 1 + (gustRatio_fog2 - 1) * 0.5 * Math.sin(now * 0.0007 + 3.8);
      (state._particlesByType.fogBlob || []).forEach(p => {
        // C10: Wind already baked into p.vx at spawn time; gust modulates movement each frame
        p.x += p.vx * gustFactor_fog2;
        if (p.x > w + p.rx) p.x = -p.rx;
        if (p.x < -p.rx) p.x = w + p.rx;
        const y = p.yBase + Math.sin(p.x * 0.04 + t * 0.025 + p.blobIndex) * p.amp;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = fogColor;
        ctx.beginPath();
        ctx.ellipse(p.x, y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'cloudy') {
      // Use lerped wind factor for smooth acceleration
      const windFactor = state._windFactorCur ?? 0;
      const windDx     = state._windDx;
      const windDy     = state._windDyRender; // +1 = downward on canvas (negated vs spawn convention)
      // Sort by layer (far → near) for correct depth order
      const clouds = [...(state._particlesByType.cloud || [])].sort((a, b) => a.layer - b.layer);
      const gustRatio_cloud = Math.min(Math.max(state._windGustSpeed / Math.max(state._windSpeed, 1), 1), 3.0);
      clouds.forEach(p => {
        // Advance position — baseSpeed always rightward, wind adds true directional component (spec §5)
        // Gust phase offset differs by depth layer: far=1.2, near=2.5
        const _cloudGustPhase = p.layer === 0 ? 1.2 : 2.5;
        const gustFactor_cloud = 1 + (gustRatio_cloud - 1) * 0.5 * Math.sin(now * 0.0007 + _cloudGustPhase);
        p.x     += (p.vx + windFactor * p.windMult * windDx) * gustFactor_cloud;
        p.yBase += windFactor * p.windMult * windDy * 0.15;
        // Y-bob — p.y derived from yBase so vertical error never accumulates (spec §6)
        p.y = p.yBase + Math.sin(now * p.bobSpeed + p.phase) * p.bobAmp;
        // 4-edge wrapping (spec §5)
        if (p.x     >  w + p.r * 2) { p.x = -p.r * 2;      p.yBase = Math.random() * h; }
        if (p.x     < -p.r * 2)     { p.x =  w + p.r * 2;  p.yBase = Math.random() * h; }
        if (p.yBase >  h + p.r)     { p.yBase = -p.r;       p.x = Math.random() * w; }
        if (p.yBase < -p.r)         { p.yBase =  h + p.r;   p.x = Math.random() * w; }

        // T2.3 item 5: per-frame morph update
        if (p._morphProgress != null && p._morphFrom && p._morphTo) {
          p._morphProgress += 0.001; // ~16s per cycle at 60fps
          if (p._morphProgress >= 1.0) {
            p._morphFrom = p._morphTo.map(l => ({ ...l }));
            p._morphTo = state._generateCloudLobes(p.archetype);
            p._morphProgress = 0;
            // Clamp both arrays to same length to prevent silent lobe freezing
            const morphLen = Math.min(p._morphFrom.length, p._morphTo.length);
            p._morphFrom = p._morphFrom.slice(0, morphLen);
            p._morphTo = p._morphTo.slice(0, morphLen);
            p.lobes = p.lobes.slice(0, morphLen);
          }
          const t = p._morphProgress;
          const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
          p.lobes.forEach((l, i) => {
            const from = p._morphFrom[i];
            const to   = p._morphTo[i];
            if (!from || !to) return;
            const wobble = Math.sin(t * Math.PI * 2 + i * 1.3 + p.x * 0.01) * 0.03 * (1 - t);
            l.dx = from.dx + (to.dx - from.dx) * ease + wobble;
            l.dy = from.dy + (to.dy - from.dy) * ease + wobble * 0.5;
            l.rs = from.rs + (to.rs - from.rs) * ease;
          });
          p.offDirty = true; // lobes changed → regen offscreen
        }

        // T2.3 item 6: precipProbability bucket dirty-flag
        const _curBucket = Math.floor((state._precipProbability ?? 0) / 25);
        if (p._precipThresholdBucket !== _curBucket) {
          p._precipThresholdBucket = _curBucket;
          p.offDirty = true;
        }

        // Regen offscreen canvas if dirty (morph or colour change)
        if (p.offDirty) {
          state._renderCloudToOffscreen(p, state._isNight);
          p.offDirty = false;
        }

        const baseAlpha = state._alpha * p.alpha;
        // Blit pre-rendered off-screen canvas (created once at spawn in _renderCloudToOffscreen)
        if (p.off) {
          const prevAlpha = ctx.globalAlpha;
          const prevComp = ctx.globalCompositeOperation;
          ctx.globalAlpha = baseAlpha;
          if (p.archetype === 'cirrus') ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(p.off, p.x - p.ox, p.y - p.oy);
          ctx.globalAlpha = prevAlpha;
          ctx.globalCompositeOperation = prevComp;
        }

        // Moon/sun scatter highlight at cloud top (screen pass — runs on main canvas after blit)
        // Overcast: cool blue highlight; Clear: warm white
        const isOvercast = ['rainy','pouring','storm','fog','snowy','hail','snowy-rainy','lightning','lightning-rainy'].includes(state._weatherCondition);
        const [hr, hg, hb] = isOvercast ? [180, 200, 230] : [255, 255, 240];
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const hx = p.x - p.r * 0.15, hy = p.y - p.r * 0.25, hr2 = p.r * 0.3;
        const hgrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr2);
        const highlightAlpha = night ? state._alpha * 0.04 : state._alpha * 0.12;
        hgrd.addColorStop(0, `rgba(${hr},${hg},${hb},${highlightAlpha})`);
        hgrd.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
        ctx.fillStyle = hgrd;
        ctx.beginPath();
        ctx.arc(hx, hy, hr2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'sleet') {
      // Rain streaks
      const dropColor = light
        ? (night ? 'rgba(60,85,130,1)' : 'rgba(100,130,180,1)')
        : (night ? 'rgba(110,140,190,1)' : 'rgba(160,190,230,1)');
      const windFactor = state._windFactorCur ?? 0;
      const downwindRad = ((state._windBearing + 180) % 360) * Math.PI / 180;
      const windDx = Math.sin(downwindRad);
      state._renderDrops(ctx, state._particlesByType.drop || [], now, night, light, windFactor, windDx, state._alpha);
      // Ice pellets
      const pelletColor = light
        ? (night ? 'rgba(120,140,170,1)' : 'rgba(180,200,230,1)')
        : (night ? 'rgba(160,180,220,1)' : 'rgba(220,235,255,1)');
      (state._particlesByType.pellet || []).forEach(p => {
        p.x += p.vx;
        p.y += p.speed;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = pelletColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      // Splash ripples
      (state._particlesByType.ripple || []).forEach(p => {
        p.life++;
        if (p.life > p.lifespan) {
          p.life = 0; p.r = 0; p.x = Math.random() * w;
          p.y = h * (0.85 + Math.random() * 0.15); p.o = 0.12;
        }
        p.r = (p.life / p.lifespan) * p.maxR;
        const fade = 1 - p.life / p.lifespan;
        ctx.globalAlpha = state._alpha * p.o * fade;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = state._alpha;
    }

    // Visibility fog overlay — renders over any condition when vis < 5km, not gated by condition string
    if (state._currentType !== 'fog' && this._visibility != null && this._visibility < 5) {
      const fogColor = light
        ? (night ? 'rgba(90,90,110,1)' : 'rgba(160,160,170,1)')
        : (night ? 'rgba(120,120,140,1)' : 'rgba(200,200,210,1)');
      const t = now * 0.001;
      const gustRatio_vis = Math.min(Math.max(state._windGustSpeed / Math.max(state._windSpeed, 1), 1), 3.0);
      const gustFactor_vis = 1 + (gustRatio_vis - 1) * 0.5 * Math.sin(now * 0.0007 + 3.8);
      (state._particlesByType.fogBlob || []).forEach(p => {
        p.x += p.vx * gustFactor_vis;
        if (p.x > w + p.rx) p.x = -p.rx;
        if (p.x < -p.rx) p.x = w + p.rx;
        const y = p.yBase + Math.sin(p.x * 0.04 + t * 0.025 + p.blobIndex) * p.amp;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = fogColor;
        ctx.beginPath();
        ctx.ellipse(p.x, y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;
    }

    if (state._flashAlpha > 0) {
      ctx.globalAlpha = state._flashAlpha;
      ctx.fillStyle = 'rgba(220,230,255,1)';
      ctx.fillRect(0, 0, w, h);
      state._flashAlpha = Math.max(0, state._flashAlpha - state._flashDecay);
    }

    // T1.6: Scatter/anticipation drops — per-frame lifecycle managed here (not in _createParticles)
    {
      const precipProb = (this._precipProbability ?? 0);
      const precipInt  = (this._precipIntensity ?? 0);
      const scatterActive = precipProb > 30 && precipInt < 0.1;

      // Cull scatter particles when gate no longer holds
      if (!scatterActive) {
        for (let i = state._particles.length - 1; i >= 0; i--) {
          if (state._particles[i].kind === 'scatter') state._particles.splice(i, 1);
        }
      }

      // Spawn scatter up to target count when gate holds
      if (scatterActive) {
        const targetCount = Math.floor(5 + precipProb * 0.1);
        const existing = state._particles.filter(p => p.kind === 'scatter').length;
        const toSpawn = targetCount - existing;
        for (let i = 0; i < toSpawn; i++) {
          state._particles.push({
            kind:  'scatter',
            x:     Math.random() * w,
            y:     Math.random() * h,
            vx:    (Math.random() - 0.5) * 0.3,
            vy:    0.2 + Math.random() * 0.4,
            r:     1 + Math.random(),
            alpha: 0.08 + Math.random() * 0.07,
          });
        }
      }

      // Render scatter particles
      for (const p of state._particles.filter(p => p.kind === 'scatter')) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 220, ${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
      }
    }

    ctx.globalAlpha = 1;
  }

  // B16: Shared sun canvas-position formula — azimuth maps linearly across width,
  // elevation maps 0° (horizon) → 80% down, 90° (zenith) → 5% down.
  static _getSunCanvasPos(w, h, azimuth, elevation) {
    return {
      x: w * (azimuth / 360),
      y: h * (0.8 - elevation / 90 * 0.75),
    };
  }
}
