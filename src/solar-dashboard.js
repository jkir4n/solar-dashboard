import { HABridge } from './ha-bridge.js';
import { SolarEngine } from './solar-engine.js';
import { WeatherFX } from './weather-fx.js';
import { ChartManager } from './charts.js';
import { STYLES } from './styles.js';

// ============ CONSTANTS ============
const VMIN = 2.45, VMAX = 3.65, VRNG = VMAX - VMIN;

const CONDITION_CLOUD_MAP = {
  'sunny': 5, 'clear-night': 5,
  'partlycloudy': 30, 'cloudy': 65,
  'rainy': 85, 'pouring': 95,
  'snowy': 80, 'fog': 70,
  'hail': 90, 'lightning': 90, 'lightning-rainy': 90,
  'windy': 15, 'windy-variant': 15,
  'exceptional': 50,
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
  'rainy': 'rainy', 'pouring': 'rainy',
  'snowy': 'snowy', 'hail': 'snowy',
  'fog': 'fog',
  'lightning': 'storm', 'lightning-rainy': 'storm',
};

const WEATHER_PALETTES = {
  dark: {
    sunny:        ['rgba(255,180,50,0.2)',  'rgba(255,140,30,0.15)', 'rgba(255,200,80,0.1)'],
    night:        ['rgba(20,20,80,0.3)',    'rgba(40,30,100,0.2)',   'rgba(60,20,120,0.15)'],
    partlycloudy: ['rgba(180,170,140,0.15)','rgba(140,150,180,0.1)', 'rgba(100,120,160,0.08)'],
    cloudy:       ['rgba(120,120,140,0.15)','rgba(100,100,120,0.1)', 'rgba(80,85,100,0.08)'],
    rainy:        ['rgba(40,60,120,0.2)',   'rgba(30,50,100,0.15)',  'rgba(20,40,80,0.1)'],
    snowy:        ['rgba(140,160,200,0.15)','rgba(120,140,180,0.1)', 'rgba(100,120,160,0.08)'],
    fog:          ['rgba(100,100,110,0.15)','rgba(80,80,90,0.1)',    'rgba(60,60,70,0.08)'],
    storm:        ['rgba(60,20,80,0.2)',    'rgba(40,10,60,0.15)',   'rgba(80,30,100,0.1)'],
  },
  light: {
    sunny:        ['rgba(255,200,80,0.2)',  'rgba(255,170,50,0.15)', 'rgba(255,220,100,0.1)'],
    night:        ['rgba(40,40,100,0.15)',  'rgba(60,50,120,0.1)',   'rgba(80,40,140,0.08)'],
    partlycloudy: ['rgba(180,190,210,0.2)', 'rgba(160,170,190,0.15)','rgba(140,150,170,0.1)'],
    cloudy:       ['rgba(150,155,170,0.2)', 'rgba(130,135,150,0.15)','rgba(110,115,130,0.1)'],
    rainy:        ['rgba(60,80,140,0.2)',   'rgba(50,70,120,0.15)',  'rgba(40,60,100,0.1)'],
    snowy:        ['rgba(180,200,230,0.2)', 'rgba(160,180,210,0.15)','rgba(140,160,190,0.1)'],
    fog:          ['rgba(140,140,150,0.2)', 'rgba(120,120,130,0.15)','rgba(100,100,110,0.1)'],
    storm:        ['rgba(80,40,100,0.2)',   'rgba(60,30,80,0.15)',   'rgba(100,50,120,0.1)'],
  },
};

function cloudTransmission(cloudPct) {
  const bands = [
    [0, 10, 0.95, 1.0],
    [10, 50, 0.75, 0.95],
    [50, 70, 0.40, 0.75],
    [70, 90, 0.20, 0.40],
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

// ============ FLOW PARTICLE SYSTEM ============
class FlowParticles {
  constructor(root, wrapId, particlesId, lineId, color) {
    this.wrap = root.getElementById(wrapId);
    this.container = root.getElementById(particlesId);
    this.line = root.getElementById(lineId);
    this.color = color;
    this.active = false;
    this.activeDots = 0;
    this.speed = 0.003;
    this.rafId = null;
    this._tick = this._animate.bind(this);
    this.dots = [];
    const dotsEl = this.container?.querySelectorAll('.flow-dot');
    if (dotsEl) {
      dotsEl.forEach((d, i) => {
        this.dots.push({ el: d, p: i / dotsEl.length });
      });
    }
  }

  start(powerW) {
    this.active = true;
    this.powerW = powerW;
    this.speed = 0.002 + Math.min(powerW, 1500) / 1500 * 0.006;
    const newActive = powerW < 200 ? 2 : powerW < 500 ? 3 : powerW < 1000 ? 4 : 5;
    if (newActive > this.activeDots) {
      for (let i = this.activeDots; i < newActive; i++) {
        this.dots[i].p = Math.random();
      }
    }
    this.activeDots = newActive;
    if (this.line) {
      if (!this._lineSet) {
        this.line.style.background = this.color + '33';
        this.line.style.boxShadow = `0 0 6px 1px ${this.color}22`;
        this.line.style.setProperty('--flow-color', this.color);
        this._lineSet = true;
      }
      const sweepS = (3 - Math.min(powerW, 1500) / 1500 * 2.2).toFixed(1);
      this.line.style.setProperty('--sweep-speed', sweepS + 's');
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
  }

  _animate() {
    if (!this.active) return;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      if (i >= this.activeDots) {
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
      let o = 1;
      if (d.p < 0.08) o = d.p / 0.08;
      else if (d.p > 0.92) o = (1 - d.p) / 0.08;
      d.el.style.left = (d.p * 100) + '%';
      d.el.style.opacity = o;
      d.el.style.background = this.color;
      d.el.style.boxShadow = `0 0 6px 2px ${this.color}, 0 0 12px 4px ${this.color}55`;
    }
    this.rafId = requestAnimationFrame(this._tick);
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
    this._flowPS1 = null;
    this._flowPS2 = null;
    this._battArcInterval = null;
    this._battArcActive = false;
    this._battArcColor = null;
    this._battArcPowerW = 0;
    this._cardsRevealed = false;
    this._weatherEntityId = null;
    this._weatherCloudFactor = 1.0;
    this._weatherAmbientC = null;
    this._solarEngineReady = false;
    this._todayIn = 0;
    this._todayOut = 0;
    this._lastForecastHour = -1;
    this._cachedForecastKWh = 0;
    this._resizeHandler = null;
    this._activeChartRange = 'Live';
  }

  set hass(hass) {
    this._bridge.update(hass);
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
      this._updateUI(changed);
    }
  }

  set panel(panel) { this._panel = panel; }
  set narrow(narrow) { this._narrow = narrow; }

  // ============ INIT ============
  _init() {
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLES}</style>${this._getHTML()}`;

    // Apply theme
    this._applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => this._applyTheme());

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
    ['chartPower', 'chartSOC', 'chartSolar'].forEach(id => {
      this._charts.attachCrosshair(root.getElementById(id));
    });

    // Init flow particles
    this._flowPS1 = new FlowParticles(root, 'flowWrap1', 'flowParticles1', 'flowLine1', '#00F0FF');
    this._flowPS2 = new FlowParticles(root, 'flowWrap2', 'flowParticles2', 'flowLine2', '#FF453A');

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
    this._intervals.push(setInterval(() => this._calcTodayInOut(), 60000));

    // Start solar estimate update
    this._updateSolarEstimate();
    this._intervals.push(setInterval(() => this._updateSolarEstimate(), 60000));

    // Start solar degradation UI (hourly)
    this._updateSolarUI();
    this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));

    // Resize handler
    this._resizeHandler = () => {
      if (this._weatherFx) {
        this._weatherFx.resize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    // Initial full refresh + reveal
    this._refreshAllUI();
    this._loadChartRange('Live');

    // Staggered card reveal with fallback
    setTimeout(() => this._revealCards(), 200);
    setTimeout(() => this._revealCards(), 2000); // fallback
  }

  disconnectedCallback() {
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];
    if (this._flowPS1) this._flowPS1.stop();
    if (this._flowPS2) this._flowPS2.stop();
    if (this._weatherFx) this._weatherFx.destroy();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this._stopBattArcs();
    this._activeAnimations.forEach(id => cancelAnimationFrame(id));
    this._activeAnimations.clear();
  }

  // ============ THEME ============
  _applyTheme() {
    const root = this.shadowRoot.querySelector('.dashboard-root');
    if (root) {
      root.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
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
      <div class="info-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
        <div class="inf"><div class="inf-v" id="sysCycles">--</div><div class="inf-k">Cycles</div></div>
        <div class="inf"><div class="inf-v" id="sysCapacity">215 Ah</div><div class="inf-k">Capacity</div></div>
        <div class="inf"><div class="inf-v" id="sysNominal">51.2 V</div><div class="inf-k">Nominal</div></div>
        <div class="inf"><div class="inf-v" id="sysConfig">16S</div><div class="inf-k">Config</div></div>
      </div>
      <div class="info-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
        <div class="inf"><div class="inf-v" id="sysMinCell">-- V</div><div class="inf-k">Min Cell</div></div>
        <div class="inf"><div class="inf-v" id="sysMaxCell">-- V</div><div class="inf-k">Max Cell</div></div>
        <div class="inf"><div class="inf-v" id="sysRuntime">--</div><div class="inf-k">Runtime</div></div>
        <div class="inf"><div class="inf-v" id="sysThroughput">--</div><div class="inf-k">Throughput</div></div>
      </div>
      <div class="info-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
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
            <div class="flow-particles" id="flowParticles1"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
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
            <div class="flow-particles" id="flowParticles2"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
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
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:8px">WEATHER</div>
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
          <span style="color:var(--orange);font-weight:600;">&#9632; Estimated</span>
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
      <div id="balIndicator" class="supercap-flow" style="display:none">
        <span id="balSrc">C1</span> \u25B2 \u2192 \u203A \u203A \u203A \u2192 Supercap \u2192 \u203A \u203A \u203A \u2192 <span id="balDst">C12</span> \u25BC
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
        el.addEventListener('animationend', () => el.classList.remove('val-flash'), { once: true });
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
      this._updateBattery();
      this._updatePowerFlow();
      this._updateChartValues();
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
  _updateBattery() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const soc = this._bridge.getVal(E.SOC);
    const voltage = this._bridge.getVal(E.VOLTAGE);
    const current = this._bridge.getVal(E.CURRENT);
    const power = this._bridge.getVal(E.POWER);
    const remaining = this._bridge.getVal(E.REMAINING);
    const battSpec = this._bridge.battSpec;

    const r = 80, circ = 2 * Math.PI * r;
    const ring = root.getElementById('battRing');
    if (soc != null) {
      const socEl = root.getElementById('battSOC');
      const oldSoc = parseFloat(socEl.textContent) || 0;
      this._animateValue(socEl, oldSoc, soc, 600, v => Math.round(v) + '%');
      ring.style.strokeDasharray = `${circ * soc / 100} ${circ}`;
      ring.style.stroke = soc < 20 ? 'var(--red)' : soc < 40 ? 'var(--orange)' : 'var(--green)';
    } else {
      root.getElementById('battSOC').textContent = '--%';
      ring.style.strokeDasharray = `0 ${circ}`;
    }

    const cur = current || 0;
    const status = cur > 0.5 ? 'Charging' : cur < -0.5 ? 'Discharging' : 'Idle';
    const statusColor = status === 'Charging' ? 'var(--green)' : status === 'Discharging' ? 'var(--red)' : 'var(--text2)';
    root.getElementById('battStatus').textContent = status;
    root.getElementById('battStatus').style.color = statusColor;
    root.getElementById('battStatusDot').style.background = statusColor;

    if (voltage != null) {
      const el = root.getElementById('battVolt');
      this._animateValue(el, parseFloat(el.textContent) || 0, voltage, 600, v => v.toFixed(2) + ' V');
    } else root.getElementById('battVolt').textContent = '--';

    if (current != null) {
      const el = root.getElementById('battCurr');
      this._animateValue(el, parseFloat(el.textContent) || 0, Math.abs(current), 600, v => v.toFixed(2) + ' A');
    } else root.getElementById('battCurr').textContent = '--';

    const chgPower = this._bridge.getVal(E.CHG_POWER);
    const dischgPower = this._bridge.getVal(E.DISCHG_POWER);
    const battPower = chgPower > 0 ? chgPower : dischgPower > 0 ? dischgPower : power != null ? Math.abs(power) : null;
    if (battPower != null) {
      const el = root.getElementById('battPow');
      this._animateValue(el, parseFloat(el.textContent) || 0, battPower, 600, v => Math.round(v) + ' W');
    } else root.getElementById('battPow').textContent = '--';

    if (remaining != null) {
      const el = root.getElementById('battAh');
      this._animateValue(el, parseFloat(el.textContent) || 0, remaining, 600, v => v.toFixed(2) + ' Ah');
    } else root.getElementById('battAh').textContent = '--';

    // Energy
    const energyEl = root.getElementById('battEnergy');
    if (remaining > 0 && voltage > 0) {
      this._animateValue(energyEl, parseFloat(energyEl.textContent) || 0, remaining * voltage / 1000, 600, v => v.toFixed(2) + ' kWh');
    } else energyEl.textContent = '--';

    // Time to empty/full
    let tte = '--';
    const tteLabel = root.getElementById('battTTELabel');
    const fmtDHM = (hours) => {
      const d = Math.floor(hours / 24);
      const h = Math.floor(hours % 24);
      const m = Math.round((hours % 1) * 60);
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
    root.getElementById('battTTE').textContent = tte;

    // Update actual solar (charging power = solar input)
    const solarActual = chgPower > 0 ? chgPower : (cur > 0 ? Math.abs(power || 0) : 0);
    const solActualEl = root.getElementById('solActual');
    this._animateValue(solActualEl, parseFloat(solActualEl.textContent) || 0, solarActual, 600, v => Math.round(v) + ' W');

    // System info updates
    const cycles = this._bridge.getVal(E.CYCLES);
    if (cycles != null) {
      const el = root.getElementById('sysCycles');
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, cycles, 600, v => Math.round(v).toString());
    }

    const runtime = this._bridge.getStrVal(E.RUNTIME);
    root.getElementById('sysRuntime').textContent = runtime ?? '--';

    const throughput = this._bridge.getVal(E.THROUGHPUT);
    if (throughput != null) {
      const el = root.getElementById('sysThroughput');
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, throughput, 600, v => Math.round(v) + ' Ah');
    }

    const minCellV = this._bridge.getVal(E.MIN_CELL_V);
    if (minCellV != null) {
      const el = root.getElementById('sysMinCell');
      const old = parseFloat(el.textContent) || 0;
      const cellNum = this._bridge.getStrVal(E.MIN_V_CELL) || '?';
      this._animateValue(el, old, minCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else root.getElementById('sysMinCell').textContent = '-- V';

    const maxCellV = this._bridge.getVal(E.MAX_CELL_V);
    if (maxCellV != null) {
      const el = root.getElementById('sysMaxCell');
      const old = parseFloat(el.textContent) || 0;
      const cellNum = this._bridge.getStrVal(E.MAX_V_CELL) || '?';
      this._animateValue(el, old, maxCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else root.getElementById('sysMaxCell').textContent = '-- V';

    const firmware = this._bridge.getStrVal(E.FIRMWARE);
    root.getElementById('sysFirmware').textContent = firmware ? firmware.replace(/[^\x20-\x7E]/g, '').replace(/_+/g, ' ').trim() : '--';

    const manufacturer = this._bridge.getStrVal(E.MANUFACTURER);
    if (manufacturer) {
      const c = manufacturer.replace(/[^\x20-\x7E]/g, '').trim();
      const m = c.match(/JK\S*/);
      root.getElementById('sysBmsModel').textContent = m ? m[0] : c;
    } else root.getElementById('sysBmsModel').textContent = '--';

    const mosfetTemp = this._bridge.getVal(E.MOSFET_TEMP);
    if (mosfetTemp != null) {
      const el = root.getElementById('battMosfetTemp');
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, mosfetTemp, 600, v => v.toFixed(1) + ' \u00B0C');
    } else root.getElementById('battMosfetTemp').textContent = '--';

    // Dynamic battery specs
    const strings = this._bridge.getVal(E.STRINGS);
    if (strings > 0) {
      this._bridge.battSpec.strings = strings;
      this._bridge.battSpec.nomV = strings * this._bridge.battSpec.voltsPerCell;
      root.getElementById('sysConfig').textContent = strings + 'S';
      const nomEl = root.getElementById('sysNominal');
      const oldNom = parseFloat(nomEl.textContent) || 0;
      this._animateValue(nomEl, oldNom, this._bridge.battSpec.nomV, 600, v => v.toFixed(1) + ' V');
    }

    if (remaining > 0 && soc > 10) {
      this._bridge.battSpec.fullAh = Math.round(remaining / (soc / 100));
      const capEl = root.getElementById('sysCapacity');
      const oldCap = parseFloat(capEl.textContent) || 0;
      this._animateValue(capEl, oldCap, this._bridge.battSpec.fullAh, 600, v => Math.round(v) + ' Ah');
    }

    // Update chemistry display
    const chemEl = root.getElementById('sysChemistry');
    if (chemEl) chemEl.textContent = this._bridge.battSpec.chemistry;
  }

  // ============ POWER FLOW ============
  _powerToAnimSpeed(watts) {
    const t = Math.min(Math.abs(watts), 1500) / 1500;
    return (2.5 - t * 2.1).toFixed(2) + 's';
  }

  _setIconGlow(id, cls, watts) {
    const el = this.shadowRoot.getElementById(id);
    if (!el) return;
    const newClass = 'flow-icon ' + cls;
    if (el.className !== newClass) el.className = newClass;
    if (watts != null) el.style.setProperty('--anim-speed', this._powerToAnimSpeed(watts));
  }

  _updatePowerFlow() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const current = this._bridge.getVal(E.CURRENT) || 0;
    const dischgPower = this._bridge.getVal(E.DISCHG_POWER);
    const chgPower = this._bridge.getVal(E.CHG_POWER);
    const netPower = Math.abs(this._bridge.getVal(E.POWER) || 0);
    const power = dischgPower > 0 ? dischgPower : chgPower > 0 ? chgPower : netPower;
    const solarW = chgPower > 0 ? chgPower : (current > 0 ? power : 0);
    const batteryW = dischgPower > 0 ? dischgPower : power;
    const charging = current > 0.5;
    const discharging = current < -0.5;

    this._setIconGlow('iconSolar', solarW > 10 ? 'icon-sun-active' : 'glow-dim', solarW);

    const wrap1 = root.getElementById('flowWrap1');
    const watt1 = root.getElementById('flowWatt1');
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
      if (!this._battArcActive) this._startBattArcs(arcColor);
    } else {
      this._stopBattArcs();
    }

    const wrap2 = root.getElementById('flowWrap2');
    const watt2 = root.getElementById('flowWatt2');
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
  _updateChartValues() {
    const root = this.shadowRoot;
    const E = this._bridge.E;

    // Live view: show real-time values from HA
    if (this._activeChartRange === 'Live') {
      const dischgPower = this._bridge.getVal(E.DISCHG_POWER);
      const chgPower = this._bridge.getVal(E.CHG_POWER);
      const power = this._bridge.getVal(E.POWER);
      const soc = this._bridge.getVal(E.SOC);
      const pwrEl = root.getElementById('pwrVal');
      const socEl = root.getElementById('socVal');
      const solEl = root.getElementById('solVal');
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

    const pwrEl = root.getElementById('pwrVal');
    const socEl = root.getElementById('socVal');
    const solEl = root.getElementById('solVal');
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
    setTimeout(() => {
      svg.style.opacity = '0.4';
      svg.style.transition = 'opacity 0.12s ease-out';
    }, 80);
    setTimeout(() => {
      svg.innerHTML = '';
      svg.style.opacity = '1';
      svg.style.transition = '';
    }, 200);
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
    const svg = this.shadowRoot.getElementById('battArcs');
    if (svg) svg.innerHTML = '';
  }

  // ============ WEATHER UPDATE ============
  _discoverWeatherEntity() {
    if (!this._bridge._hass) return null;
    const ids = Object.keys(this._bridge._hass.states).filter(id => id.startsWith('weather.'));
    if (ids.includes('weather.pirateweather')) return 'weather.pirateweather';
    if (ids.includes('weather.forecast_home')) return 'weather.forecast_home';
    return ids[0] || null;
  }

  _updateWeather() {
    if (!this._weatherEntityId) {
      this._weatherEntityId = this._discoverWeatherEntity();
    }
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
    this._applyWeatherBackdrop(state.state);

    // Temperature for solar engine
    if (attrs.temperature != null) {
      this._weatherAmbientC = parseFloat(attrs.temperature);
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

  _applyWeatherBackdrop(condition) {
    const rootEl = this.shadowRoot.querySelector('.dashboard-root');
    if (!rootEl) return;
    const theme = rootEl.dataset.theme || 'dark';
    const palettes = WEATHER_PALETTES[theme] || WEATHER_PALETTES.dark;

    let isNight = false;
    if (this._engine && this._bridge.latitude != null) {
      const now = new Date();
      const panelConfig = this._getPanelConfig();
      const result = this._engine.calcSolarOutput(now, panelConfig, 0, 25);
      isNight = result.elevation < 0;
    }

    let key = CONDITION_PALETTE_MAP[condition] || null;
    if (isNight && key !== 'storm' && key !== 'rainy') key = 'night';

    const colors = palettes[key];
    if (!colors) return;

    rootEl.style.setProperty('--mesh-1', colors[0]);
    rootEl.style.setProperty('--mesh-2', colors[1]);
    rootEl.style.setProperty('--mesh-3', colors[2]);

    // Update weather FX particles
    const particleTypes = {
      sunny: 'sunny', night: 'night', snowy: 'snowy',
      rainy: 'rainy', storm: 'storm', fog: 'fog',
      cloudy: 'cloudy', partlycloudy: 'cloudy',
    };
    if (this._weatherFx) {
      this._weatherFx.start(particleTypes[key] || null, isNight, theme);
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

  _updateSolarEstimate() {
    if (!this._solarEngineReady || !this._engine) return;
    const root = this.shadowRoot;
    const now = new Date();
    const panelConfig = this._getPanelConfig();
    const deg = this._engine.getDegradationInfo(now, panelConfig);
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
    let allValid = true;
    for (let i = 1; i <= 16; i++) {
      const v = this._bridge.getVal(E['CELL' + i]);
      if (v == null || v <= 0) { allValid = false; voltages.push(null); }
      else voltages.push(v);
    }
    if (!allValid) return;

    const globalMaxI = voltages.indexOf(Math.max(...voltages));
    const globalMinI = voltages.indexOf(Math.min(...voltages));
    this._renderPack('pack1', voltages.slice(0, 8), 1, globalMaxI, globalMinI);
    this._renderPack('pack2', voltages.slice(8), 9, globalMaxI, globalMinI);
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
    allV.forEach((v, gi) => {
      const globalI = startIdx - 1 + gi;
      const pct = Math.max(2, Math.min(100, ((v - VMIN) / VRNG) * 100));
      const row = rows[gi];
      const isHigh = globalI === globalMaxI;
      const isLow = globalI === globalMinI;
      const wantClass = isHigh ? 'cell-row-item cell-high' : isLow ? 'cell-row-item cell-low' : 'cell-row-item';
      if (row.className !== wantClass) row.className = wantClass;
      const tag = isHigh ? '<span class="cell-tag high">\u25B2</span>' : isLow ? '<span class="cell-tag low">\u25BC</span>' : '';
      const idEl = row.querySelector('.cell-id');
      const newId = `C${startIdx + gi}${tag}`;
      if (idEl.innerHTML !== newId) idEl.innerHTML = newId;
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

    root.getElementById('balSrc').textContent = 'C' + (maxI + 1);
    root.getElementById('balDst').textContent = 'C' + (minI + 1);
    root.getElementById('balIndicator').style.display = balancing ? 'block' : 'none';

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
      const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      localNow.setHours(0, 0, 0, 0);
      const offsetMs = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime();
      const midnightUTC = new Date(localNow.getTime() + offsetMs);

      const states = await this._bridge.fetchHistoryRange(E.CURRENT, midnightUTC, now, true);
      let inAh = 0, outAh = 0;
      for (let i = 1; i < states.length; i++) {
        const prevV = states[i - 1].v;
        if (prevV === null) continue;
        const t0 = states[i - 1].t.getTime();
        const t1 = states[i].t.getTime();
        const dtHours = (t1 - t0) / 3600000;
        if (dtHours > 0 && dtHours < 1) {
          if (prevV > 0.5) inAh += prevV * dtHours;
          else if (prevV < -0.5) outAh += Math.abs(prevV) * dtHours;
        }
      }
      // Include last state to now
      if (states.length > 0) {
        const last = states[states.length - 1];
        if (last.v !== null) {
          const dtHours = (now.getTime() - last.t.getTime()) / 3600000;
          if (dtHours > 0 && dtHours < 1) {
            if (last.v > 0.5) inAh += last.v * dtHours;
            else if (last.v < -0.5) outAh += Math.abs(last.v) * dtHours;
          }
        }
      }
      this._todayIn = inAh;
      this._todayOut = outAh;
    } catch (e) { console.warn('[Solar] Today In/Out fetch failed', e); }

    const nomV = this._bridge.battSpec.nomV;
    const inEl = root.getElementById('battTodayIn');
    this._animateValue(inEl, parseFloat(inEl.textContent) || 0, this._todayIn * nomV / 1000, 600, v => v.toFixed(2) + ' kWh');
    const outEl = root.getElementById('battTodayOut');
    this._animateValue(outEl, parseFloat(outEl.textContent) || 0, this._todayOut * nomV / 1000, 600, v => v.toFixed(2) + ' kWh');

    // Update solar generation today
    const genKWh = this._todayIn * this._bridge.battSpec.nomV / 1000;
    const solTodayEl = root.getElementById('solTodayGen');
    if (solTodayEl) {
      this._animateValue(solTodayEl, parseFloat(solTodayEl.textContent) || 0, genKWh, 600, v => v.toFixed(1) + ' kWh');
    }
  }

  // ============ CLOCK ============
  _startClock() {
    const el = this.shadowRoot.getElementById('clock');
    if (el) {
      el.textContent = new Date().toLocaleString('en-IN', {
        timeZone: this._bridge.timezone,
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      });
    }
  }

  // ============ CHARTS ============
  async _loadChartRange(range) {
    this._activeChartRange = range;
    if (!this._charts) return;
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
    const entityIds = {
      power: E.DISCHG_POWER || E.POWER,
      soc: E.SOC,
      _signed: !E.DISCHG_POWER,
    };
    const result = await this._charts.loadRange(range, canvases, entityIds, this._bridge.timezone);

    // Load solar chart data from CHG_POWER
    const solarEntityIds = { power: E.CHG_POWER || E.POWER, _signed: !E.CHG_POWER };
    const solarResult = await this._charts.loadRange(range, { solar: canvases.solar }, solarEntityIds, this._bridge.timezone);

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
      const estPts = solarResult.powerData.map(d => {
        if (is30D) {
          // For daily data points, calculate mean watts by sampling throughout the day
          const dayStart = new Date(d.t);
          dayStart.setHours(0, 0, 0, 0);
          const samples = [];
          // Sample every 15 minutes
          for (let t = dayStart.getTime(); t < dayStart.getTime() + 24 * 60 * 60 * 1000; t += 15 * 60 * 1000) {
            const out = this._engine.calcSolarOutput(new Date(t), panelConfig, cloudPct, ambientC);
            samples.push(out.watts);
          }
          return samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
        }
        const out = this._engine.calcSolarOutput(d.t, panelConfig, cloudPct, ambientC);
        return out.watts;
      });
      this._charts.drawChart(canvases.solar, [
        { points: actualPts, color: 'rgb(34,197,94)', label: 'W', fill: true },
        { points: estPts, color: 'rgb(249,115,22)', label: 'W est', fill: false },
      ], { minY: 0, xLabel: solarResult.timeXLabel(solarResult.powerData), yFormat: v => Math.round(v) + ' W' }, false);
      this._charts.attachCrosshair(canvases.solar);
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

  // ============ REFRESH ALL ============
  _refreshAllUI() {
    this._updateBattery();
    this._updatePowerFlow();
    this._calcTodayInOut();
    this._updateCellBalance();
    this._updateWeather();
    this._updateSolarEstimate();
    this._updateSolarUI();

    // Dispatch all system entities
    const E = this._bridge.E;
    const systemEntities = [E.TEMP1, E.TEMP2, E.MOSFET_TEMP, E.CYCLES, E.RUNTIME, E.THROUGHPUT,
      E.MIN_CELL_V, E.MAX_CELL_V, E.FIRMWARE, E.MANUFACTURER, E.BAL_SWITCH, E.CHG_SWITCH, E.DISCHG_SWITCH,
      E.STRINGS, E.REMAINING];
    this._updateUI(systemEntities.filter(id => this._bridge.getState(id)));
  }

  // ============ CARD REVEAL ============
  _revealCards() {
    if (this._cardsRevealed) return;
    this._cardsRevealed = true;
    const cards = this.shadowRoot.querySelectorAll('.card');
    cards.forEach((card, i) => {
      setTimeout(() => card.classList.add('revealed'), i * 60);
    });
  }
}

customElements.define('solar-dashboard', SolarDashboard);
