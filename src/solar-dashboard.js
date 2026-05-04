import { HABridge } from './ha-bridge.js';
import { SolarEngine, cloudTransmission } from './solar-engine.js';
import { WeatherFX } from './weather-fx.js';
import { ChartManager } from './charts.js';
import { STYLES } from './styles.js';

// ============ CONSTANTS ============

const MOON_PHASE_BRIGHTNESS = {
  'new_moon': 0.0, 'waxing_crescent': 0.15, 'first_quarter': 0.4,
  'waxing_gibbous': 0.7, 'full_moon': 1.0, 'waning_gibbous': 0.7,
  'last_quarter': 0.4, 'waning_crescent': 0.15,
};

const CONDITION_CLOUD_MAP = {
  'sunny': 5, 'clear-night': 5,
  'partlycloudy': 30, 'cloudy': 65,
  'rainy': 85, 'pouring': 95,
  'snowy': 80, 'fog': 70,
  'hail': 90, 'lightning': 90, 'lightning-rainy': 90,
  'windy': 15, 'windy-variant': 15,
  'exceptional': 50, 'snowy-rainy': 75,
};

const COND_LABELS = {
  'clear-night': 'Clear Night', 'cloudy': 'Cloudy', 'exceptional': 'Exceptional',
  'fog': 'Fog', 'hail': 'Hail', 'lightning': 'Lightning',
  'lightning-rainy': 'Thunderstorm', 'partlycloudy': 'Partly Cloudy',
  'pouring': 'Pouring', 'rainy': 'Rainy', 'snowy': 'Snowy',
  'snowy-rainy': 'Sleet', 'sunny': 'Sunny', 'windy': 'Windy',
  'windy-variant': 'Windy',
};

const CONDITION_PALETTE_MAP = {
  'sunny': 'sunny', 'clear-night': 'night',
  'partlycloudy': 'partlycloudy', 'cloudy': 'cloudy',
  'rainy': 'rainy', 'pouring': 'pouring',
  'snowy': 'snowy', 'hail': 'snowy',
  'fog': 'fog',
  'lightning': 'storm', 'lightning-rainy': 'storm',
  'windy': 'windy', 'windy-variant': 'windy',
  'exceptional': 'cloudy', 'snowy-rainy': 'snowy',
};

function cellBounds(chemistry) {
  if (chemistry === 'NMC')  return { vmin: 3.00, vmax: 4.20 };
  if (chemistry === 'LTO')  return { vmin: 1.80, vmax: 2.75 };
  return { vmin: 2.50, vmax: 3.65 }; // LiFePO₄ and unknown — intentional fallthrough
}

const WEATHER_PALETTES = {
  dark: {
    sunny:              ['rgba(255,180,50,0.40)', 'rgba(255,140,30,0.30)', 'rgba(255,200,80,0.20)'],
    night:              ['rgba(20,20,80,0.3)',    'rgba(40,30,100,0.2)',   'rgba(60,20,120,0.15)'],
    partlycloudy:       ['rgba(135,206,235,0.45)','rgba(100,160,220,0.30)','rgba(180,210,240,0.20)'],
    cloudy:             ['rgba(120,120,140,0.22)','rgba(100,100,120,0.16)','rgba(80,85,100,0.12)'],
    rainy:              ['rgba(40,60,120,0.25)',  'rgba(30,50,100,0.20)',  'rgba(20,40,80,0.14)'],
    snowy:              ['rgba(140,160,200,0.22)','rgba(120,140,180,0.16)','rgba(100,120,160,0.12)'],
    fog:                ['rgba(100,100,110,0.22)','rgba(80,80,90,0.16)',   'rgba(60,60,70,0.12)'],
    storm:              ['rgba(60,20,80,0.28)',   'rgba(40,10,60,0.22)',   'rgba(80,30,100,0.16)'],
    windy:              ['rgba(60,160,200,0.22)', 'rgba(40,140,180,0.16)', 'rgba(80,180,220,0.12)'],
    night_partlycloudy: ['rgba(30,40,90,0.25)',   'rgba(50,50,110,0.18)',  'rgba(40,60,100,0.12)'],
    night_cloudy:       ['rgba(25,25,50,0.25)',   'rgba(30,30,60,0.18)',   'rgba(20,25,55,0.12)'],
    pouring:            ['rgba(20,35,100,0.32)',  'rgba(15,28,85,0.26)',   'rgba(10,22,70,0.20)'],
    night_rainy:        ['rgba(15,25,70,0.3)',    'rgba(10,20,60,0.22)',   'rgba(20,30,80,0.15)'],
    night_pouring:      ['rgba(8,15,55,0.35)',    'rgba(5,12,45,0.28)',    'rgba(10,18,60,0.2)'],
    night_snowy:        ['rgba(30,40,80,0.25)',   'rgba(40,50,90,0.18)',   'rgba(50,60,100,0.12)'],
    night_fog:          ['rgba(30,30,40,0.25)',   'rgba(25,25,35,0.18)',   'rgba(20,20,30,0.12)'],
    night_storm:        ['rgba(30,5,50,0.3)',     'rgba(20,5,40,0.22)',    'rgba(40,10,60,0.15)'],
    night_windy:        ['rgba(10,60,90,0.2)',    'rgba(8,50,80,0.15)',    'rgba(15,70,100,0.1)'],
  },
  light: {
    sunny:              ['rgba(255,200,80,0.35)', 'rgba(255,170,50,0.25)', 'rgba(255,220,100,0.18)'],
    night:              ['rgba(40,40,100,0.15)',  'rgba(60,50,120,0.1)',   'rgba(80,40,140,0.08)'],
    partlycloudy:       ['rgba(135,206,235,0.45)','rgba(100,160,220,0.30)','rgba(180,210,240,0.20)'],
    cloudy:             ['rgba(150,155,170,0.28)','rgba(130,135,150,0.20)','rgba(110,115,130,0.15)'],
    rainy:              ['rgba(60,80,140,0.25)',  'rgba(50,70,120,0.20)',  'rgba(40,60,100,0.14)'],
    snowy:              ['rgba(180,200,230,0.28)','rgba(160,180,210,0.20)','rgba(140,160,190,0.15)'],
    fog:                ['rgba(140,140,150,0.28)','rgba(120,120,130,0.20)','rgba(100,100,110,0.15)'],
    storm:              ['rgba(80,40,100,0.28)',  'rgba(60,30,80,0.20)',   'rgba(100,50,120,0.15)'],
    windy:              ['rgba(80,180,220,0.22)', 'rgba(60,160,200,0.16)', 'rgba(100,200,230,0.12)'],
    night_partlycloudy: ['rgba(60,70,120,0.15)',  'rgba(70,80,130,0.1)',   'rgba(50,60,110,0.08)'],
    night_cloudy:       ['rgba(50,50,80,0.15)',   'rgba(40,45,75,0.1)',    'rgba(35,40,70,0.08)'],
    pouring:            ['rgba(40,55,120,0.28)',  'rgba(30,45,100,0.22)',  'rgba(50,65,130,0.16)'],
    night_rainy:        ['rgba(30,45,100,0.18)',  'rgba(25,40,90,0.13)',   'rgba(35,50,110,0.1)'],
    night_pouring:      ['rgba(15,22,65,0.25)',   'rgba(12,18,55,0.2)',    'rgba(18,26,72,0.15)'],
    night_snowy:        ['rgba(60,70,110,0.15)',  'rgba(70,80,120,0.1)',   'rgba(80,90,130,0.08)'],
    night_fog:          ['rgba(50,50,65,0.15)',   'rgba(40,40,55,0.1)',    'rgba(35,35,50,0.08)'],
    night_storm:        ['rgba(50,20,70,0.18)',   'rgba(40,15,60,0.13)',   'rgba(60,25,80,0.1)'],
    night_windy:        ['rgba(30,90,130,0.12)',  'rgba(25,80,120,0.08)',  'rgba(35,100,140,0.06)'],
  },
};

// ============ FLOW PARTICLE SYSTEM ============
class FlowParticles {
  constructor(root, wrapId, particlesId, lineId, arcId, color) {
    this.wrap = root.getElementById(wrapId);
    this.container = root.getElementById(particlesId);
    this.line = root.getElementById(lineId);
    this.arcCanvas = root.getElementById(arcId);
    this.arcCtx = this.arcCanvas?.getContext('2d');
    this.color = color;
    this.active = false;
    this.activeDots = 0;
    this.speed = 0.003;
    this.activeFrac = 2;
    this.rafId = null;
    this._tick = this._animate.bind(this);
    this.dots = [];
    this.arcs = [];
    const dotsEl = this.container?.querySelectorAll('.flow-dot');
    if (dotsEl) {
      dotsEl.forEach((d) => {
        this.dots.push({ el: d, p: Math.random() });
      });
    }
  }

  start(powerW) {
    this.active = true;
    this.powerW = powerW;
    const MAX_W = 5000;
    const frac = Math.min(powerW, MAX_W) / MAX_W;
    // Continuous speed: 0.002 → 0.010
    this.speed = 0.002 + frac * 0.008;
    // Continuous dot count as float 2.0 → 5.0
    this.activeFrac = 2 + frac * 18;
    if (this.arcs.length === 0) {
      this.arcs = Array.from({ length: 4 }, () => ({
        p: Math.random(),
        len: 0.05 + Math.random() * 0.05,
        opacity: Math.random() * 0.4 + 0.2,
      }));
    }
    if (this.line) {
      if (!this._lineSet) {
        this.line.style.background = this.color + '33';
        this.line.style.boxShadow = `0 0 6px 1px ${this.color}22`;
        this.line.style.setProperty('--flow-color', this.color);
        this._lineSet = true;
      }
      const sweepS = (2.5 - frac * 1.7).toFixed(2);
      this.line.style.setProperty('--sweep-speed', sweepS + 's');
      const glowAlpha = Math.round(40 + frac * 80).toString(16).padStart(2, '0');
      this.line.style.boxShadow = `0 0 ${4 + frac * 10}px ${1 + frac * 3}px ${this.color}${glowAlpha}`;
    }
    if (!this.rafId) this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.active = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.line) {
      this.line.style.background = '';
      this.line.style.boxShadow = '';
      this._lineSet = false;
    }
    this.dots.forEach(d => d.el.style.opacity = '0');
    if (this.arcCtx && this.arcCanvas) {
      this.arcCtx.clearRect(0, 0, this.arcCanvas.width, this.arcCanvas.height);
    }
    this.arcs = [];
  }

  _animate() {
    if (!this.active) return;
    const fullDots = Math.floor(this.activeFrac);
    const partialAlpha = this.activeFrac - fullDots;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const maxOpacity = i < fullDots ? 1.0 : i === fullDots ? partialAlpha : 0;
      if (maxOpacity < 0.01) {
        const cur = parseFloat(d.el.style.opacity) || 0;
        if (cur > 0.01) {
          d.p += this.speed;
          if (d.p >= 1) d.p -= 1;
          d.el.style.left = (d.p * 100) + '%';
          d.el.style.opacity = (cur * 0.92).toFixed(3);
        } else {
          d.el.style.opacity = '0';
        }
        continue;
      }
      d.p += this.speed;
      if (d.p >= 1) d.p -= 1;
      let edgeFade = 1;
      if (d.p < 0.08) edgeFade = d.p / 0.08;
      else if (d.p > 0.92) edgeFade = (1 - d.p) / 0.08;
      d.el.style.left = (d.p * 100) + '%';
      d.el.style.opacity = (maxOpacity * edgeFade).toFixed(3);
      d.el.style.background = this.color;
      d.el.style.boxShadow = `0 0 6px 2px ${this.color}, 0 0 12px 4px ${this.color}55`;
    }
    this._drawArcs();
    this.rafId = requestAnimationFrame(this._tick);
  }

  _drawArcs() {
    const ctx = this.arcCtx;
    const cv = this.arcCanvas;
    if (!ctx || !cv || this.arcs.length === 0) return;
    const wW = cv.offsetWidth || 100;
    const wH = 20;
    if (cv.width !== wW || cv.height !== wH) {
      cv.width = wW;
      cv.height = wH;
    }
    const W = cv.width;
    const H = cv.height;
    const cy = H / 2;
    const p = Math.min(this.activeFrac / 20, 1); // 0→1 power fraction
    const activeArcs = Math.max(1, Math.round(p * this.arcs.length));
    const roughness = 1 + p * 4;        // 1px → 5px
    const glowBlur = 4 + p * 14;        // 4 → 18
    const lineWidth = 0.5 + p * 1.5;    // 0.5px → 2px
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < this.arcs.length; i++) {
      const arc = this.arcs[i];
      arc.p += this.speed * 0.9;
      if (arc.p > 1 + arc.len) arc.p = -arc.len;
      if (i >= activeArcs) continue;
      arc.opacity += (Math.random() - 0.5) * 0.15;
      arc.opacity = Math.max(0.1, Math.min(0.6 + p * 0.3, arc.opacity));
      const x1 = (arc.p - arc.len / 2) * W;
      const x2 = (arc.p + arc.len / 2) * W;
      if (x2 < 0 || x1 > W) continue;
      const segments = 5 + Math.round(p * 4); // 5→9 segments
      const step = (x2 - x1) / segments;
      ctx.save();
      ctx.globalAlpha = arc.opacity;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = this.color;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, x1), cy);
      for (let j = 1; j <= segments; j++) {
        const x = Math.min(W, Math.max(0, x1 + j * step));
        const y = j === segments ? cy : cy + (Math.random() - 0.5) * roughness * 2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ============ MAIN COMPONENT ============
class SolarDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._bridge = new HABridge();
    this._engine = null;
    this._weatherFx = null;
    this._charts = null;
    this._initialized = false;
    this._intervals = [];
    this._activeAnimations = new Map();
    this._clockFormatter = null;
    this._flowPS1 = null;
    this._flowPS2 = null;
    this._battArcInterval = null;
    this._boltTimeouts = [];
    this._resizeTimeout = null;
    this._els = {};
    this._battArcActive = false;
    this._battArcColor = null;
    this._battArcPowerW = 0;
    this._cardsRevealed = false;
    this._weatherEntityId = null;
    this._moonPhaseEntityId = null;
    this._issPos = null;
    this._lastMoonBrightness = 0.5;
    this._weatherCloudFactor = 1.0;
    this._weatherAmbientC = null;
    this._solarEngineReady = false;
    this._todayIn = 0;
    this._todayOut = 0;
    this._lastForecastHour = -1;
    this._cachedForecastKWh = 0;
    this._revealFallbackTimeout = null;
    this._wasDay = false;
    this._resizeHandler = null;
    this._activeChartRange = 'Live';
    this._lastLiveChartFetch = 0;
    this._chartFetchDebounce = {}; // P22: debounce guard for tab clicks / visibility resume
    this._cycleRatePerDay = null;
    this._pendingChanges = new Set();
    this._updateRafId = null;
    this._chartsLoaded = false;
    this._meshCur    = [null, null, null];
    this._meshTarget = null;
    this._meshRafId  = null;
  }

  set hass(hass) {
    this._bridge.update(hass);
    this._applyTheme();
    if (!this._initialized) {
      this._init();
      this._initialized = true;
    }
    // Retry chart loading once entity discovery is complete
    const E = this._bridge.E;
    if (E && E.POWER && E.SOC && !this._chartsLoaded) {
      this._chartsLoaded = true;
      this._loadChartRange(this._activeChartRange || 'Live');
    }
    const changed = this._bridge.getChangedEntities();
    if (changed.length > 0) {
      changed.forEach(id => this._pendingChanges.add(id));
    }
    if (!this._updateRafId) {
      this._updateRafId = requestAnimationFrame(() => {
        this._updateRafId = null;
        const pending = [...this._pendingChanges];
        this._pendingChanges.clear();
        if (pending.length === 0) return;
        this._updateUI(pending);
        if (this._activeChartRange === 'Live' && this._chartsLoaded) {
          const E = this._bridge.E;
          const liveEntities = new Set([E.POWER, E.CHG_POWER, E.DISCHG_POWER, E.SOC].filter(Boolean));
          const relevant = pending.some(id => liveEntities.has(id));
          if (relevant && Date.now() - this._lastLiveChartFetch > 60000) {
            this._lastLiveChartFetch = Date.now();
            this._loadChartRange('Live');
          }
        }
      });
    }
  }

  set panel(panel) { this._panel = panel; }
  set narrow(narrow) { this._narrow = narrow; }

  // ============ INIT ============
  _init() {
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLES}</style>${this._getHTML()}`;

    // Cache frequently-queried element refs
    this._els = {
      battRing:      root.getElementById('battRing'),
      battSOC:       root.getElementById('battSOC'),
      battStatus:    root.getElementById('battStatus'),
      battStatusDot: root.getElementById('battStatusDot'),
      battVolt:      root.getElementById('battVolt'),
      battCurr:      root.getElementById('battCurr'),
      battPow:       root.getElementById('battPow'),
      battAh:        root.getElementById('battAh'),
      battEnergy:    root.getElementById('battEnergy'),
      battTTELabel:  root.getElementById('battTTELabel'),
      battTTE:       root.getElementById('battTTE'),
      solActual:     root.getElementById('solActual'),
      sysCycles:     root.getElementById('sysCycles'),
      sysRuntime:    root.getElementById('sysRuntime'),
      sysThroughput: root.getElementById('sysThroughput'),
      sysMinCell:    root.getElementById('sysMinCell'),
      sysMaxCell:    root.getElementById('sysMaxCell'),
      // P4: Additional cached refs to eliminate per-update getElementById calls
      sysFirmware:   root.getElementById('sysFirmware'),
      sysBmsModel:   root.getElementById('sysBmsModel'),
      battMosfetTemp:root.getElementById('battMosfetTemp'),
      sysConfig:     root.getElementById('sysConfig'),
      sysNominal:    root.getElementById('sysNominal'),
      sysCapacity:   root.getElementById('sysCapacity'),
      sysChemistry:  root.getElementById('sysChemistry'),
      wxSource:      root.getElementById('wxSource'),
      // NI2: Cache dashboard root to eliminate repeated queries
      dashRoot:      root.querySelector('.dashboard-root'),
    };

    // Apply theme and enable JS-dependent animations
    this._applyTheme();
    const dashRoot = root.querySelector('.dashboard-root');
    if (dashRoot) dashRoot.classList.add('js-ready');
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._themeHandler = () => this._applyTheme();
    this._mediaQuery.addEventListener('change', this._themeHandler);

    // Init solar engine
    const lat = this._bridge.latitude;
    const lon = this._bridge.longitude;
    const alt = this._bridge.elevation;
    if (lat != null && lon != null) {
      this._engine = new SolarEngine(lat, lon, alt, this._bridge.installDate);
      this._solarEngineReady = true;
    }

    // Init weather FX
    const weatherCanvas = root.getElementById('weatherParticles');
    if (weatherCanvas) {
      this._weatherFx = new WeatherFX(weatherCanvas);
      this._weatherFx.resize(window.innerWidth, window.innerHeight);
    }

    // Init charts
    this._charts = new ChartManager(this._bridge);
    this._charts.setThemeRoot(root.querySelector('.dashboard-root'));
    ['chartPower', 'chartSOC', 'chartSolar'].forEach(id => {
      this._charts.attachCrosshair(root.getElementById(id));
    });

    // Init flow particles
    this._flowPS1 = new FlowParticles(root, 'flowWrap1', 'flowParticles1', 'flowLine1', 'flowArc1', '#00F0FF');
    this._flowPS2 = new FlowParticles(root, 'flowWrap2', 'flowParticles2', 'flowLine2', 'flowArc2', '#FF453A');

    // Wire chart tab handlers
    const tabs = root.querySelectorAll('.chart-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const range = tab.dataset.range;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.range === range));
        this._loadChartRange(range);
      });
    });

    // Wire toggle handlers
    const chgToggle = root.getElementById('chgToggle');
    if (chgToggle) {
      chgToggle.addEventListener('change', () => {
        this._bridge._hass?.callService('switch', chgToggle.checked ? 'turn_on' : 'turn_off',
          { entity_id: this._bridge.E.CHG_SWITCH });
      });
    }
    const dischgToggle = root.getElementById('dischgToggle');
    if (dischgToggle) {
      dischgToggle.addEventListener('change', () => {
        this._bridge._hass?.callService('switch', dischgToggle.checked ? 'turn_on' : 'turn_off',
          { entity_id: this._bridge.E.DISCHG_SWITCH });
      });
    }

    // Start clock
    this._startClock();
    this._intervals.push(setInterval(() => this._startClock(), 1000));

    // Start calcTodayInOut
    this._calcTodayInOut();
    this._intervals.push(setInterval(() => this._calcTodayInOut(), 300000));

    // Start solar estimate update
    this._updateSolarEstimate();
    this._intervals.push(setInterval(() => this._updateSolarEstimate(), 300000));
    this._intervals.push(setInterval(() => this._updateWeather(), 300000));
    this._intervals.push(setInterval(() => this._updateSunMoonPosition(), 10000));
    this._intervals.push(setInterval(() => this._fetchISSPosition(), 10000));
    this._fetchISSPosition();

    // Start solar degradation UI (hourly)
    this._updateSolarUI();
    this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));

    // Cycle rate (7-day rolling) — fetch once on load, refresh hourly
    this._updateCycleRate();
    this._intervals.push(setInterval(() => this._updateCycleRate(), 3600000));


    // Resize handler
    this._resizeHandler = () => {
      if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
      this._resizeTimeout = setTimeout(() => {
        if (this._weatherFx) this._weatherFx.resize(window.innerWidth, window.innerHeight);
      }, 300);
    };
    window.addEventListener('resize', this._resizeHandler);

    // Visibility handler — pause all animations when panel is hidden
    this._visibilityHandler = () => {
      if (document.hidden) {
        this._intervals.forEach(id => clearInterval(id));
        this._intervals = [];
        if (this._flowPS1) this._flowPS1.stop();
        if (this._flowPS2) this._flowPS2.stop();
        this._stopBattArcs();
        this._activeAnimations.forEach(id => cancelAnimationFrame(id));
        this._activeAnimations.clear();
        if (this._weatherFx) this._weatherFx.stop();
        if (this._meshRafId) { cancelAnimationFrame(this._meshRafId); this._meshRafId = null; }
      } else {
        // Restart all intervals
        this._intervals.push(setInterval(() => this._startClock(), 1000));
        this._intervals.push(setInterval(() => this._calcTodayInOut(), 300000));
        this._intervals.push(setInterval(() => this._updateSolarEstimate(), 300000));
        this._intervals.push(setInterval(() => this._updateWeather(), 300000));
        this._intervals.push(setInterval(() => this._updateSunMoonPosition(), 10000));
        this._intervals.push(setInterval(() => this._fetchISSPosition(), 10000));
        this._fetchISSPosition();
        this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));
        this._intervals.push(setInterval(() => this._updateCycleRate(), 3600000));
        this._startMeshLerp();
        this._startBattArcs();
        this._updateWeather();
        this._refreshAllUI();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    // Start mesh gradient lerp loop
    this._startMeshLerp();

    // Initial full refresh + reveal
    this._refreshAllUI();

    // Staggered card reveal with fallback
    setTimeout(() => this._revealCards(), 200);
    this._revealFallbackTimeout = setTimeout(() => this._revealCards(), 2000); // fallback
  }

  disconnectedCallback() {
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];
    if (this._flowPS1) this._flowPS1.stop();
    if (this._flowPS2) this._flowPS2.stop();
    if (this._weatherFx) this._weatherFx.destroy();
    if (this._charts) this._charts.detachAll();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
    if (this._mediaQuery && this._themeHandler) this._mediaQuery.removeEventListener('change', this._themeHandler);
    this._stopBattArcs();
    this._activeAnimations.forEach((_rafId, el) => {
      cancelAnimationFrame(_rafId);
      if (el._flashTimer) { clearTimeout(el._flashTimer); el._flashTimer = null; }
    });
    this._activeAnimations.clear();
    if (this._meshRafId) { cancelAnimationFrame(this._meshRafId); this._meshRafId = null; }
  }

  // ============ THEME ============
  _applyTheme() {
    const root = this.shadowRoot.querySelector('.dashboard-root');
    if (!root) return;
    const hass = this._bridge._hass;
    const darkMode = hass?.themes?.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = darkMode ? 'dark' : 'light';
    if (this._charts) this._charts.updateTheme();
  }

  // ============ HTML TEMPLATE ============
  _getHTML() {
    return `
<div class="dashboard-root" data-theme="dark">
<canvas id="weatherParticles"></canvas>
<div class="container">
  <header class="header">
    <div style="display:flex;align-items:center;gap:12px">
      <h1 style="font-size:24px;font-weight:700">Solar</h1>
      <div class="live-dot"></div>
      <span style="font-size:12px;font-weight:600;color:var(--green)">Live</span>
    </div>
    <div id="clock" style="font-size:14px;font-weight:500;color:var(--text2)"></div>
  </header>
  <div class="top-row">
    <div class="card" id="batteryHero">
      <h2 class="section-title">Battery</h2>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--glass-border)" stroke-width="10"/>
          <circle id="battRing" class="batt-ring" cx="100" cy="100" r="80" fill="none" stroke="var(--green)" stroke-width="10" stroke-dasharray="0 502.65" stroke-linecap="round"/>
          <text id="battSOC" x="100" y="108" text-anchor="middle" dominant-baseline="middle" class="batt-soc" fill="var(--text)" style="filter:drop-shadow(0 0 8px var(--green-glow))">0%</text>
        </svg>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <div id="battStatusDot" style="width:8px;height:8px;border-radius:50%;background:var(--text2);animation:pulse 2s ease-in-out infinite;"></div>
          <span id="battStatus" style="font-size:13px;font-weight:600;">Idle</span>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battVolt">--</div><div class="stat-label">Voltage</div></div>
        <div class="stat-item"><div class="stat-val" id="battCurr">--</div><div class="stat-label">Current</div></div>
        <div class="stat-item"><div class="stat-val" id="battPow">--</div><div class="stat-label">Power</div></div>
        <div class="stat-item"><div class="stat-val" id="battAh">--</div><div class="stat-label">Remaining</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battEnergy">--</div><div class="stat-label">Energy</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayIn">--</div><div class="stat-label">Today In</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayOut">--</div><div class="stat-label">Today Out</div></div>
        <div class="stat-item"><div class="stat-val" id="battTTE">--</div><div class="stat-label" id="battTTELabel">Time to Empty</div></div>
      </div>
      <div class="stat-divider"></div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysCycles">--</div><div class="inf-k">Cycles</div></div>
        <div class="inf"><div class="inf-v" id="sysCapacity">215 Ah</div><div class="inf-k">Capacity</div></div>
        <div class="inf"><div class="inf-v" id="sysNominal">51.2 V</div><div class="inf-k">Nominal</div></div>
        <div class="inf"><div class="inf-v" id="sysConfig">16S</div><div class="inf-k">Config</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysMinCell">-- V</div><div class="inf-k">Min Cell</div></div>
        <div class="inf"><div class="inf-v" id="sysMaxCell">-- V</div><div class="inf-k">Max Cell</div></div>
        <div class="inf"><div class="inf-v" id="sysRuntime">--</div><div class="inf-k">Runtime</div></div>
        <div class="inf"><div class="inf-v" id="sysThroughput">--</div><div class="inf-k">Throughput</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="battMosfetTemp">--</div><div class="inf-k">MOSFET</div></div>
        <div class="inf"><div class="inf-v" id="sysBmsModel">--</div><div class="inf-k">BMS Model</div></div>
        <div class="inf"><div class="inf-v" id="sysFirmware">--</div><div class="inf-k">Firmware</div></div>
        <div class="inf"><div class="inf-v" id="sysChemistry">LiFePO\u2084</div><div class="inf-k">Chemistry</div></div>
      </div>
    </div>
    <div class="right-col">
      <div class="card" id="powerFlow">
        <h2 class="section-title">Power Flow</h2>
        <div class="flow">
          <div class="flow-node">
            <div class="flow-icon" id="iconSolar">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="8"/>
                <line x1="24" y1="4" x2="24" y2="10"/>
                <line x1="24" y1="38" x2="24" y2="44"/>
                <line x1="4" y1="24" x2="10" y2="24"/>
                <line x1="38" y1="24" x2="44" y2="24"/>
                <line x1="9.37" y1="9.37" x2="13.6" y2="13.6"/>
                <line x1="34.4" y1="34.4" x2="38.63" y2="38.63"/>
                <line x1="38.63" y1="9.37" x2="34.4" y2="13.6"/>
                <line x1="13.6" y1="34.4" x2="9.37" y2="38.63"/>
              </svg>
            </div>
            <span class="flow-label">Solar</span>
          </div>
          <div class="flow-line-wrap" id="flowWrap1">
            <div class="flow-line" id="flowLine1"></div>
            <canvas class="flow-arc-canvas" id="flowArc1"></canvas>
            <div class="flow-particles" id="flowParticles1"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
            <span class="flow-watt" id="flowWatt1">0 W</span>
          </div>
          <div class="flow-node">
            <div class="flow-icon" id="iconBattery" style="position:relative;">
              <svg viewBox="0 0 48 48">
                <rect x="8" y="14" width="32" height="24" rx="3" ry="3"/>
                <rect x="19" y="10" width="10" height="4" rx="2" ry="2"/>
              </svg>
              <svg id="battArcs" viewBox="0 0 48 48" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></svg>
            </div>
            <span class="flow-label">Battery</span>
          </div>
          <div class="flow-line-wrap" id="flowWrap2">
            <div class="flow-line" id="flowLine2"></div>
            <canvas class="flow-arc-canvas" id="flowArc2"></canvas>
            <div class="flow-particles" id="flowParticles2"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
            <span class="flow-watt" id="flowWatt2">0 W</span>
          </div>
          <div class="flow-node">
            <div class="flow-icon" id="iconHome">
              <svg viewBox="0 0 48 48">
                <polyline points="6,22 24,6 42,22"/>
                <rect x="14" y="22" width="20" height="20" rx="2" ry="2"/>
                <rect class="home-window" x="17" y="28" width="5" height="5" rx="0.5"/>
                <rect class="home-window" x="26" y="28" width="5" height="5" rx="0.5"/>
              </svg>
            </div>
            <span class="flow-label">Home</span>
          </div>
        </div>
      </div>
      <div class="card" id="solarCard">
        <h2 class="section-title">Solar Panels</h2>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span id="solActual" class="sol-output" style="color:var(--green)">-- W</span>
          <span style="font-size:13px;color:var(--text2)">actual</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-top:4px;flex-wrap:wrap">
          <span id="solOutput" style="font-size:20px;font-weight:700;color:var(--orange)">--- W</span>
          <span style="font-size:13px;color:var(--text2)">estimated</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px;flex-wrap:wrap">
          <span id="solTodayGen" style="font-size:15px;font-weight:600;color:var(--green)">--</span>
          <span style="font-size:12px;color:var(--text3)">generated today</span>
          <span style="font-size:12px;color:var(--text3)">&middot;</span>
          <span id="solForecast" style="font-size:15px;font-weight:600;color:var(--text2)">--</span>
          <span style="font-size:12px;color:var(--text3)">expected</span>
        </div>
        <div class="health-bar"><div class="health-fill" id="solDegFill"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;">
          <span id="solHealthPct" style="color:var(--green)">--%</span>
          <span id="solDegPct" style="color:var(--red)">--%</span>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solRated">--</div><div class="stat-label">Rated</div></div>
          <div class="stat-item"><div class="stat-val" id="solInstalled">--</div><div class="stat-label">Installed</div></div>
          <div class="stat-item"><div class="stat-val" id="solAge">--</div><div class="stat-label">Age</div></div>
          <div class="stat-item"><div class="stat-val" id="solModel">--</div><div class="stat-label">Model</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solType">--</div><div class="stat-label">Type</div></div>
          <div class="stat-item"><div class="stat-val" id="solYr1">--</div><div class="stat-label">Year 1 Loss</div></div>
          <div class="stat-item"><div class="stat-val" id="solYrN">--</div><div class="stat-label">Annual Loss</div></div>
          <div class="stat-item"><div class="stat-val" id="solNextYr">--</div><div class="stat-label">Next Year</div></div>
        </div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-border)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><span>WEATHER</span><span id="wxSource" style="font-size:9px;font-weight:500;letter-spacing:0.4px;opacity:0.45;text-transform:none"></span></div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-val" id="wxCondition">--</div><div class="stat-label">Condition</div></div>
            <div class="stat-item"><div class="stat-val" id="wxTemp">--</div><div class="stat-label">Temp</div></div>
            <div class="stat-item"><div class="stat-val" id="wxCloud">--</div><div class="stat-label">Cloud</div></div>
            <div class="stat-item"><div class="stat-val" id="wxHumid">--</div><div class="stat-label">Humidity</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="card" id="chartsCard" style="margin-bottom:16px">
    <h2 class="section-title">Analytics</h2>
    <div class="chart-tabs" id="chartTabs">
      <button class="chart-tab active" data-range="Live">Live</button>
      <button class="chart-tab" data-range="1D">Yesterday</button>
      <button class="chart-tab" data-range="7D">7 Days</button>
      <button class="chart-tab" data-range="30D">30 Days</button>
    </div>
    <div class="chart-grid">
      <div class="chart-wrap">
        <div class="chart-title">Power</div>
        <div class="chart-value"><span id="pwrVal">--</span></div>
        <canvas id="chartPower"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Battery SOC</div>
        <div class="chart-value"><span id="socVal">--</span></div>
        <canvas id="chartSOC"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Solar</div>
        <div class="chart-value"><span id="solVal">--</span></div>
        <canvas id="chartSolar"></canvas>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:11px;">
          <span style="color:var(--green);font-weight:600;">&#9632; Actual</span>
          <span id="solarOverlayLabel" style="color:var(--orange);font-weight:600;">&#9632; Estimated</span>
        </div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="cells-grid">
      <div id="pack1Card">
        <h2 class="section-title">Cells C1\u2013C8</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">Temperature</span>
          <span id="pack1Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack1"></div>
      </div>
      <div id="pack2Card" style="border-left:1px solid var(--glass-border);padding-left:24px">
        <h2 class="section-title">Cells C9\u2013C16</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">Temperature</span>
          <span id="pack2Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack2"></div>
      </div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-border)">
      <div id="balIndicator" style="text-align:center;font-size:14px;font-weight:600;color:var(--orange);display:none">
        <span id="balSrc">C1</span> <span style="color:var(--red)">\u25B2</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span style="color:var(--text3)">\u21C4</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span id="balDst">C12</span> <span style="color:var(--green)">\u25BC</span>
      </div>
      <div id="balStatus" style="text-align:center;font-size:13px;font-weight:600;color:var(--text2)"></div>
    </div>
  </div>
  <div class="bottom-row">
    <div class="card" id="controlsCard">
      <h2 class="section-title">Controls</h2>
      <div class="ctrl">
        <div><div class="ctrl-name">Charging</div><div class="ctrl-desc">Enable or disable battery charging</div></div>
        <label class="toggle"><input type="checkbox" id="chgToggle" checked><span class="slider"></span></label>
      </div>
      <div class="ctrl">
        <div><div class="ctrl-name">Discharging</div><div class="ctrl-desc">Enable or disable battery discharging</div></div>
        <label class="toggle"><input type="checkbox" id="dischgToggle" checked><span class="slider"></span></label>
      </div>
      <div class="ctrl">
        <div><div class="ctrl-name">Balancer</div><div class="ctrl-desc" id="balDesc">--</div></div>
        <div id="balSwitch" style="display:flex;align-items:center;gap:6px">
          <span id="balSwitchLabel" style="font-size:12px;font-weight:600;color:var(--text2)">--</span>
          <div id="balDot" style="width:8px;height:8px;border-radius:50%;background:var(--text3)"></div>
        </div>
      </div>
    </div>
  </div>
</div>
</div>`;
  }

  // ============ ANIMATION ENGINE ============
  _animateValue(el, from, to, duration, formatter) {
    if (!el) return;
    if (from === to) {
      // Still update text if element shows placeholder
      if (el.textContent === '--' || el.textContent === '') el.textContent = formatter(to);
      return;
    }
    if (Math.abs(to - from) < 0.01) { el.textContent = formatter(to); return; }
    const existing = this._activeAnimations.get(el);
    if (existing) cancelAnimationFrame(existing);

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const val = from + (to - from) * eased;
      el.textContent = formatter(val);
      if (t < 1) {
        this._activeAnimations.set(el, requestAnimationFrame(tick));
      } else {
        this._activeAnimations.delete(el);
        el.classList.remove('val-flash');
        void el.offsetWidth;
        el.classList.add('val-flash');
        const _cleanFlash = () => el.classList.remove('val-flash');
        const _flashTimer = setTimeout(_cleanFlash, 1000);
        el._flashTimer = _flashTimer;
        el.addEventListener('animationend', () => { clearTimeout(el._flashTimer); _cleanFlash(); el._flashTimer = null; }, { once: true, passive: true });
      }
    };
    this._activeAnimations.set(el, requestAnimationFrame(tick));
  }

  // ============ UI UPDATE DISPATCHER ============
  _updateUI(changedEntities) {
    const E = this._bridge.E;
    const root = this.shadowRoot;
    const batteryEntities = [E.SOC, E.VOLTAGE, E.CURRENT, E.POWER, E.REMAINING,
      E.CYCLES, E.RUNTIME, E.THROUGHPUT, E.MIN_CELL_V, E.MAX_CELL_V,
      E.MIN_V_CELL, E.MAX_V_CELL, E.FIRMWARE, E.MANUFACTURER, E.STRINGS,
      E.MOSFET_TEMP, E.CHG_POWER, E.DISCHG_POWER];
    const hasBatteryChange = changedEntities.some(id => batteryEntities.includes(id));

    if (hasBatteryChange) {
      // Build a single snapshot so each entity's getVal (parseFloat) is called exactly once.
      const snap = {
        soc:        this._bridge.getVal(E.SOC),
        voltage:    this._bridge.getVal(E.VOLTAGE),
        current:    this._bridge.getVal(E.CURRENT),
        power:      this._bridge.getVal(E.POWER),
        remaining:  this._bridge.getVal(E.REMAINING),
        chgPower:   this._bridge.getVal(E.CHG_POWER),
        dischgPower:this._bridge.getVal(E.DISCHG_POWER),
        cycles:     this._bridge.getVal(E.CYCLES),
        throughput: this._bridge.getVal(E.THROUGHPUT),
        minCellV:   this._bridge.getVal(E.MIN_CELL_V),
        maxCellV:   this._bridge.getVal(E.MAX_CELL_V),
        mosfetTemp: this._bridge.getVal(E.MOSFET_TEMP),
        strings:    this._bridge.getVal(E.STRINGS),
      };
      this._updateBattery(snap);
      this._updatePowerFlow(snap);
      this._updateChartValues(snap);
    }

    const hasCellChange = changedEntities.some(id =>
      id.includes('cell_voltage_') || id === E.BALANCING);
    if (hasCellChange) this._updateCellBalance();

    const hasWeatherChange = changedEntities.some(id => id.startsWith('weather.'));
    if (hasWeatherChange) this._updateWeather();

    // Temperature updates
    for (const eid of changedEntities) {
      const val = this._bridge.getStrVal(eid);
      const unavail = val == null;

      if (eid === E.TEMP1) {
        const el = root.getElementById('pack1Temp');
        if (unavail) el.textContent = '--';
        else { const old = parseFloat(el.textContent) || 0; this._animateValue(el, old, parseFloat(val), 600, v => v.toFixed(1) + ' \u00B0C'); }
      }
      if (eid === E.TEMP2) {
        const el = root.getElementById('pack2Temp');
        if (unavail) el.textContent = '--';
        else { const old = parseFloat(el.textContent) || 0; this._animateValue(el, old, parseFloat(val), 600, v => v.toFixed(1) + ' \u00B0C'); }
      }
      if (eid === E.BAL_SWITCH || eid === E.BALANCING) {
        const switchOn = this._bridge.getStrVal(E.BAL_SWITCH) === 'on';
        const active = this._bridge.getStrVal(E.BALANCING) === 'on';
        const label = root.getElementById('balSwitchLabel');
        const dot = root.getElementById('balDot');
        const desc = root.getElementById('balDesc');
        if (!switchOn) {
          label.textContent = 'Disabled';
          label.style.color = 'var(--red)';
          dot.style.background = 'var(--red)';
          dot.style.boxShadow = '0 0 6px var(--red-glow)';
          desc.textContent = 'Balancer off';
        } else if (active) {
          label.textContent = 'Balancing';
          label.style.color = 'var(--orange)';
          dot.style.background = 'var(--orange)';
          dot.style.boxShadow = '0 0 6px var(--orange-glow)';
          desc.textContent = 'Actively transferring via supercap';
        } else {
          label.textContent = 'Idle';
          label.style.color = 'var(--green)';
          dot.style.background = 'var(--green)';
          dot.style.boxShadow = '0 0 6px var(--green-glow)';
          desc.textContent = 'Enabled \u00B7 not currently balancing';
        }
      }
      if (eid === E.CHG_SWITCH) root.getElementById('chgToggle').checked = val === 'on';
      if (eid === E.DISCHG_SWITCH) root.getElementById('dischgToggle').checked = val === 'on';
    }
  }

  // ============ BATTERY UPDATE ============
  _updateBattery(snap) {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const soc = snap.soc;
    const voltage = snap.voltage;
    const current = snap.current;
    const power = snap.power;
    const remaining = snap.remaining;
    const battSpec = this._bridge.battSpec;

    const r = 80, circ = 2 * Math.PI * r;
    const ring = this._els.battRing;
    if (soc != null) {
      const socEl = this._els.battSOC;
      const oldSoc = parseFloat(socEl.textContent) || 0;
      this._animateValue(socEl, oldSoc, soc, 600, v => Math.round(v) + '%');
      ring.style.strokeDasharray = `${circ * soc / 100} ${circ}`;
      ring.style.stroke = soc < 20 ? 'var(--red)' : soc < 40 ? 'var(--orange)' : 'var(--green)';
    } else {
      this._els.battSOC.textContent = '--%';
      ring.style.strokeDasharray = `0 ${circ}`;
      ring.style.stroke = 'var(--secondary-text)';
    }

    const cur = current || 0;
    const status = cur > 0.5 ? 'Charging' : cur < -0.5 ? 'Discharging' : 'Idle';
    const statusColor = status === 'Charging' ? 'var(--green)' : status === 'Discharging' ? 'var(--red)' : 'var(--text2)';
    this._els.battStatus.textContent = status;
    this._els.battStatus.style.color = statusColor;
    this._els.battStatusDot.style.background = statusColor;

    if (voltage != null) {
      const el = this._els.battVolt;
      this._animateValue(el, parseFloat(el.textContent) || 0, voltage, 600, v => v.toFixed(2) + ' V');
    } else this._els.battVolt.textContent = '--';

    if (current != null) {
      const el = this._els.battCurr;
      this._animateValue(el, parseFloat(el.textContent) || 0, Math.abs(current), 600, v => v.toFixed(2) + ' A');
    } else this._els.battCurr.textContent = '--';

    const chgPower = snap.chgPower;
    const dischgPower = snap.dischgPower;
    const battPower = chgPower > 0 ? chgPower : dischgPower > 0 ? dischgPower : power != null ? Math.abs(power) : null;
    if (battPower != null) {
      const el = this._els.battPow;
      this._animateValue(el, parseFloat(el.textContent) || 0, battPower, 600, v => Math.round(v) + ' W');
    } else this._els.battPow.textContent = '--';

    if (remaining != null) {
      const el = this._els.battAh;
      this._animateValue(el, parseFloat(el.textContent) || 0, remaining, 600, v => v.toFixed(2) + ' Ah');
    } else this._els.battAh.textContent = '--';

    // Energy
    const energyEl = this._els.battEnergy;
    if (remaining > 0 && voltage > 0) {
      this._animateValue(energyEl, parseFloat(energyEl.textContent) || 0, remaining * voltage / 1000, 600, v => v.toFixed(2) + ' kWh');
    } else energyEl.textContent = '--';

    // Time to empty/full
    let tte = '--';
    const tteLabel = this._els.battTTELabel;
    const fmtDHM = (hours) => {
      let totalMin = Math.round(hours * 60);
      const d = Math.floor(totalMin / 1440);
      totalMin %= 1440;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return (d > 0 ? d + ':' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    };
    if (cur < -0.5 && remaining > 0) {
      tte = fmtDHM(remaining / Math.abs(cur));
      if (tteLabel) tteLabel.textContent = 'Time to Empty';
    } else if (cur > 0.5) {
      if (soc != null && soc < 100 && remaining > 0) {
        const toFill = battSpec.fullAh - remaining;
        if (toFill > 0) tte = fmtDHM(toFill / cur);
        else tte = '\u221E (Charging)';
      } else {
        tte = '\u221E (Charging)';
      }
      if (tteLabel) tteLabel.textContent = 'Time to Full';
    } else {
      tte = '\u221E (Idle)';
      if (tteLabel) tteLabel.textContent = 'Time to Empty';
    }
    this._els.battTTE.textContent = tte;

    // Update actual solar (charging power = solar input)
    const solarActual = chgPower > 0 ? chgPower : (cur > 0 ? Math.abs(power || 0) : 0);
    const solActualEl = this._els.solActual;
    this._animateValue(solActualEl, parseFloat(solActualEl.textContent) || 0, solarActual, 600, v => Math.round(v) + ' W');

    // System info updates
    const cycles = snap.cycles;
    if (cycles != null) {
      const el = this._els.sysCycles;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, cycles, 600, v => {
        const rate = this._cycleRatePerDay;
        return Math.round(v) + (rate != null ? ` (${rate}/d)` : '');
      });
    }

    const runtime = this._bridge.getStrVal(E.RUNTIME);
    this._els.sysRuntime.textContent = runtime ?? '--';

    const throughput = snap.throughput;
    if (throughput != null) {
      const el = this._els.sysThroughput;
      const nomV = this._bridge.battSpec?.nomV || 52;
      const throughputKwh = throughput * nomV / 1000;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, throughputKwh, 600, v => Math.round(v) + ' kWh (' + Math.round(throughput) + ' Ah)');
    }

    const minCellV = snap.minCellV;
    if (minCellV != null) {
      const el = this._els.sysMinCell;
      const old = parseFloat(el.textContent) || 0;
      const cellNum = parseInt(this._bridge.getStrVal(E.MIN_V_CELL)) || '?';
      this._animateValue(el, old, minCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else this._els.sysMinCell.textContent = '-- V';

    const maxCellV = snap.maxCellV;
    if (maxCellV != null) {
      const el = this._els.sysMaxCell;
      const old = parseFloat(el.textContent) || 0;
      const cellNum = parseInt(this._bridge.getStrVal(E.MAX_V_CELL)) || '?';
      this._animateValue(el, old, maxCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else this._els.sysMaxCell.textContent = '-- V';

    const firmware = this._bridge.getStrVal(E.FIRMWARE);
    if (this._els.sysFirmware) this._els.sysFirmware.textContent = firmware ? firmware.replace(/[^\x20-\x7E]/g, '').replace(/_+/g, ' ').trim() : '--';

    const manufacturer = this._bridge.getStrVal(E.MANUFACTURER);
    if (manufacturer) {
      const c = manufacturer.replace(/[^\x20-\x7E]/g, '').trim();
      const m = c.match(/JK\S*/);
      if (this._els.sysBmsModel) this._els.sysBmsModel.textContent = m ? m[0] : c;
    } else if (this._els.sysBmsModel) this._els.sysBmsModel.textContent = '--';

    const mosfetTemp = snap.mosfetTemp;
    if (mosfetTemp != null) {
      const el = this._els.battMosfetTemp;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, mosfetTemp, 600, v => v.toFixed(1) + ' \u00B0C');
    } else if (this._els.battMosfetTemp) this._els.battMosfetTemp.textContent = '--';

    // Dynamic battery specs
    const strings = snap.strings;
    if (strings > 0) {
      this._bridge.battSpec.strings = strings;
      this._bridge.battSpec.nomV = strings * this._bridge.battSpec.voltsPerCell;
      if (this._els.sysConfig) this._els.sysConfig.textContent = strings + 'S';
      const nomEl = this._els.sysNominal;
      const oldNom = parseFloat(nomEl.textContent) || 0;
      this._animateValue(nomEl, oldNom, this._bridge.battSpec.nomV, 600, v => v.toFixed(1) + ' V');
    }

    if (remaining > 0 && soc > 10) {
      this._bridge.battSpec.fullAh = Math.round(remaining / (soc / 100));
      const capEl = this._els.sysCapacity;
      const oldCap = parseFloat(capEl.textContent) || 0;
      this._animateValue(capEl, oldCap, this._bridge.battSpec.fullAh, 600, v => Math.round(v) + ' Ah');
    }

    // Update chemistry display
    const chemEl = this._els.sysChemistry;
    if (chemEl) chemEl.textContent = this._bridge.battSpec.chemistry;
  }

  // ============ POWER FLOW ============
  _powerToAnimSpeed(watts) {
    const t = Math.min(Math.abs(watts), 1500) / 1500;
    return (2.5 - t * 2.1).toFixed(2) + 's';
  }

  _setIconGlow(id, cls, watts) {
    // P4: Lazy-cache dynamic icon refs (iconSolar, iconGrid, iconHome)
    const el = this._els[id] || (this._els[id] = this.shadowRoot.getElementById(id));
    if (!el) return;
    const newClass = 'flow-icon ' + cls;
    if (el.className !== newClass) el.className = newClass;
    if (watts != null) el.style.setProperty('--anim-speed', this._powerToAnimSpeed(watts));
  }

  _updatePowerFlow(snap) {
    const root = this.shadowRoot;
    const current = snap.current || 0;
    const dischgPower = snap.dischgPower;
    const chgPower = snap.chgPower;
    const netPower = Math.abs(snap.power || 0);
    const power = dischgPower > 0 ? dischgPower : chgPower > 0 ? chgPower : netPower;
    const solarW = chgPower > 0 ? chgPower : (current > 0 ? power : 0);
    const batteryW = dischgPower > 0 ? dischgPower : power;
    const charging = current > 0.5;
    const discharging = current < -0.5;

    this._setIconGlow('iconSolar', solarW > 10 ? 'icon-sun-active' : 'glow-dim', solarW);

    if (!this._els.flowWrap1) {
      this._els.flowWrap1 = root.getElementById('flowWrap1');
      this._els.flowWatt1 = root.getElementById('flowWatt1');
      this._els.flowWrap2 = root.getElementById('flowWrap2');
      this._els.flowWatt2 = root.getElementById('flowWatt2');
    }
    const wrap1 = this._els.flowWrap1;
    const watt1 = this._els.flowWatt1;
    if (charging) {
      wrap1.classList.remove('flow-idle');
      this._animateValue(watt1, parseFloat(watt1.textContent) || 0, Math.round(solarW), 600, v => Math.round(v) + ' W');
      watt1.style.color = '#00F0FF';
      if (this._flowPS1) this._flowPS1.start(solarW);
    } else {
      wrap1.classList.add('flow-idle');
      this._animateValue(watt1, parseFloat(watt1.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      watt1.style.color = 'var(--text2)';
      if (this._flowPS1) this._flowPS1.stop();
    }

    this._setIconGlow('iconBattery', charging ? 'icon-batt-charge' : discharging ? 'icon-batt-discharge' : 'glow-dim', Math.abs(batteryW));
    this._battArcPowerW = Math.abs(batteryW);
    if (charging || discharging) {
      const arcColor = charging ? '#00F0FF' : '#FF453A';
      this._startBattArcs(arcColor);
    } else {
      this._stopBattArcs();
    }

    const wrap2 = this._els.flowWrap2;
    const watt2 = this._els.flowWatt2;
    if (discharging) {
      wrap2.classList.remove('flow-idle');
      this._animateValue(watt2, parseFloat(watt2.textContent) || 0, Math.round(Math.abs(batteryW)), 600, v => Math.round(v) + ' W');
      watt2.style.color = 'var(--red)';
      if (this._flowPS2) this._flowPS2.start(Math.abs(batteryW));
    } else {
      wrap2.classList.add('flow-idle');
      this._animateValue(watt2, parseFloat(watt2.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      watt2.style.color = 'var(--text2)';
      if (this._flowPS2) this._flowPS2.stop();
    }

    this._setIconGlow('iconHome', discharging ? 'icon-home-active' : charging ? 'icon-home-idle' : 'glow-dim', Math.abs(batteryW));
  }

  // ============ CHART VALUE DISPLAYS ============
  _updateChartValues(snap) {
    const root = this.shadowRoot;

    // Live view: show real-time values from HA
    if (this._activeChartRange === 'Live') {
      const dischgPower = snap.dischgPower;
      const chgPower    = snap.chgPower;
      const power       = snap.power;
      const soc         = snap.soc;
      if (!this._els.pwrVal) {
        this._els.pwrVal = root.getElementById('pwrVal');
        this._els.socVal = root.getElementById('socVal');
        this._els.solVal = root.getElementById('solVal');
      }
      const pwrEl = this._els.pwrVal;
      const socEl = this._els.socVal;
      const solEl = this._els.solVal;
      // Power shows discharging power only
      if (pwrEl) {
        const dischargeVal = dischgPower > 0 ? dischgPower : (power != null && power < -0.5 ? Math.abs(power) : null);
        if (dischargeVal != null && dischargeVal > 0.5) pwrEl.textContent = Math.round(dischargeVal) + ' W';
        else pwrEl.textContent = '--';
      }
      if (socEl && soc != null) socEl.textContent = Math.round(soc) + '%';
      // Solar shows charging power only
      if (solEl) {
        const chargeVal = chgPower > 0 ? chgPower : (power != null && power > 0.5 ? power : null);
        if (chargeVal != null && chargeVal > 0.5) solEl.textContent = Math.round(chargeVal) + ' W';
        else solEl.textContent = '--';
      }
      return;
    }

    // Historical views: show averages from stored chart data
    if (!this._charts) return;
    const powerData = this._charts.getChartData('chartPower');
    const socData = this._charts.getChartData('chartSOC');
    const solarData = this._charts.getChartData('chartSolar');

    const pwrEl = this._els.pwrVal || (this._els.pwrVal = root.getElementById('pwrVal'));
    const socEl = this._els.socVal || (this._els.socVal = root.getElementById('socVal'));
    const solEl = this._els.solVal || (this._els.solVal = root.getElementById('solVal'));
    if (pwrEl && powerData?.length) {
      const avg = powerData.reduce((s, v) => s + (v || 0), 0) / powerData.length;
      pwrEl.textContent = Math.round(Math.abs(avg)) + ' W';
    }
    if (socEl && socData?.length) {
      const avg = socData.reduce((s, v) => s + (v || 0), 0) / socData.length;
      socEl.textContent = Math.round(avg) + '%';
    }
    if (solEl && solarData?.length) {
      const avg = solarData.reduce((s, v) => s + (v || 0), 0) / solarData.length;
      solEl.textContent = Math.round(avg) + ' W';
    }
  }

  // ============ BATTERY ARCS ============
  _genBolt(x1, y1, x2, y2, detail) {
    const pts = [{ x: x1, y: y1 }];
    const segments = detail || 4 + Math.floor(Math.random() * 3);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 14,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10,
      });
    }
    pts.push({ x: x2, y: y2 });
    return 'M' + pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L');
  }

  _genBranch() {
    const cx = 24, cy = 24;
    const angle = Math.random() * Math.PI * 2;
    const r1 = 8 + Math.random() * 10;
    const r2 = r1 + 4 + Math.random() * 8;
    return this._genBolt(
      cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1,
      cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2,
      2 + Math.floor(Math.random() * 2)
    );
  }

  _drawAnimeBolt(svg, d, color, coreWidth, glowWidth) {
    const ns = 'http://www.w3.org/2000/svg';
    const glow = document.createElementNS(ns, 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', color);
    glow.setAttribute('stroke-width', String(glowWidth));
    glow.setAttribute('stroke-linecap', 'round');
    glow.setAttribute('stroke-linejoin', 'round');
    glow.setAttribute('opacity', '0.5');
    glow.style.filter = 'blur(2px)';
    svg.appendChild(glow);

    const core = document.createElementNS(ns, 'path');
    core.setAttribute('d', d);
    core.setAttribute('fill', 'none');
    core.setAttribute('stroke', '#fff');
    core.setAttribute('stroke-width', String(coreWidth));
    core.setAttribute('stroke-linecap', 'round');
    core.setAttribute('stroke-linejoin', 'round');
    core.setAttribute('opacity', '0.95');
    svg.appendChild(core);

    const len = core.getTotalLength();
    core.style.strokeDasharray = len;
    core.style.strokeDashoffset = len;
    glow.style.strokeDasharray = len;
    glow.style.strokeDashoffset = len;
    core.style.transition = 'stroke-dashoffset 0.08s linear';
    glow.style.transition = 'stroke-dashoffset 0.08s linear';
    requestAnimationFrame(() => { core.style.strokeDashoffset = '0'; glow.style.strokeDashoffset = '0'; });
  }

  _flashAnimeBolts(color) {
    const svg = this.shadowRoot.getElementById('battArcs');
    if (!svg) return;
    svg.innerHTML = '';
    const cx = 24, cy = 24;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 8;
      const d = this._genBolt(cx, cy, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      this._drawAnimeBolt(svg, d, color, 1.4, 3.5);
      if (Math.random() > 0.5) {
        this._drawAnimeBolt(svg, this._genBranch(), color, 0.8, 2);
      }
    }
    this._boltTimeouts.push(setTimeout(() => {
      svg.style.opacity = '0.4';
      svg.style.transition = 'opacity 0.12s ease-out';
    }, 80));
    this._boltTimeouts.push(setTimeout(() => {
      svg.innerHTML = '';
      svg.style.opacity = '1';
      svg.style.transition = '';
    }, 200));
  }

  _startBattArcs(color) {
    if (this._battArcActive && this._battArcColor === color) return;
    if (this._battArcActive) this._stopBattArcs();
    this._battArcActive = true;
    this._battArcColor = color;
    const scheduleNext = () => {
      if (!this._battArcActive) return;
      const t = Math.min(this._battArcPowerW, 1500) / 1500;
      const delay = 300 + (1 - t) * 1700 + Math.random() * 500;
      this._battArcInterval = setTimeout(() => {
        if (!this._battArcActive) return;
        this._flashAnimeBolts(this._battArcColor);
        scheduleNext();
      }, delay);
    };
    this._flashAnimeBolts(color);
    scheduleNext();
  }

  _stopBattArcs() {
    if (!this._battArcActive) return;
    this._battArcActive = false;
    clearTimeout(this._battArcInterval);
    this._boltTimeouts.forEach(id => clearTimeout(id));
    this._boltTimeouts = [];
    const svg = this.shadowRoot.getElementById('battArcs');
    if (svg) svg.innerHTML = '';
  }

  // ============ WEATHER UPDATE ============
  _discoverWeatherEntity() {
    if (!this._bridge._hass) return null;
    // NI15: Reuse cached entity if still available — avoids scanning all hass.states every 5 min
    if (this._weatherEntityId && this._bridge._hass.states[this._weatherEntityId]) {
      return this._weatherEntityId;
    }
    const states = this._bridge._hass.states;
    const now = Date.now();
    const STALE_MS = 30 * 60 * 1000; // 30 minutes

    const candidates = Object.entries(states)
      .filter(([id, s]) => id.startsWith('weather.') && !['unavailable', 'unknown'].includes(s.state));
    if (!candidates.length) return null;

    // Identify source and check staleness
    const scored = candidates.map(([id, s]) => {
      const att = (s.attributes?.attribution || '').toLowerCase();
      let source = 'other';
      if (att.includes('google')) source = 'google';
      else if (att.includes('pirate')) source = 'pirateweather';
      else if (att.includes('met.no')) source = 'metno';

      const lastUpdated = new Date(s.last_updated || s.last_changed).getTime();
      const isStale = (now - lastUpdated) > STALE_MS;

      return { id, source, isStale, lastUpdated };
    });

    // Priority order: google > pirateweather > metno > other
    const priority = ['google', 'pirateweather', 'metno'];
    for (const p of priority) {
      const match = scored.find(s => s.source === p && !s.isStale);
      if (match) return match.id;
    }

    // Fallback: any non-stale entity, or stale if nothing fresh
    const fresh = scored.find(s => !s.isStale);
    return fresh ? fresh.id : scored[0].id;
  }

  _discoverMoonPhaseEntity() {
    if (!this._bridge._hass) return null;
    const knownStates = new Set(Object.keys(MOON_PHASE_BRIGHTNESS));
    const match = Object.entries(this._bridge._hass.states)
      .find(([id, s]) => id.startsWith('sensor.') && knownStates.has(s.state));
    return match ? match[0] : null;
  }

  _updateWeather() {
    this._weatherEntityId = this._discoverWeatherEntity();
    if (!this._weatherEntityId) return;

    const state = this._bridge.getState(this._weatherEntityId);
    if (!state) return;
    const attrs = state.attributes || {};
    const root = this.shadowRoot;

    // Cloud coverage
    let cloudPct;
    if (attrs.cloud_coverage != null) {
      cloudPct = parseFloat(attrs.cloud_coverage);
    } else {
      const condition = state.state || '';
      cloudPct = CONDITION_CLOUD_MAP[condition] ?? 50;
    }
    this._weatherCloudFactor = cloudTransmission(cloudPct);

    // Apply weather backdrop
    const windSpeed = parseFloat(attrs.wind_speed) || 0;
    const cloudCoverage = attrs.cloud_coverage ?? null;
    const windBearing = attrs.wind_bearing ?? 180;
    this._applyWeatherBackdrop(state.state, windSpeed, cloudCoverage, windBearing);

    // Temperature for solar engine
    if (attrs.temperature != null) {
      this._weatherAmbientC = parseFloat(attrs.temperature);
    }

    // Update weather source indicator — dynamic, works with any integration
    const sourceEl = this._els.wxSource;
    if (sourceEl) {
      const att = attrs.attribution || '';
      const friendly = attrs.friendly_name || '';
      const src = (
        att.replace(/^(data from|powered by|weather forecast from|forecast from)\s+/i, '')
           .replace(/,.*$/, '')
           .trim()
        || friendly
        || this._weatherEntityId.replace('weather.', '').replace(/_/g, ' ')
      ).slice(0, 30);
      sourceEl.textContent = 'via ' + src;
    }

    // Update weather display
    const condition = state.state || '--';
    const condEl = root.getElementById('wxCondition');
    if (condEl) condEl.textContent = COND_LABELS[condition] || condition.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const tempEl = root.getElementById('wxTemp');
    if (tempEl) {
      if (attrs.temperature != null) {
        this._animateValue(tempEl, parseFloat(tempEl.textContent) || 0, parseFloat(attrs.temperature), 600, v => v.toFixed(1) + '\u00B0C');
      } else tempEl.textContent = '--';
    }

    const cloudEl = root.getElementById('wxCloud');
    if (cloudEl) {
      if (cloudPct != null) {
        this._animateValue(cloudEl, parseFloat(cloudEl.textContent) || 0, cloudPct, 600, v => Math.round(v) + '%');
      } else cloudEl.textContent = '--';
    }

    const humidEl = root.getElementById('wxHumid');
    if (humidEl) {
      if (attrs.humidity != null) {
        this._animateValue(humidEl, parseFloat(humidEl.textContent) || 0, parseFloat(attrs.humidity), 600, v => Math.round(v) + '%');
      } else humidEl.textContent = '--';
    }

    // Update solar estimate on weather change
    this._updateSolarEstimate();
  }

  _applyWeatherBackdrop(condition, windSpeed = 0, cloudCoverage = null, windBearing = 180) {
    const rootEl = this._els.dashRoot;
    if (!rootEl) return;
    if (condition !== undefined) {
      this._lastWeatherCondition = condition;
      this._lastWindSpeed        = windSpeed;
      this._lastCloudCoverage    = cloudCoverage;
      this._lastWindBearing      = windBearing;
    } else {
      condition     = this._lastWeatherCondition;
      windSpeed     = this._lastWindSpeed    ?? 0;
      cloudCoverage = this._lastCloudCoverage ?? null;
      windBearing   = this._lastWindBearing  ?? 180;
    }
    if (!condition) return;
    const theme = rootEl.dataset.theme || 'dark';
    const palettes = WEATHER_PALETTES[theme] || WEATHER_PALETTES.dark;

    let isNight = false;
    let sunElevation = -90, sunAzimuth = 180;
    if (this._engine && this._bridge.latitude != null) {
      const sp = this._engine.getPosition(new Date());
      sunElevation = sp.elevation;
      sunAzimuth   = sp.azimuth;
      isNight = sunElevation < 0;
      this._lastSunNight = isNight;
    }

    let key = CONDITION_PALETTE_MAP[condition] || null;
    if (isNight && key !== 'night') key = (key && key !== 'sunny') ? `night_${key}` : 'night';

    const colors = palettes[key];
    if (!colors) return;

    const newTargets = colors.map(c => this._parseRgba(c));
    if (!this._meshCur[0]) this._meshCur = newTargets.map(t => ({ ...t }));
    this._meshTarget = newTargets;
    // NB2: Restart mesh lerp if it was stopped after previous convergence
    if (!this._meshRafId) this._startMeshLerp();

    // Moon phase brightness (0=new, 1=full) — auto-discovered entity
    if (!this._moonPhaseEntityId) this._moonPhaseEntityId = this._discoverMoonPhaseEntity();
    const moonState = this._moonPhaseEntityId ? this._bridge.getState(this._moonPhaseEntityId) : null;
    const _mb = moonState ? MOON_PHASE_BRIGHTNESS[moonState.state] : undefined;
    if (_mb !== undefined) this._lastMoonBrightness = _mb;
    const moonBrightness = this._lastMoonBrightness;

    // Moon position from Meeus algorithm
    let moonElevation = -90, moonAzimuth = 180;
    if (this._engine && this._bridge.latitude != null) {
      const mp = this._engine.getMoonPosition(new Date());
      moonElevation = mp.elevation;
      moonAzimuth   = mp.azimuth;
    }

    // Update weather FX particles — pass original HA condition, not the palette key,
    // because WeatherFX.start() does its own condition-to-particle mapping
    // B23: Skip if parameters haven't changed (prevents redundant fade loops)
    if (this._weatherFx) {
      const fxKey = `${condition}|${isNight}|${windSpeed.toFixed(0)}|${moonBrightness.toFixed(2)}`;
      if (fxKey !== this._fxKey) {
        this._weatherFx.start(condition, isNight, theme, windSpeed, moonBrightness, moonElevation, moonAzimuth, sunElevation, sunAzimuth, cloudCoverage, windBearing);
        this._fxKey = fxKey;
      }
    }
  }

  // ============ SOLAR UPDATE ============
  _getPanelConfig() {
    return {
      count: this._bridge.panelCount,
      ratedWatts: this._bridge.panelRatedWatts,
      efficiency: this._bridge.panelEfficiency,
      tilt: this._bridge.panelTilt,
      azimuth: this._bridge.panelAzimuth,
      areaEach: this._bridge.panelAreaEach,
      model: this._bridge.panelModel,
      type: this._bridge.panelType,
    };
  }

  _parseRgba(str) {
    const m = str && str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 } : null;
  }

  _startMeshLerp() {
    if (this._meshRafId) return;
    const step = () => {
      if (!this._meshTarget) {
        this._meshRafId = null;
        return;
      }
      const root = this._els.dashRoot;
      if (root && this._meshCur[0]) {
        const L = 0.004;
        let converged = true;
        for (let i = 0; i < 3; i++) {
          const c = this._meshCur[i], t = this._meshTarget[i];
          if (!c || !t) { converged = false; continue; }
          c.r += (t.r - c.r) * L; c.g += (t.g - c.g) * L;
          c.b += (t.b - c.b) * L; c.a += (t.a - c.a) * L;
          if (Math.abs(c.r - t.r) > 0.5 || Math.abs(c.g - t.g) > 0.5 ||
              Math.abs(c.b - t.b) > 0.5 || Math.abs(c.a - t.a) > 0.001) {
            converged = false;
          }
        }
        root.style.setProperty('--mesh-1', `rgba(${Math.round(this._meshCur[0].r)},${Math.round(this._meshCur[0].g)},${Math.round(this._meshCur[0].b)},${this._meshCur[0].a.toFixed(3)})`);
        root.style.setProperty('--mesh-2', `rgba(${Math.round(this._meshCur[1].r)},${Math.round(this._meshCur[1].g)},${Math.round(this._meshCur[1].b)},${this._meshCur[1].a.toFixed(3)})`);
        root.style.setProperty('--mesh-3', `rgba(${Math.round(this._meshCur[2].r)},${Math.round(this._meshCur[2].g)},${Math.round(this._meshCur[2].b)},${this._meshCur[2].a.toFixed(3)})`);
        if (converged) {
          // Snap to exact target and stop the loop — no CPU waste after convergence (NB2)
          for (let i = 0; i < 3; i++) {
            this._meshCur[i] = { ...this._meshTarget[i] };
          }
          this._meshRafId = null;
          return;
        }
      }
      this._meshRafId = requestAnimationFrame(step);
    };
    this._meshRafId = requestAnimationFrame(step);
  }

  _updateSunMoonPosition() {
    if (!this._weatherFx || !this._engine || !this._bridge._hass || this._bridge.latitude == null) return;
    const now = new Date();
    const sp = this._engine.getPosition(now);
    const mp = this._engine.getMoonPosition(now);
    const isNight = sp.elevation < 0;
    if (isNight !== this._lastSunNight) {
      this._lastSunNight = isNight;
      this._applyWeatherBackdrop();
      return;
    }
    const moonState = this._moonPhaseEntityId ? this._bridge._hass.states[this._moonPhaseEntityId] : null;
    const moonBrightness = moonState ? (MOON_PHASE_BRIGHTNESS[moonState.state] ?? 0.5) : 0.5;
    this._weatherFx.updateSunMoon(sp.elevation, sp.azimuth, mp.elevation, mp.azimuth, moonBrightness);
    const planets = this._engine.getPlanetPositions ? this._engine.getPlanetPositions(now) : [];
    const gc = this._engine.getGalacticCenterPos ? this._engine.getGalacticCenterPos(now) : { elevation: -90, azimuth: 180 };
    this._weatherFx.updateNightSky(planets, gc.azimuth, gc.elevation, this._issPos);
  }

  async _fetchISSPosition() {
    if (this._bridge.latitude == null) return;
    try {
      const ctl = new AbortController();
      const tid = setTimeout(() => ctl.abort(), 8000);
      const resp = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { signal: ctl.signal });
      clearTimeout(tid);
      if (!resp.ok) return;
      const data = await resp.json();
      const { latitude: iLat, longitude: iLon, altitude: iAlt, visibility } = data;
      // Only show when ISS is in sunlight and observer is in darkness
      if (visibility !== 'visible') { this._issPos = null; return; }
      // ECEF → ENU elevation/azimuth
      const toR = d => d * Math.PI / 180;
      const toD = r => r * 180 / Math.PI;
      const R = 6371;
      const latO = toR(this._bridge.latitude);
      const lonO = toR(this._bridge.longitude);
      const latI = toR(iLat);
      const lonI = toR(iLon);
      const rI = R + iAlt;
      const xO = R * Math.cos(latO) * Math.cos(lonO);
      const yO = R * Math.cos(latO) * Math.sin(lonO);
      const zO = R * Math.sin(latO);
      const xI = rI * Math.cos(latI) * Math.cos(lonI);
      const yI = rI * Math.cos(latI) * Math.sin(lonI);
      const zI = rI * Math.sin(latI);
      const dx = xI - xO, dy = yI - yO, dz = zI - zO;
      const E = -Math.sin(lonO) * dx + Math.cos(lonO) * dy;
      const N = -Math.sin(latO)*Math.cos(lonO)*dx - Math.sin(latO)*Math.sin(lonO)*dy + Math.cos(latO)*dz;
      const U = Math.cos(latO)*Math.cos(lonO)*dx + Math.cos(latO)*Math.sin(lonO)*dy + Math.sin(latO)*dz;
      const elev = toD(Math.atan2(U, Math.sqrt(E*E + N*N)));
      const az   = (toD(Math.atan2(E, N)) + 360) % 360;
      this._issPos = elev > 5 ? { elevation: elev, azimuth: az } : null;
    } catch (_) {
      this._issPos = null;
    }
  }

  _updateSolarEstimate() {
    if (!this._solarEngineReady || !this._engine) return;
    const root = this.shadowRoot;
    const now = new Date();
    const sunPos = this._engine.getPosition(now);
    const isDay = sunPos.elevation > 0;

    // Night: skip expensive solar math, animate to 0
    if (!isDay) {
      this._wasDay = false;
      this._cachedForecastKWh = 0;
      this._lastForecastHour = -1;
      const solOutput = root.getElementById('solOutput');
      if (solOutput) {
        this._animateValue(solOutput, parseFloat(solOutput.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      }
      const solForecast = root.getElementById('solForecast');
      if (solForecast) {
        this._animateValue(solForecast, parseFloat(solForecast.textContent) || 0, 0, 600, v => v.toFixed(1) + ' kWh');
      }
      return;
    }

    // Day: full solar math pipeline
    if (!this._wasDay) this._lastForecastHour = -1; // reset on sunrise
    this._wasDay = true;
    const panelConfig = this._getPanelConfig();
    this._engine.getDegradationInfo(now, panelConfig);
    const result = this._engine.calcSolarOutput(now, panelConfig, (1 - this._weatherCloudFactor) * 100, this._weatherAmbientC);

    const solOutput = root.getElementById('solOutput');
    if (solOutput) {
      this._animateValue(solOutput, parseFloat(solOutput.textContent) || 0, result.watts, 600, v => Math.round(v) + ' W');
    }

    const currentHour = now.getHours();
    if (currentHour !== this._lastForecastHour) {
      this._lastForecastHour = currentHour;
      this._cachedForecastKWh = this._engine.calcDailyForecast(now, panelConfig, (1 - this._weatherCloudFactor) * 100, this._weatherAmbientC);
    }
    const solForecast = root.getElementById('solForecast');
    if (solForecast) {
      this._animateValue(solForecast, parseFloat(solForecast.textContent) || 0, this._cachedForecastKWh, 600, v => v.toFixed(1) + ' kWh');
    }
  }

  _updateSolarUI() {
    if (!this._engine) return;
    const root = this.shadowRoot;
    const now = new Date();
    const panelConfig = this._getPanelConfig();
    const s = this._engine.getDegradationInfo(now, panelConfig);

    const healthEl = root.getElementById('solHealthPct');
    if (healthEl) this._animateValue(healthEl, parseFloat(healthEl.textContent) || 0, s.healthPct, 600, v => v.toFixed(1) + '%');

    const fillEl = root.getElementById('solDegFill');
    if (fillEl) fillEl.style.width = s.healthPct + '%';

    const degEl = root.getElementById('solDegPct');
    if (degEl) this._animateValue(degEl, parseFloat(degEl.textContent.replace('\u2212', '')) || 0, s.degradationPct, 600, v => '\u2212' + v.toFixed(1) + '%');

    root.getElementById('solInstalled').textContent = s.installStr;
    root.getElementById('solAge').textContent = s.ageStr;
    root.getElementById('solModel').textContent = s.model;
    root.getElementById('solType').textContent = s.type;
    root.getElementById('solRated').textContent = s.totalRatedW + ' W';
    root.getElementById('solYr1').textContent = '\u2212' + (s.yr1Loss * 100).toFixed(0) + '% LID';
    root.getElementById('solYrN').textContent = '\u2212' + (s.annualLoss * 100).toFixed(1) + '%/yr';

    const nextYrEl = root.getElementById('solNextYr');
    if (nextYrEl) this._animateValue(nextYrEl, parseFloat(nextYrEl.textContent) || 0, s.nextYrW, 600, v => Math.round(v) + ' W');
  }

  // ============ CELL BALANCE ============
  _updateCellBalance() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const voltages = [];
    for (let i = 1; i <= 16; i++) {
      const v = this._bridge.getVal(E['CELL' + i]);
      voltages.push((v != null && v > 0) ? v : null);
    }
    const validVoltages = voltages.filter(v => v != null);
    if (validVoltages.length === 0) return;

    const globalMaxI = voltages.indexOf(Math.max(...validVoltages));
    const globalMinI = voltages.indexOf(Math.min(...validVoltages));
    const pack1 = voltages.slice(0, 8).filter(v => v != null);
    const pack2 = voltages.slice(8).filter(v => v != null);
    if (pack1.length > 0) this._renderPack('pack1', pack1, 1, globalMaxI, globalMinI);
    if (pack2.length > 0) this._renderPack('pack2', pack2, 9, globalMaxI, globalMinI);
    this._applyBal(voltages);
  }

  _renderPack(containerId, voltages, startIdx, globalMaxI, globalMinI) {
    const el = this.shadowRoot.getElementById(containerId);
    if (!el) return;
    const allV = typeof voltages === 'object' ? Object.values(voltages) : voltages;
    const existing = el.querySelectorAll('.cell-row-item');
    if (existing.length !== allV.length) {
      el.innerHTML = '';
      allV.forEach(() => {
        const row = document.createElement('div');
        row.className = 'cell-row-item';
        row.innerHTML = '<span class="cell-id"></span><div class="cell-bar-bg"><div class="cell-bar"></div></div><span class="cell-val"></span>';
        el.appendChild(row);
      });
    }
    const rows = el.querySelectorAll('.cell-row-item');
    const { vmin, vmax } = cellBounds(this._bridge.battSpec.chemistry);
    allV.forEach((v, gi) => {
      const globalI = startIdx - 1 + gi;
      const pct = Math.max(2, Math.min(100, ((v - vmin) / (vmax - vmin || 0.001)) * 100));
      const row = rows[gi];
      const isHigh = globalI === globalMaxI;
      const isLow = globalI === globalMinI;
      const wantClass = isHigh ? 'cell-row-item cell-high' : isLow ? 'cell-row-item cell-low' : 'cell-row-item';
      if (row.className !== wantClass) row.className = wantClass;
      const tag = isHigh ? '<span class="cell-tag high">\u25B2</span>' : isLow ? '<span class="cell-tag low">\u25BC</span>' : '';
      const idEl = row.querySelector('.cell-id');
      const newId = `C${startIdx + gi}${tag}`;
      // NB3: Compare textContent (reliable) instead of innerHTML (fragile due to browser normalization)
      const newText = `C${startIdx + gi}`;
      const newState = isHigh ? 'high' : isLow ? 'low' : 'normal';
      if (idEl.textContent !== newText || row.dataset.cellState !== newState) {
        idEl.innerHTML = newId;
        row.dataset.cellState = newState;
      }
      row.querySelector('.cell-bar').style.width = pct + '%';
      const cellValEl = row.querySelector('.cell-val');
      this._animateValue(cellValEl, parseFloat(cellValEl.textContent) || 0, v, 600, val => val.toFixed(3) + ' V');
    });
  }

  _applyBal(voltages) {
    const root = this.shadowRoot;
    const allV = [...voltages];
    const maxI = allV.indexOf(Math.max(...allV));
    const minI = allV.indexOf(Math.min(...allV));
    const delta = (Math.max(...allV) - Math.min(...allV)) * 1000;
    const balancing = this._bridge.getStrVal(this._bridge.E.BALANCING) === 'on';

    // Remove old balancing classes
    root.querySelectorAll('.cell-high-balancing, .cell-low-balancing').forEach(el => {
      el.classList.remove('cell-high-balancing', 'cell-low-balancing');
    });

    if (balancing) {
      // Find the cell bar elements for source and destination
      const pack1Rows = root.querySelectorAll('#pack1 .cell-row-item');
      const pack2Rows = root.querySelectorAll('#pack2 .cell-row-item');
      const allRows = [...pack1Rows, ...pack2Rows];
      const srcCell = allRows[maxI];
      const dstCell = allRows[minI];

      if (srcCell && dstCell) {
        srcCell.classList.add('cell-high-balancing');
        dstCell.classList.add('cell-low-balancing');
      }

      // Show balancing indicator
      root.getElementById('balSrc').textContent = 'C' + (maxI + 1);
      root.getElementById('balDst').textContent = 'C' + (minI + 1);
      root.getElementById('balIndicator').style.display = 'block';
    } else {
      root.getElementById('balIndicator').style.display = 'none';
    }

    const balStatusEl = root.getElementById('balStatus');
    const oldDelta = parseFloat(balStatusEl.textContent.replace(/[^0-9.]/g, '')) || 0;
    const suffix = balancing ? 'mV \u2014 Balancing' : 'mV';
    this._animateValue(balStatusEl, oldDelta, delta, 600, v => `\u0394 ${Math.round(v)}${suffix}`);
  }

  // ============ CALC TODAY IN/OUT ============
  async _calcTodayInOut() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const tz = this._bridge.timezone;
    try {
      const now = new Date();
      const todayStr = new Intl.DateTimeFormat('sv', { timeZone: tz }).format(now);
      // DST-safe midnight: use a noon UTC seed so we're on the right calendar day,
      // then step back by however many local h:m have elapsed to reach 00:00 local.
      const svFmt   = new Intl.DateTimeFormat('sv', { timeZone: tz });
      const timeFmt = new Intl.DateTimeFormat('sv', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      let candidate = new Date(`${todayStr}T12:00:00Z`);
      // Ensure candidate is on the correct local date (handles edge-case offsets > ±12h)
      if (svFmt.format(candidate) < todayStr) candidate = new Date(candidate.getTime() + 86400000);
      if (svFmt.format(candidate) > todayStr) candidate = new Date(candidate.getTime() - 86400000);
      const [lh, lm] = timeFmt.format(candidate).split(':').map(Number);
      let midnightUTC = new Date(candidate.getTime() - (lh * 3600 + lm * 60) * 1000);
      // DST correction: noon offset may differ from midnight offset (spring-forward); verify and nudge
      const [vh, vm] = timeFmt.format(midnightUTC).split(':').map(Number);
      if (vh !== 0 || vm !== 0) midnightUTC = new Date(midnightUTC.getTime() - (vh * 3600 + vm * 60) * 1000);

      // Helper: integrate Watts history → kWh (rectangular rule, gap cap 1h)
      const integrateWatts = (states) => {
        let kWh = 0;
        for (let i = 1; i < states.length; i++) {
          const prevV = states[i - 1].v;
          if (prevV === null || prevV < 0) continue;
          const dtHours = (states[i].t.getTime() - states[i - 1].t.getTime()) / 3600000;
          if (dtHours > 0 && dtHours < 1) kWh += prevV * dtHours / 1000;
        }
        if (states.length > 0) {
          const last = states[states.length - 1];
          if (last.v !== null && last.v >= 0) {
            const dtHours = (now.getTime() - last.t.getTime()) / 3600000;
            if (dtHours > 0 && dtHours < 1) kWh += last.v * dtHours / 1000;
          }
        }
        return kWh;
      };

      if (E.CHG_POWER && E.DISCHG_POWER) {
        // Preferred: dedicated power sensors — clean, no sign ambiguity
        const [chgStates, dischgStates] = await Promise.all([
          this._bridge.fetchHistoryRange(E.CHG_POWER,    midnightUTC, now, true),
          this._bridge.fetchHistoryRange(E.DISCHG_POWER, midnightUTC, now, true),
        ]);
        this._todayIn  = chgStates ? integrateWatts(chgStates) : 0;
        this._todayOut = dischgStates ? integrateWatts(dischgStates) : 0;
      } else {
        // Fallback: signed current sensor (Ah → kWh)
        const nomV = this._bridge.battSpec.nomV;
        const states = await this._bridge.fetchHistoryRange(E.CURRENT, midnightUTC, now, true);
        let inAh = 0, outAh = 0;
        if (states) {
          for (let i = 1; i < states.length; i++) {
            const prevV = states[i - 1].v;
            if (prevV === null) continue;
            const dtHours = (states[i].t.getTime() - states[i - 1].t.getTime()) / 3600000;
            if (dtHours > 0 && dtHours < 1) {
              if (prevV > 0.1) inAh += prevV * dtHours;
              else if (prevV < -0.1) outAh += Math.abs(prevV) * dtHours;
            }
          }
          if (states.length > 0) {
            const last = states[states.length - 1];
            if (last.v !== null) {
              const dtHours = (now.getTime() - last.t.getTime()) / 3600000;
              if (dtHours > 0 && dtHours < 1) {
                if (last.v > 0.1) inAh += last.v * dtHours;
                else if (last.v < -0.1) outAh += Math.abs(last.v) * dtHours;
              }
            }
          }
        }
        this._todayIn  = inAh * nomV / 1000;
        this._todayOut = outAh * nomV / 1000;
      }
    } catch (e) { console.warn('[Solar] Today In/Out fetch failed', e); }

    // _todayIn / _todayOut are kWh
    const inEl = root.getElementById('battTodayIn');
    this._animateValue(inEl, parseFloat(inEl.textContent) || 0, this._todayIn, 600, v => v.toFixed(2) + ' kWh');
    const outEl = root.getElementById('battTodayOut');
    this._animateValue(outEl, parseFloat(outEl.textContent) || 0, this._todayOut, 600, v => v.toFixed(2) + ' kWh');

    // Solar generation today = charging energy (all charging assumed solar)
    const solTodayEl = root.getElementById('solTodayGen');
    if (solTodayEl) {
      this._animateValue(solTodayEl, parseFloat(solTodayEl.textContent) || 0, this._todayIn, 600, v => v.toFixed(1) + ' kWh');
    }
  }

  // ============ CLOCK ============
  _startClock() {
    const el = this.shadowRoot.getElementById('clock');
    if (el) {
      if (!this._clockFormatter) {
        this._clockFormatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: this._bridge.timezone,
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
      }
      el.textContent = this._clockFormatter.format(new Date());
    }
  }

  // ============ CHARTS ============
  async _loadChartRange(range) {
    this._activeChartRange = range;
    if (!this._charts) return;
    // P22: Debounce to prevent API spam from rapid tab clicks / visibility resume
    const now = Date.now();
    if (this._chartFetchDebounce[range] && now - this._chartFetchDebounce[range] < 2000) return;
    this._chartFetchDebounce[range] = now;
    const root = this.shadowRoot;
    const E = this._bridge.E;
    // Guard: wait for entity discovery to complete
    if (!E || !E.POWER || !E.SOC) {
      return;
    }
    const canvases = {
      power: root.getElementById('chartPower'),
      soc: root.getElementById('chartSOC'),
      solar: root.getElementById('chartSolar'),
    };
    const batteryPowerEntity = E.DISCHG_POWER || E.POWER;
    const solarPowerEntity = E.CHG_POWER || E.POWER;
    const samePowerEntity = batteryPowerEntity === solarPowerEntity;

    let result, solarResult;
    try {
      if (samePowerEntity) {
        // NI3: Both charts use the same entity — fetch once, loadRange splits signed data
        // (battery chart takes negative=discharge, solar chart takes positive=charge)
        result = await this._charts.loadRange(range, canvases, {
          power: batteryPowerEntity,
          soc: E.SOC,
          _signed: !E.DISCHG_POWER,
        }, this._bridge.timezone);
        solarResult = { powerData: result.powerData, timeXLabel: result.timeXLabel };
      } else {
        [result, solarResult] = await Promise.all([
          this._charts.loadRange(range, canvases, {
            power: batteryPowerEntity,
            soc: E.SOC,
            _signed: !E.DISCHG_POWER,
          }, this._bridge.timezone),
          this._charts.loadRange(range, { solar: canvases.solar }, {
            power: solarPowerEntity,
            _signed: !E.CHG_POWER,
          }, this._bridge.timezone),
        ]);
      }
    } catch (e) {
      console.warn('[Solar] Chart data load failed:', e);
      return;
    }

    // Overlay estimated solar line on solar chart
    // For Live: use current weather conditions for fair comparison
    // For historical (1D/7D/30D): use clear-sky (no weather) since past weather is unknown
    if (canvases.solar && solarResult.powerData?.length && this._engine && this._solarEngineReady) {
      const panelConfig = this._getPanelConfig();
      const actualPts = solarResult.powerData.map(d => (d.v !== null) ? Math.max(d.v, 0) : 0);
      const isLive = range === 'Live';
      const is30D = range === '30D';
      const cloudPct = isLive ? (1 - this._weatherCloudFactor) * 100 : 0;
      const ambientC = isLive ? this._weatherAmbientC : null;
      let overlayPts, overlayLabel;
      if (is30D) {
        // 30D: show 7-day rolling average of actual as trend line
        overlayPts = actualPts.map((_, i) => {
          const window = actualPts.slice(Math.max(0, i - 6), i + 1);
          return window.reduce((a, b) => a + b, 0) / window.length;
        });
        overlayLabel = '7d avg';
      } else {
        overlayPts = solarResult.powerData.map(d => {
          const out = this._engine.calcSolarOutput(d.t, panelConfig, cloudPct, ambientC);
          return out.watts;
        });
        overlayLabel = 'W est';
      }
      this._charts.drawChart(canvases.solar, [
        { points: actualPts, color: 'rgb(34,197,94)', label: 'W', fill: true },
        { points: overlayPts, color: 'rgb(249,115,22)', label: overlayLabel, fill: false },
      ], { minY: 0, xLabel: solarResult.timeXLabel(solarResult.powerData), yFormat: v => Math.round(v) + ' W' }, false);
      this._charts.attachCrosshair(canvases.solar);
      const overlayLabelEl = root.getElementById('solarOverlayLabel');
      if (overlayLabelEl) overlayLabelEl.textContent = '\u25A0 ' + (is30D ? '7d avg' : 'Estimated');
    }

    // Update chart value displays with last data point
    const lastPwr = result.powerData?.[result.powerData.length - 1];
    const lastSoc = result.socData?.[result.socData.length - 1];
    const lastSol = solarResult.powerData?.[solarResult.powerData.length - 1];
    const pwrEl = root.getElementById('pwrVal');
    const socEl = root.getElementById('socVal');
    const solEl = root.getElementById('solVal');
    if (pwrEl && lastPwr?.v != null) pwrEl.textContent = Math.round(Math.abs(lastPwr.v)) + ' W';
    if (socEl && lastSoc?.v != null) socEl.textContent = Math.round(lastSoc.v) + '%';
    if (solEl && lastSol?.v != null) solEl.textContent = Math.round(Math.max(0, lastSol.v)) + ' W';

    // Pulse chart values
    ['pwrVal', 'socVal', 'solVal'].forEach(id => {
      const el = root.getElementById(id);
      if (el) { el.classList.remove('chart-value-pulse'); void el.offsetWidth; el.classList.add('chart-value-pulse'); }
    });
  }

  // ============ CYCLE RATE ============
  async _updateCycleRate() {
    const E = this._bridge.E;
    if (!E?.CYCLES) return;
    try {
      const data = await this._bridge.fetchStatsRange(E.CYCLES, 7);
      if (data?.length >= 2) {
        const delta = data[data.length - 1].v - data[0].v;
        this._cycleRatePerDay = (Math.max(0, delta) / 7).toFixed(2);
      }
    } catch (e) {
      // non-critical, leave null
    }
  }

  // ============ REFRESH ALL ============
  _refreshAllUI() {
    const E = this._bridge.E;
    const snap = {
      soc:        this._bridge.getVal(E.SOC),
      voltage:    this._bridge.getVal(E.VOLTAGE),
      current:    this._bridge.getVal(E.CURRENT),
      power:      this._bridge.getVal(E.POWER),
      remaining:  this._bridge.getVal(E.REMAINING),
      chgPower:   this._bridge.getVal(E.CHG_POWER),
      dischgPower:this._bridge.getVal(E.DISCHG_POWER),
      cycles:     this._bridge.getVal(E.CYCLES),
      throughput: this._bridge.getVal(E.THROUGHPUT),
      minCellV:   this._bridge.getVal(E.MIN_CELL_V),
      maxCellV:   this._bridge.getVal(E.MAX_CELL_V),
      mosfetTemp: this._bridge.getVal(E.MOSFET_TEMP),
      strings:    this._bridge.getVal(E.STRINGS),
    };
    this._updateBattery(snap);
    this._updatePowerFlow(snap);
    this._calcTodayInOut();
    this._updateCellBalance();
    this._updateWeather();
    this._updateSolarEstimate();
    this._updateSolarUI();

    // Dispatch all system entities
    const systemEntities = [E.TEMP1, E.TEMP2, E.MOSFET_TEMP, E.CYCLES, E.RUNTIME, E.THROUGHPUT,
      E.MIN_CELL_V, E.MAX_CELL_V, E.FIRMWARE, E.MANUFACTURER, E.BAL_SWITCH, E.CHG_SWITCH, E.DISCHG_SWITCH,
      E.STRINGS, E.REMAINING];
    this._updateUI(systemEntities.filter(id => this._bridge.getState(id)));
  }

  // ============ CARD REVEAL ============
  _revealCards() {
    if (this._revealFallbackTimeout) { clearTimeout(this._revealFallbackTimeout); this._revealFallbackTimeout = null; }
    if (this._cardsRevealed) return;
    this._cardsRevealed = true;
    const cards = this.shadowRoot.querySelectorAll('.card');
    cards.forEach((card, i) => {
      setTimeout(() => card.classList.add('revealed'), i * 60);
    });
  }

  setConfig(config) {
    this._config = config || {};
  }

  static getStubConfig() {
    return {};
  }
}

customElements.define('solar-dashboard', SolarDashboard);
