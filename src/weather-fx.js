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
  }

  /**
   * Start weather particle effects for a given HA weather condition.
   * @param {string} weatherCondition - HA condition string (e.g. 'sunny', 'rainy')
   * @param {boolean} isNight - whether it is currently nighttime
   * @param {string} theme - 'dark' or 'light' (affects particle colors)
   */
  start(weatherCondition, isNight, theme = 'dark') {
    this._theme = theme;
    this._isNight = isNight;
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
      'partlycloudy':    { type: 'sunrays', alpha: 0.45 },
      'windy':           { type: 'sunrays', alpha: 0.40 },
      'windy-variant':   { type: 'sunrays', alpha: 0.40 },
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
      }
      this._overlayType = newOverlayType;
      this._overlayAlpha = newOverlayAlpha;
    } else {
      this._overlayParticles = [];
      this._overlayType = null;
      this._overlayAlpha = 0;
    }

    this._startParticles(particleType);
  }

  /** Stop all weather effects and clear canvas. */
  stop() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this._currentType = null;
    this._particles = [];
    this._alpha = 1;
    this._fading = false;
    this._overlayParticles = [];
    this._overlayType = null;
    this._overlayAlpha = 0;
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
    }
    if (this._overlayType) {
      this._overlayParticles = this._createParticles(this._overlayType, this.canvas);
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
      const fadeStep = () => {
        state._alpha -= 0.02;
        if (state._alpha <= 0) {
          state._alpha = 0;
          state._fading = false;
          state._currentType = state._nextType;
          state._particles = state._currentType
            ? state._createParticles(state._currentType, canvas) : [];
          if (state._currentType) {
            const fadeIn = () => {
              state._alpha = Math.min(state._alpha + 0.02, 1);
              if (state._alpha < 1) requestAnimationFrame(fadeIn);
            };
            requestAnimationFrame(fadeIn);
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
      // God rays — 5 translucent beams from top-right
      for (let i = 0; i < 5; i++) {
        particles.push({
          kind: 'ray', angle: -0.4 + i * 0.15, width: 0.06 + Math.random() * 0.08,
          o: 0.03 + Math.random() * 0.03, phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3
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
          wind: 0.45
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
        particles.push({
          kind: 'drop', x: Math.random() * w, y: Math.random() * h,
          len: (8 + Math.random() * 15) * (0.5 + depth * 0.5),
          speed: (3 + Math.random() * 5) * (0.5 + depth * 0.5),
          o: (0.06 + Math.random() * 0.1) * (0.4 + depth * 0.6),
          wind: type === 'storm' ? 0.5 : 0.3
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
          wind: 0.2
        });
      }
      // Ice pellets — small solid circles with slight horizontal drift
      for (let i = 0; i < 25; i++) {
        const depth = Math.random();
        particles.push({
          kind: 'pellet', x: Math.random() * w, y: Math.random() * h,
          r: (1 + Math.random() * 1.5) * (0.5 + depth * 0.5),
          speed: (3 + Math.random() * 4) * (0.5 + depth * 0.5),
          vx: (Math.random() - 0.5) * 1.5,
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
        particles.push({
          kind: 'star', x: Math.random() * w, y: Math.random() * h * 0.75,
          r: 0.3 + Math.random() * 1.8, phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.8, brightness: 0.3 + Math.random() * 0.7
        });
      }
      // Aurora bands — 4 sine waves across top
      for (let i = 0; i < 4; i++) {
        particles.push({
          kind: 'aurora', yBase: h * (0.08 + i * 0.07),
          hue: 120 + i * 30,
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
          swayAmp: 0.3 + depth * 0.7,
          o: (0.15 + Math.random() * 0.25) * (0.5 + depth * 0.5)
        });
      }
      // Bokeh foreground flakes
      for (let i = 0; i < 5; i++) {
        particles.push({
          kind: 'bokeh', x: Math.random() * w, y: Math.random() * h,
          r: 10 + Math.random() * 15, vy: 0.1 + Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.3, o: 0.04 + Math.random() * 0.04
        });
      }
    } else if (type === 'fog') {
      // Drifting fog layers
      for (let i = 0; i < 12; i++) {
        particles.push({
          kind: 'fogBlob', x: Math.random() * w, y: h * (0.2 + Math.random() * 0.6),
          rx: 80 + Math.random() * 160, ry: 30 + Math.random() * 60,
          vx: (Math.random() - 0.5) * 0.4, o: 0.03 + Math.random() * 0.03
        });
      }
    } else if (type === 'cloudy') {
      // Soft drifting cloud ellipses
      for (let i = 0; i < 8; i++) {
        particles.push({
          kind: 'cloud', x: Math.random() * w, y: h * (0.1 + Math.random() * 0.5),
          rx: 100 + Math.random() * 200, ry: 40 + Math.random() * 60,
          vx: 0.1 + Math.random() * 0.3, o: 0.03 + Math.random() * 0.03
        });
      }
    } else if (type === 'sunrays') {
      // Soft god rays peeking through cloud gaps
      for (let i = 0; i < 4; i++) {
        particles.push({
          kind: 'ray', angle: -0.5 + i * 0.18, width: 0.05 + Math.random() * 0.07,
          o: 0.025 + Math.random() * 0.025, phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.2
        });
      }
      // Golden motes drifting slowly upward
      for (let i = 0; i < 12; i++) {
        particles.push({
          kind: 'mote', x: Math.random() * w, y: Math.random() * h,
          r: 1 + Math.random() * 2,
          vy: -(0.1 + Math.random() * 0.2), vx: (Math.random() - 0.5) * 0.2,
          o: 0.08 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2
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

  // ---- Private: lightning bolt generation (from v9 generateBolt) ----

  _generateBolt(x1, y1, x2, y2, depth) {
    if (depth === 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * Math.abs(y2 - y1) * 0.4;
    const my = (y1 + y2) / 2;
    const left = this._generateBolt(x1, y1, mx, my, depth - 1);
    const right = this._generateBolt(mx, my, x2, y2, depth - 1);
    return left.concat(right.slice(1));
  }

  // ---- Private: ambient overlay (night: stars/aurora, day: sunrays/diffuse glow) ----

  _renderOverlay(now) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const w = canvas.width, h = canvas.height;
    const scale = this._alpha * this._overlayAlpha;
    const light = this._theme === 'light';
    if (scale <= 0 || !this._overlayParticles.length) return;

    // ---- Day overlays ----
    if (this._overlayType === 'sunrays') {
      const rayColor = light ? 'rgba(255,190,50,1)' : 'rgba(255,220,100,1)';
      this._overlayParticles.filter(p => p.kind === 'ray').forEach(p => {
        const pulse = 0.7 + 0.3 * Math.sin(now * 0.001 * p.speed + p.phase);
        const cx = w * 0.85, cy = 0;
        const a1 = p.angle - p.width / 2, a2 = p.angle + p.width / 2;
        const rayLen = Math.max(w, h) * 1.5;
        ctx.globalAlpha = scale * p.o * pulse * (light ? 0.7 : 1);
        ctx.fillStyle = rayColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a1) * rayLen, cy + Math.sin(a1) * rayLen);
        ctx.lineTo(cx + Math.cos(a2) * rayLen, cy + Math.sin(a2) * rayLen);
        ctx.closePath();
        ctx.fill();
      });
      const moteColor = light ? 'rgba(200,160,40,' : 'rgba(255,200,80,';
      this._overlayParticles.filter(p => p.kind === 'mote').forEach(p => {
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
      this._overlayParticles.forEach(p => {
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
    // Aurora bands
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this._overlayParticles.filter(p => p.kind === 'aurora').forEach(p => {
      p.phase += p.speed;
      ctx.globalAlpha = scale * p.o;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = p.yBase + Math.sin(x * p.freq + p.phase) * p.amplitude
          + Math.sin(x * p.freq * 2.3 + p.phase * 1.7) * p.amplitude * 0.3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 1)`;
      ctx.lineWidth = p.thickness;
      ctx.shadowBlur = p.thickness * 1.5;
      ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
      ctx.stroke();
    });
    ctx.restore();
    ctx.shadowBlur = 0;

    // Twinkling stars
    this._overlayParticles.filter(p => p.kind === 'star').forEach(p => {
      p.phase += p.speed * 0.02;
      const twinkle = 0.2 + 0.8 * ((Math.sin(p.phase) + 1) / 2);
      ctx.globalAlpha = scale * twinkle * p.brightness * 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Shooting star
    const ss = this._overlayParticles.find(p => p.kind === 'shootingStar');
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

    if (state._currentType === 'sunny') {
      // God rays
      const rayColor = light ? 'rgba(255,190,50,1)' : 'rgba(255,220,100,1)';
      state._particles.filter(p => p.kind === 'ray').forEach(p => {
        const pulse = 0.7 + 0.3 * Math.sin(now * 0.001 * p.speed + p.phase);
        const cx = w * 0.85, cy = 0;
        const a1 = p.angle - p.width / 2, a2 = p.angle + p.width / 2;
        const rayLen = Math.max(w, h) * 1.5;
        ctx.globalAlpha = state._alpha * p.o * pulse * (light ? 0.7 : 1);
        ctx.fillStyle = rayColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a1) * rayLen, cy + Math.sin(a1) * rayLen);
        ctx.lineTo(cx + Math.cos(a2) * rayLen, cy + Math.sin(a2) * rayLen);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;
      // Dust motes with gentle drift
      const moteColor = light ? 'rgba(200,160,40,' : 'rgba(255,200,80,';
      const moteShadow = light ? 'rgba(200,160,40,0.2)' : 'rgba(255,200,80,0.3)';
      state._particles.filter(p => p.kind === 'mote').forEach(p => {
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
      state._particles.filter(p => p.kind === 'drop').forEach(p => {
        p.x -= p.speed * p.wind;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.wind, p.y - p.len);
        ctx.stroke();
      });
      state._particles.filter(p => p.kind === 'ripple').forEach(p => {
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
      state._particles.filter(p => p.kind === 'drop').forEach(p => {
        p.x -= p.speed * p.wind;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.wind, p.y - p.len);
        ctx.stroke();
      });
      // Splash ripples
      state._particles.filter(p => p.kind === 'ripple').forEach(p => {
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
      const lp = state._particles.find(p => p.kind === 'lightning');
      if (lp) {
        lp.timer++;
        if (lp.flashAlpha > 0) {
          lp.flickerPhase++;
          const flicker = lp.flickerPhase < 3 ? 1 : lp.flickerPhase < 5 ? 0.3 :
            lp.flickerPhase < 7 ? 0.8 : Math.max(0, 1 - (lp.flickerPhase - 7) / 8);
          ctx.globalAlpha = state._alpha * lp.flashAlpha * flicker * (light ? 0.06 : 0.12);
          ctx.fillStyle = light ? 'rgba(0,0,0,1)' : '#fff';
          ctx.fillRect(0, 0, w, h);
          if (lp.flickerPhase > 15) lp.flashAlpha = 0;
        }
        if (lp.bolt && lp.flashAlpha > 0) {
          ctx.globalAlpha = state._alpha * lp.flashAlpha * 0.7;
          ctx.strokeStyle = light ? 'rgba(60,60,120,1)' : '#fff';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.shadowColor = light ? 'rgba(60,60,120,0.6)' : 'rgba(180,180,255,0.8)';
          ctx.beginPath();
          lp.bolt.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        if (lp.timer > lp.interval) {
          lp.timer = 0;
          lp.interval = 200 + Math.random() * 500;
          const bx = w * (0.2 + Math.random() * 0.6);
          lp.bolt = this._generateBolt(bx, 0, bx + (Math.random() - 0.5) * w * 0.2, h * 0.6, 5);
          lp.flashAlpha = 1;
          lp.flickerPhase = 0;
        }
      }
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'night') {
      // Aurora borealis
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      state._particles.filter(p => p.kind === 'aurora').forEach(p => {
        p.phase += p.speed;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y = p.yBase + Math.sin(x * p.freq + p.phase) * p.amplitude
            + Math.sin(x * p.freq * 2.3 + p.phase * 1.7) * p.amplitude * 0.3;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 1)`;
        ctx.lineWidth = p.thickness;
        ctx.shadowBlur = p.thickness * 1.5;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
        ctx.stroke();
      });
      ctx.restore();
      ctx.shadowBlur = 0;
      // Twinkling stars
      state._particles.filter(p => p.kind === 'star').forEach(p => {
        p.phase += p.speed * 0.02;
        const twinkle = 0.2 + 0.8 * ((Math.sin(p.phase) + 1) / 2);
        ctx.globalAlpha = state._alpha * twinkle * p.brightness * 0.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.r > 1.2) {
          ctx.globalAlpha = state._alpha * twinkle * p.brightness * 0.15;
          ctx.strokeStyle = '#fff';
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
      // Shooting star
      const ss = state._particles.find(p => p.kind === 'shootingStar');
      if (ss) {
        ss.timer++;
        if (ss.active) {
          ss.x += ss.vx; ss.y += ss.vy; ss.life++;
          ss.trail.push({ x: ss.x, y: ss.y });
          if (ss.trail.length > 12) ss.trail.shift();
          ss.trail.forEach((pt, i) => {
            const fade = (i + 1) / ss.trail.length;
            ctx.globalAlpha = state._alpha * fade * 0.6;
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
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'snowy') {
      const flakeColor = light
        ? (night ? 'rgba(100,110,140,' : 'rgba(140,150,170,')
        : (night ? 'rgba(180,195,230,' : 'rgba(255,255,255,');
      state._particles.filter(p => p.kind === 'flake').forEach(p => {
        p.y += p.vy;
        p.sway += p.swaySpeed * 0.02;
        p.x += Math.sin(p.sway) * p.swayAmp;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.fillStyle = flakeColor + p.o + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      state._particles.filter(p => p.kind === 'bokeh').forEach(p => {
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
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'fog') {
      const fogColor = light
        ? (night ? 'rgba(90,90,110,1)' : 'rgba(160,160,170,1)')
        : (night ? 'rgba(120,120,140,1)' : 'rgba(200,200,210,1)');
      state._particles.forEach(p => {
        p.x += p.vx;
        if (p.x > w + p.rx) p.x = -p.rx;
        if (p.x < -p.rx) p.x = w + p.rx;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = fogColor;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'cloudy') {
      const cloudColor = light
        ? (night ? 'rgba(80,85,110,1)' : 'rgba(140,145,165,1)')
        : (night ? 'rgba(110,115,145,1)' : 'rgba(180,185,200,1)');
      state._particles.forEach(p => {
        p.x += p.vx;
        if (p.x > w + p.rx) p.x = -p.rx;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.fillStyle = cloudColor;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = state._alpha;

    } else if (state._currentType === 'sleet') {
      // Rain streaks
      const dropColor = light
        ? (night ? 'rgba(60,85,130,1)' : 'rgba(100,130,180,1)')
        : (night ? 'rgba(110,140,190,1)' : 'rgba(160,190,230,1)');
      state._particles.filter(p => p.kind === 'drop').forEach(p => {
        p.x -= p.speed * p.wind;
        p.y += p.speed;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        if (p.x < -20) p.x = w + 20;
        ctx.globalAlpha = state._alpha * p.o;
        ctx.strokeStyle = dropColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.len * p.wind, p.y - p.len);
        ctx.stroke();
      });
      // Ice pellets
      const pelletColor = light
        ? (night ? 'rgba(120,140,170,1)' : 'rgba(180,200,230,1)')
        : (night ? 'rgba(160,180,220,1)' : 'rgba(220,235,255,1)');
      state._particles.filter(p => p.kind === 'pellet').forEach(p => {
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
      state._particles.filter(p => p.kind === 'ripple').forEach(p => {
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

    ctx.globalAlpha = 1;
  }
}
