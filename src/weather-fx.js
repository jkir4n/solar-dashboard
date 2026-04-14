// weather-fx.js — Weather particle system
// Ported from solar-v9.html lines 792-1230

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
    // Ambient overlay — stars/aurora at night, sun rays/glow by day
    this._overlayParticles = [];
    this._overlayType = null;
    this._overlayAlpha = 0;
    this._fadeGen = 0;
    this._windSpeed = 0;         // km/h
    this._windBearing = 180;     // meteorological: direction wind comes FROM (0=N,90=E,180=S,270=W)
    this._weatherCondition = null;
    this._moonBrightness = 0;    // 0=new moon, 1=full moon
    this._moonElevation = -90;
    this._moonAzimuth = 180;
    this._sunElevation = -90;
    this._sunAzimuth = 180;
    this._cloudCoverage = null;
    this._particlesByType = {};        // keyed by particle.kind
    this._overlayParticlesByType = {}; // same for overlay particles
    this._flashAlpha = 0;              // reserved for Task 7
    this._flashDecay = 0;
    this._boltCache = null;
    this._rainbowFade = 0;             // reserved for Task 9
  }

  /**
   * Start weather particle effects for a given HA weather condition.
   * @param {string} weatherCondition - HA condition string (e.g. 'sunny', 'rainy')
   * @param {boolean} isNight - whether it is currently nighttime
   * @param {string} theme - 'dark' or 'light' (affects particle colors)
   */
  // Pre-render a cloud particle to an off-screen canvas and store it on p.
  // Called once at spawn so the render loop can just blit p.off each frame.
  _renderCloudToOffscreen(p, isNight) {
    const cloudR = p.r;
    // Compute tight bounds from actual lobe positions
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const lobe of p.lobes) {
      const lx = lobe.dx * cloudR, ly = lobe.dy * cloudR, lr = lobe.rs * cloudR;
      if (lx - lr < minX) minX = lx - lr;
      if (lx + lr > maxX) maxX = lx + lr;
      if (ly - lr < minY) minY = ly - lr;
      if (ly + lr > maxY) maxY = ly + lr;
    }
    const pad = cloudR * 0.4;
    const offW = Math.ceil(maxX - minX + pad * 2);
    const offH = Math.ceil(maxY - minY + pad * 2);
    const ox = -minX + pad;   // origin offset within offscreen canvas
    const oy = -minY + pad;

    const off = document.createElement('canvas');
    off.width = Math.max(offW, 1); off.height = Math.max(offH, 1);
    const octx = off.getContext('2d');

    // Sort lobes bottom → top so top lobes are painted last (on top)
    const sorted = [...p.lobes].sort((a, b) => b.dy - a.dy);
    sorted.forEach(lobe => {
      const lx = ox + lobe.dx * cloudR;
      const ly = oy + lobe.dy * cloudR;
      const lr = lobe.rs * cloudR;
      const s  = lobe.shade;                 // 1 = topmost, 0 = bottommost
      // Highlight offset: top-left corner of lobe
      const hlX = lx - lr * 0.25, hlY = ly - lr * 0.30;
      const grd = octx.createRadialGradient(hlX, hlY, lr * 0.05, lx, ly, lr);
      if (isNight) {
        grd.addColorStop(0,    `rgba(85, 100, 140, ${(0.75 + s * 0.15).toFixed(2)})`);
        grd.addColorStop(0.55, `rgba(50,  60,  95, ${(0.70 + s * 0.10).toFixed(2)})`);
        grd.addColorStop(1,    `rgba(25,  30,  60, ${(0.20 + s * 0.10).toFixed(2)})`);
      } else {
        // Top lobes (s≈1): bright white/pale; bottom lobes (s≈0): cool grey
        const hi = Math.round(230 + s * 25);   // highlight base: 230–255
        const md = Math.round(185 + s * 45);   // mid body:  185–230
        const lo = Math.round(175 + s * 35);   // bottom:    175–210
        grd.addColorStop(0,    `rgba(255, 255, 255, 0.95)`);
        grd.addColorStop(0.30, `rgba(${hi}, ${hi}, ${hi + 4}, 0.90)`);
        grd.addColorStop(0.65, `rgba(${md}, ${md + 4}, ${md + 12}, 0.78)`);
        grd.addColorStop(1,    `rgba(${lo}, ${lo + 5}, ${lo + 18}, 0.18)`);
      }
      octx.fillStyle = grd;
      octx.beginPath();
      octx.arc(lx, ly, lr, 0, Math.PI * 2);
      octx.fill();
    });

    p.off = off;
    p.ox = ox;
    p.oy = oy;
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

  start(weatherCondition, isNight, theme = 'dark', windSpeed = 0, moonBrightness = 0, moonElevation = -90, moonAzimuth = 180, sunElevation = -90, sunAzimuth = 180, cloudCoverage = null, windBearing = 180) {
    this._theme = theme;
    this._isNight = isNight;
    this._windSpeed = windSpeed;
    this._windBearing = windBearing;
    this._weatherCondition = weatherCondition;
    // Moon values update every call — position changes continuously, no particle rebuild needed
    this._moonBrightness = moonBrightness;
    this._moonElevation  = moonElevation;
    this._moonAzimuth    = moonAzimuth;
    this._sunElevation   = sunElevation;
    this._sunAzimuth     = sunAzimuth;
    this._cloudCoverage  = cloudCoverage;
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
        this._overlayParticles = this._createParticles(newOverlayType, this.canvas);
        this._overlayParticlesByType = this._bucketize(this._overlayParticles);
      }
      this._overlayType = newOverlayType;
      this._overlayAlpha = newOverlayAlpha;
    } else {
      this._overlayParticles = [];
      this._overlayParticlesByType = {};
      this._overlayType = null;
      this._overlayAlpha = 0;
    }

    this._startParticles(particleType);
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
    this._overlayParticles = [];
    this._overlayParticlesByType = {};
    this._overlayType = null;
    this._overlayAlpha = 0;
    this._flashAlpha = 0; this._flashDecay = 0; this._rainbowFade = 0; this._boltCache = null;
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
  }

  /** Full cleanup — call from disconnectedCallback. */
  destroy() {
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  // ---- Private: particle lifecycle ----

  _startParticles(type) {
    const canvas = this.canvas;
    const state = this;

    // Same type — no change needed
    if (state._currentType === type && !state._fading) return;

    // Early return: if new type is null and no current type
    if (!type && !state._currentType) return;

    // Fade out current, then switch
    if (state._currentType && state._currentType !== type) {
      state._fading = true;
      state._nextType = type;
      const gen = ++state._fadeGen;
      const fadeStep = () => {
        if (state._fadeGen !== gen) return; // cancelled by stop() or a newer transition
        state._alpha -= 0.02;
        if (state._alpha <= 0) {
          state._alpha = 0;
          state._fading = false;
          state._currentType = state._nextType;
          state._particles = state._currentType
            ? state._createParticles(state._currentType, canvas) : [];
          state._particlesByType = state._currentType ? state._bucketize(state._particles) : {};
          if (state._currentType) {
            const fadeIn = () => {
              if (state._fadeGen !== gen) return;
              state._alpha = Math.min(state._alpha + 0.02, 1);
              if (state._alpha < 1) state._animFrameId = requestAnimationFrame(fadeIn);
              else state._animFrameId = null;
            };
            state._animFrameId = requestAnimationFrame(fadeIn);
          }
          return;
        }
        requestAnimationFrame(fadeStep);
      };
      requestAnimationFrame(fadeStep);
      return;
    }

    // First time — just start
    state._currentType = type;
    state._particles = type ? state._createParticles(type, canvas) : [];
    state._particlesByType = type ? state._bucketize(state._particles) : {};
    state._alpha = 1;

    if (!state._animFrameId) {
      const loop = (ts) => {
        if (ts - state._lastFrame >= 33) {
          state._lastFrame = ts;
          if (state._currentType) {
            state._render(ts);
          } else {
            state.ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        state._animFrameId = requestAnimationFrame(loop);
      };
      state._animFrameId = requestAnimationFrame(loop);
    }
  }

  // ---- Private: particle creation (from v9 createWeatherParticles) ----

  _createParticles(type, canvas) {
    const w = canvas.width, h = canvas.height;
    const particles = [];
    // 0 at calm, 1 at ~54 km/h (Beaufort 7 gale)
    const windFactor = Math.min((this._windSpeed || 0) / 54, 1.0);
    // Convert meteorological bearing to downwind canvas direction
    // Bearing = direction wind comes FROM; downwind = bearing + 180
    const downwindRad = ((this._windBearing + 180) % 360) * Math.PI / 180;
    const windDx = Math.sin(downwindRad); // +1 = right, -1 = left
    const windDy = Math.cos(downwindRad); // +1 = down, -1 = up (minor effect on fall speed)

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
      for (let i = 0; i < 110; i++) {
        const depth = Math.random();
        particles.push({
          kind: 'drop', x: Math.random() * w, y: Math.random() * h,
          len: (14 + Math.random() * 18) * (0.5 + depth * 0.5),
          speed: (7 + Math.random() * 8) * (0.5 + depth * 0.5),
          o: (0.1 + Math.random() * 0.15) * (0.4 + depth * 0.6),
          windDx: windDx * windFactor * 0.55 + windDx * 0.45
        });
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
      // Streak rain with depth layers
      const count = type === 'storm' ? 80 : 50;
      for (let i = 0; i < count; i++) {
        const depth = Math.random();
        const baseWind = type === 'storm' ? 0.5 : 0.3;
        const maxWind = type === 'storm' ? 1.0 : 0.8;
        particles.push({
          kind: 'drop', x: Math.random() * w, y: Math.random() * h,
          len: (8 + Math.random() * 15) * (0.5 + depth * 0.5),
          speed: (3 + Math.random() * 5) * (0.5 + depth * 0.5),
          o: (0.06 + Math.random() * 0.1) * (0.4 + depth * 0.6),
          windDx: windDx * (baseWind + windFactor * (maxWind - baseWind))
        });
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
          kind: 'lightning', timer: 0, interval: 300 + Math.random() * 600,
          bolt: null, flashAlpha: 0, flickerPhase: 0
        });
      }
    } else if (type === 'sleet') {
      // Rain streaks — denser, shorter, steeper than pure rain
      for (let i = 0; i < 40; i++) {
        const depth = Math.random();
        particles.push({
          kind: 'drop', x: Math.random() * w, y: Math.random() * h,
          len: (5 + Math.random() * 8) * (0.5 + depth * 0.5),
          speed: (4 + Math.random() * 4) * (0.5 + depth * 0.5),
          o: (0.05 + Math.random() * 0.08) * (0.4 + depth * 0.6),
          windDx: windDx * (0.2 + windFactor * 0.5)
        });
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
      // Twinkling stars with depth
      for (let i = 0; i < 80; i++) {
        // Spectral colour: 40% white, 25% pale blue, 20% pale yellow, 10% pale orange, 5% red
        // Brighter stars lean toward blue/white
        const brightness = 0.3 + Math.random() * 0.7;
        const rand = Math.random();
        const starColor = brightness > 0.7
          ? (rand < 0.55 ? '#ffffff' : rand < 0.85 ? '#aad4ff' : rand < 0.97 ? '#fff8d0' : '#ffd8a0')
          : (rand < 0.40 ? '#ffffff' : rand < 0.65 ? '#aad4ff' : rand < 0.85 ? '#fff8d0' : rand < 0.95 ? '#ffd8a0' : '#ffb0a0');
        particles.push({
          kind: 'star', x: Math.random() * w, y: Math.random() * h * 0.75,
          r: 0.3 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.8, brightness,
          color: starColor
        });
      }
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
      // Layered snowflakes with turbulent wobble
      for (let i = 0; i < 35; i++) {
        const depth = Math.random();
        particles.push({
          kind: 'flake', x: Math.random() * w, y: Math.random() * h,
          r: (1 + Math.random() * 2) * (0.5 + depth * 0.5),
          vy: (0.2 + Math.random() * 0.4) * (0.4 + depth * 0.6),
          sway: Math.random() * Math.PI * 2, swaySpeed: 0.3 + Math.random() * 0.5,
          // Strong wind reduces random sway and replaces with directional drift
          swayAmp: (0.3 + depth * 0.7) * (1 - windFactor * 0.7),
          windDrift: windDx * windFactor * 2.0 * (0.3 + depth * 0.7),
          o: (0.15 + Math.random() * 0.25) * (0.5 + depth * 0.5),
          angle: Math.random() * Math.PI * 2
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
      } else {
        archetype = 'cumulus';
      }
      // Per-archetype lobe constraints (spec §1–§2)
      const ARCH = {
        cumulus:       { lobeCount: [5, 8],  spreadX: 0.80, spreadY: -0.70, rsRange: [0.55, 0.90] },
        altocumulus:   { lobeCount: [5, 9],  spreadX: 1.00, spreadY: -0.30, rsRange: [0.45, 0.75] },
        stratocumulus: { lobeCount: [7, 11], spreadX: 1.30, spreadY: -0.20, rsRange: [0.40, 0.70] },
        stratus:       { lobeCount: [8, 14], spreadX: 1.80, spreadY: -0.10, rsRange: [0.35, 0.60] },
        nimbostratus:  { lobeCount: [7, 12], spreadX: 1.50, spreadY: -0.15, rsRange: [0.40, 0.65] },
        cumulonimbus:  { lobeCount: [6, 10], spreadX: 0.90, spreadY: -1.00, rsRange: [0.55, 0.85] },
      };
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
          const yBase     = h * (layer.yRange[0] + Math.random() * (layer.yRange[1] - layer.yRange[0]));
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
          // Fill lobes
          const fillCount = lobeCount - 1 - crownCount;
          for (let k = 0; k < fillCount; k++) {
            lobes.push({
              dx: (Math.random() - 0.5) * arch.spreadX * 2,
              dy: arch.spreadY * Math.random(),
              rs: rsMin + Math.random() * (rsMax - rsMin),
              phase: Math.random() * Math.PI * 2,
            });
          }
          // Per-lobe shade from vertical position (spec §2): 1.0 = topmost, 0.0 = bottommost
          const dyVals = lobes.map(l => l.dy);
          const minDy = Math.min(...dyVals), maxDy = Math.max(...dyVals);
          lobes.forEach(l => {
            l.shade = (maxDy === minDy) ? 0.5 : 1.0 - (l.dy - minDy) / (maxDy - minDy);
          });
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
          };
          this._renderCloudToOffscreen(p, this._isNight);
          particles.push(p);
        }
      });
    } else if (type === 'sunrays') {
      // Tyndall rays through cloud gaps — 8 beams radiating from sun
      // Visible up to ~25° elevation (diffuse, softer than pure crepuscular)
      for (let i = 0; i < 8; i++) {
        const baseAngle = (i / 8) * Math.PI * 2;
        particles.push({
          kind: 'ray', angle: baseAngle + (Math.random() - 0.5) * 0.5,
          width: 0.03 + Math.random() * 0.05,
          o: 0.06 + Math.random() * 0.05, phase: Math.random() * Math.PI * 2,
          speed: 0.12 + Math.random() * 0.18
        });
      }
      // Golden motes drifting slowly upward
      for (let i = 0; i < 12; i++) {
        particles.push({
          kind: 'mote', x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 2,
          vy: -(0.1 + Math.random() * 0.2), vx: (Math.random() - 0.5) * 0.2,
          o: 0.15 + Math.random() * 0.15, phase: Math.random() * Math.PI * 2
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

  _renderOverlay(now) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const w = canvas.width, h = canvas.height;
    // Night star overlay: scale by cloud transmittance so dense clouds occlude stars
    const cloudTransmit = (this._overlayType === 'night' && this._cloudCoverage !== null)
      ? this._calcCloudDim(this._cloudCoverage, this._weatherCondition)
      : 1.0;
    const scale = this._alpha * this._overlayAlpha * cloudTransmit;
    const light = this._theme === 'light';
    if (scale <= 0 || !this._overlayParticles.length) return;

    // ---- Day overlays ----
    if (this._overlayType === 'sunrays') {
      if (this._sunElevation <= 0) return;
      const _sunX = w * (this._sunAzimuth / 360);
      const _sunY = h * (0.8 - this._sunElevation / 90 * 0.75);
      const rayColor = light ? 'rgba(255,190,50,1)' : 'rgba(255,220,100,1)';
      // Tyndall rays: full below 10°, fade to invisible at 25° (softer than crepuscular)
      const _tyndallFade = Math.max(0, 1 - Math.max(0, this._sunElevation - 10) / 15);
      if (_tyndallFade > 0) {
        (this._overlayParticlesByType.ray || []).forEach(p => {
          const pulse = 0.7 + 0.3 * Math.sin(now * 0.001 * p.speed + p.phase);
          const cx = _sunX, cy = _sunY;
          const a1 = p.angle - p.width / 2, a2 = p.angle + p.width / 2;
          const rayLen = Math.max(w, h) * 1.5;
          ctx.globalAlpha = scale * p.o * pulse * _tyndallFade * (light ? 0.7 : 1);
          ctx.fillStyle = rayColor;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a1) * rayLen, cy + Math.sin(a1) * rayLen);
          ctx.lineTo(cx + Math.cos(a2) * rayLen, cy + Math.sin(a2) * rayLen);
          ctx.closePath();
          ctx.fill();
        });
      }
      const moteColor = light ? 'rgba(200,160,40,' : 'rgba(255,200,80,';
      (this._overlayParticlesByType.mote || []).forEach(p => {
        p.phase += 0.01;
        p.x += p.vx + Math.sin(p.phase) * 0.2;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.globalAlpha = scale * p.o;
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
        ctx.shadowBlur = 80;
        ctx.shadowColor = haloColor;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = this._alpha;
      return;
    }

    // ---- Night overlay (stars + aurora) ----
    const overlayStarDim  = 1 - this._moonBrightness * 0.65;
    const overlayAurDim   = 1 - this._moonBrightness * 0.65;
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
      // Vertical curtain gradient: transparent top → core colour → red fringe at bottom
      const midY = pts[Math.floor(pts.length / 2)].y;
      const grad = ctx.createLinearGradient(0, midY - halfW, 0, midY + halfW);
      grad.addColorStop(0,   `hsla(${p.hue}, 80%, 60%, 0)`);
      grad.addColorStop(0.35, `hsla(${p.hue}, 85%, 60%, 1)`);
      grad.addColorStop(0.7,  `hsla(${p.hue}, 80%, 55%, 0.8)`);
      grad.addColorStop(1,    `hsla(0, 80%, 50%, 0.4)`); // red lower fringe
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
      ctx.shadowBlur = lineWidth * 1.5;
      ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    });
    ctx.restore();
    ctx.shadowBlur = 0;

    // Twinkling stars — dimmed by moonlight
    (this._overlayParticlesByType.star || []).forEach(p => {
      p.phase += p.speed * 0.02;
      const twinkle = 0.2 + 0.8 * ((Math.sin(p.phase) + 1) / 2);
      ctx.globalAlpha = scale * twinkle * p.brightness * 0.5 * overlayStarDim;
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

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
    const w = canvas.width, h = canvas.height;
    const state = this;
    const light = this._theme === 'light';
    const night = this._isNight;

    ctx.clearRect(0, 0, w, h);

    // Draw ambient overlay (stars/aurora at night; sun rays/glow by day) behind weather particles
    if (state._overlayType) state._renderOverlay(now);

    ctx.globalAlpha = state._alpha;

    // ---- Sun disc — rendered for all daytime conditions, dimmed by cloud cover ----
    if (!state._isNight && state._sunElevation > 0) {
      const cloudDim = state._calcCloudDim(state._cloudCoverage, state._weatherCondition);
      if (cloudDim > 0) {
        const elev = state._sunElevation;
        const sunX = w * (state._sunAzimuth / 360);
        const sunY = h * (0.8 - elev / 90 * 0.75);

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
        // Overcast: use a flat base + scaled component so the patch stays visible
        // Needs higher alpha to show through the semi-transparent mesh gradient backdrop
        const glowAlpha = cloudDim >= 0.3
          ? (0.18 + (elev < 15 ? 0.10 : 0)) * cloudDim
          : cloudDim > 0 ? 0.10 + cloudDim * 0.25 : 0;

        // Atmospheric glow
        const sunGrd = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, glowR);
        sunGrd.addColorStop(0, `rgba(${r},${g},${b},${glowAlpha})`);
        sunGrd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.globalAlpha = state._alpha;
        ctx.fillStyle = sunGrd;
        ctx.beginPath();
        ctx.arc(sunX, sunY, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Disc — only when sky is clear enough
        if (cloudDim >= 0.3) {
          const discAlpha = state._alpha * cloudDim;
          const discGrd = ctx.createRadialGradient(
            sunX - sunR * 0.30, sunY - sunR * 0.30, sunR * 0.05,
            sunX, sunY, sunR
          );
          discGrd.addColorStop(0,   `rgba(255,255,245,${discAlpha})`);
          discGrd.addColorStop(0.5, `rgba(${r},${Math.min(255, g + 5)},${b},${discAlpha})`);
          discGrd.addColorStop(1,   `rgba(${Math.round(r * 0.92)},${Math.round(g * 0.85)},${Math.round(Math.max(0, b * 0.70))},${(discAlpha * 0.72).toFixed(3)})`);
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
        // Solar halo — soft stroked arcs for atmospheric 22° ring look
        const haloStrength = Math.max(0, cloudDim - 0.45) / 0.55;
        if (haloStrength > 0 && elev > 5) {
          const haloR = sunR * 3.8;
          ctx.save();
          ctx.globalAlpha = state._alpha;
          // Wide outer diffuse white glow
          ctx.beginPath();
          ctx.arc(sunX, sunY, haloR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${(haloStrength * 0.20).toFixed(3)})`;
          ctx.lineWidth = sunR * 1.6;
          ctx.shadowBlur = sunR * 2.5;
          ctx.shadowColor = `rgba(210, 225, 255, ${(haloStrength * 0.18).toFixed(3)})`;
          ctx.stroke();
          ctx.shadowBlur = 0;
          // Inner red-orange rim (characteristic 22° halo inner edge)
          ctx.beginPath();
          ctx.arc(sunX, sunY, haloR * 0.91, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 155, 80, ${(haloStrength * 0.28).toFixed(3)})`;
          ctx.lineWidth = sunR * 0.55;
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = state._alpha;
      }
    }

    // ---- Moon disc — rendered for all night conditions, dimmed by cloud cover ----
    if (state._isNight && state._moonElevation > 0) {
      const cloudDim = state._calcCloudDim(state._cloudCoverage, state._weatherCondition);
      const mb = state._moonBrightness;
      const totalBright = mb * cloudDim; // phase × cloud transmittance
      if (totalBright > 0 || cloudDim > 0) {
        const moonX = w * (state._moonAzimuth / 360);
        const moonY = h * (0.8 - state._moonElevation / 90 * 0.75);
        const moonR  = 20 + mb * 14;
        const glowR  = moonR * (2.5 + mb * 2) * (1 + (1 - cloudDim) * 1.5);

        // Diffuse glow — always shown when moon is up (even behind clouds)
        const glowAlpha = state._alpha * Math.max(totalBright * 0.25, cloudDim > 0 ? 0.04 : 0);
        const grd = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, glowR);
        grd.addColorStop(0, `rgba(220,220,170,${glowAlpha})`);
        grd.addColorStop(1, 'rgba(220,220,170,0)');
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
        // Lunar halo — same geometry, scaled by moonBrightness
        const moonHaloStrength = Math.max(0, cloudDim - 0.45) / 0.55 * mb;
        if (moonHaloStrength > 0 && state._moonElevation > 5) {
          const haloR = moonR * 2.8;
          const inner = haloR * 0.88, outer = haloR * 1.12;
          const haloGrd = ctx.createRadialGradient(moonX, moonY, inner, moonX, moonY, outer);
          haloGrd.addColorStop(0,   'rgba(200,210,230,0)');
          haloGrd.addColorStop(0.5, `rgba(220,225,240,${(moonHaloStrength * 0.25).toFixed(3)})`);
          haloGrd.addColorStop(1,   'rgba(200,210,230,0)');
          ctx.globalAlpha = state._alpha;
          ctx.fillStyle = haloGrd;
          ctx.beginPath();
          ctx.arc(moonX, moonY, outer, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = state._alpha;
      }
    }

    // ---- Rainbow arc — rainy/pouring daytime, sun above 5° ----
    const isRainyCond = state._weatherCondition === 'rainy' || state._weatherCondition === 'pouring';
    if (isRainyCond && !night && state._sunElevation > 5) {
      state._rainbowFade = Math.min(1, state._rainbowFade + 1 / 180); // fade in over ~3s at 60fps
    } else {
      state._rainbowFade = Math.max(0, state._rainbowFade - 0.05);    // fade out quickly
    }
    if (state._rainbowFade > 0 && isRainyCond && !night && state._sunElevation > 5) {
      const antisolarAz = (state._sunAzimuth + 180) % 360;
      const arcX = w * (antisolarAz / 360);
      const arcRadius = h * 0.55;
      const arcCenterY = h * (0.62 + (state._sunElevation / 90) * 0.35);
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

    if (state._currentType === 'sunny') {
      // God rays
      const rayColor = light ? 'rgba(255,190,50,1)' : 'rgba(255,220,100,1)';
      const _raySunX = w * (state._sunAzimuth / 360);
      const _raySunY = h * (0.8 - state._sunElevation / 90 * 0.75);
      // Crepuscular rays: full below 6.5°, fade to invisible at 15°
      const _rayElevFade = Math.max(0, 1 - Math.max(0, elev - 6.5) / 8.5);
      if (_rayElevFade > 0) {
        (state._particlesByType.ray || []).forEach(p => {
          if (state._sunElevation <= 0) return;
          const pulse = 0.7 + 0.3 * Math.sin(now * 0.001 * p.speed + p.phase);
          const cx = _raySunX, cy = _raySunY;
          const a1 = p.angle - p.width / 2, a2 = p.angle + p.width / 2;
          const rayLen = Math.max(w, h) * 1.5;
          ctx.globalAlpha = state._alpha * p.o * pulse * _rayElevFade * (light ? 0.7 : 1);
          ctx.fillStyle = rayColor;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a1) * rayLen, cy + Math.sin(a1) * rayLen);
          ctx.lineTo(cx + Math.cos(a2) * rayLen, cy + Math.sin(a2) * rayLen);
          ctx.closePath();
          ctx.fill();
        });
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
      (state._particlesByType.drop || []).forEach(p => {
        p.x += p.windDx;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.windDx, p.y - p.len);
        ctx.stroke();
      });
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
      (state._particlesByType.drop || []).forEach(p => {
        p.x += p.windDx;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.windDx, p.y - p.len);
        ctx.stroke();
      });
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
        lp.timer++;
        if (lp.flashAlpha > 0) {
          lp.flickerPhase++;
          if (lp.flickerPhase > 15) lp.flashAlpha = 0;
        }
        if (lp.bolt && lp.flashAlpha > 0) {
          ctx.strokeStyle = light ? 'rgba(60,60,120,1)' : '#fff';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = light ? 'rgba(60,60,120,0.6)' : 'rgba(180,180,255,0.8)';
          state._drawBolt(ctx, lp.bolt, state._alpha * lp.flashAlpha * 0.7);
          ctx.shadowBlur = 0;
        }
        if (lp.timer > lp.interval) {
          lp.timer = 0;
          lp.interval = 200 + Math.random() * 500;
          const bx = w * (0.2 + Math.random() * 0.6);
          state._boltCache = state._generateBolt(bx, 0, bx + (Math.random() - 0.5) * w * 0.2, h * 0.6, 5);
          lp.bolt = state._boltCache;
          lp.flashAlpha = 1;
          lp.flickerPhase = 0;
          const peakAlpha = state._weatherCondition === 'lightning' ? 0.45 : 0.35;
          state._flashAlpha = Math.max(state._flashAlpha, peakAlpha);
          state._flashDecay = peakAlpha / 7.2; // ~120ms at 60fps
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
        ctx.shadowBlur = lineWidth * 1.5;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
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
      const flakeColor = light
        ? (night ? 'rgba(100,110,140,' : 'rgba(140,150,170,')
        : (night ? 'rgba(180,195,230,' : 'rgba(255,255,255,');
      (state._particlesByType.flake || []).forEach(p => {
        p.y += p.vy;
        p.sway += p.swaySpeed * 0.02;
        p.x += Math.sin(p.sway) * p.swayAmp + p.windDrift;
        p.angle += 0.008;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        if (p.x > w + 10) p.x = -10;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = flakeColor + p.o + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let arm = 0; arm < 6; arm++) {
          const ax = Math.cos(arm * Math.PI / 3) * p.r;
          const ay = Math.sin(arm * Math.PI / 3) * p.r;
          ctx.moveTo(0, 0);
          ctx.lineTo(ax, ay);
          if (p.r >= 3.5) {
            for (const frac of [0.45, 0.65]) {
              const bx = ax * frac, by = ay * frac;
              const perp = arm * Math.PI / 3 + Math.PI / 2;
              const bl = p.r * 0.28;
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(perp) * bl, by + Math.sin(perp) * bl);
              ctx.moveTo(bx, by);
              ctx.lineTo(bx - Math.cos(perp) * bl, by - Math.sin(perp) * bl);
            }
          }
        }
        ctx.stroke();
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
      const fogColor = light
        ? (night ? 'rgba(90,90,110,1)' : 'rgba(160,160,170,1)')
        : (night ? 'rgba(120,120,140,1)' : 'rgba(200,200,210,1)');
      const t = now * 0.001;
      (state._particlesByType.fogBlob || []).forEach(p => {
        p.x += p.vx;
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
      // Wind variables for cloud movement (spec §5)
      const windFactor   = Math.min((state._windSpeed || 0) / 54, 1.0);
      const downwindRad  = ((state._windBearing + 180) % 360) * Math.PI / 180;
      const windDx       = Math.sin(downwindRad);          // +1 = rightward on canvas
      const windDy       = -Math.cos(downwindRad);         // +1 = downward on canvas
      // Sort by layer (far → near) for correct depth order
      const clouds = [...(state._particlesByType.cloud || [])].sort((a, b) => a.layer - b.layer);
      clouds.forEach(p => {
        // Advance position — baseSpeed always rightward, wind adds true directional component (spec §5)
        p.x     += p.vx + windFactor * p.windMult * windDx;
        p.yBase += windFactor * p.windMult * windDy * 0.15;
        // Y-bob — p.y derived from yBase so vertical error never accumulates (spec §6)
        p.y = p.yBase + Math.sin(now * p.bobSpeed + p.phase) * p.bobAmp;
        // 4-edge wrapping (spec §5)
        if (p.x     >  w + p.r * 2) { p.x = -p.r * 2;      p.yBase = Math.random() * h; }
        if (p.x     < -p.r * 2)     { p.x =  w + p.r * 2;  p.yBase = Math.random() * h; }
        if (p.yBase >  h + p.r)     { p.yBase = -p.r;       p.x = Math.random() * w; }
        if (p.yBase < -p.r)         { p.yBase =  h + p.r;   p.x = Math.random() * w; }
        const baseAlpha = state._alpha * p.alpha;
        // Blit pre-rendered off-screen canvas (created once at spawn in _renderCloudToOffscreen)
        if (p.off) {
          ctx.save();
          ctx.globalAlpha = baseAlpha;
          ctx.drawImage(p.off, p.x - p.ox, p.y - p.oy);
          ctx.restore();
        }

        // Moon/sun scatter highlight at cloud top (screen pass — runs on main canvas after blit)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const hx = p.x - p.r * 0.15, hy = p.y - p.r * 0.25, hr = p.r * 0.3;
        const hgrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        const highlightAlpha = night ? state._alpha * 0.04 : state._alpha * 0.12;
        hgrd.addColorStop(0, `rgba(255,255,240,${highlightAlpha})`);
        hgrd.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = hgrd;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'sleet') {
      // Rain streaks
      const dropColor = light
        ? (night ? 'rgba(60,85,130,1)' : 'rgba(100,130,180,1)')
        : (night ? 'rgba(110,140,190,1)' : 'rgba(160,190,230,1)');
      (state._particlesByType.drop || []).forEach(p => {
        p.x += p.windDx;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.windDx, p.y - p.len);
        ctx.stroke();
      });
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

    if (state._flashAlpha > 0) {
      ctx.globalAlpha = state._flashAlpha;
      ctx.fillStyle = 'rgba(220,230,255,1)';
      ctx.fillRect(0, 0, w, h);
      state._flashAlpha = Math.max(0, state._flashAlpha - state._flashDecay);
    }

    ctx.globalAlpha = 1;
  }
}
