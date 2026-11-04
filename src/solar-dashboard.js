import { HABridge, getCurrencySymbol } from './ha-bridge.js';
import { SolarEngine, cloudTransmission } from './solar-engine.js';
import { WeatherState } from './weather-state.js';
import { ISSTracker } from './iss-tracker.js';
import { computeSky } from './scene/sky-state.js';
import { ChartManager } from './charts.js';
import { HUD_STYLES } from './hud/hud-styles.js';
import { createHud } from './hud/hud-template.js';
import { WorldScene } from './scene/world-scene.js';
import { readEnergyState, powerUnitScale } from './energy-state.js';
import { createControlHandler, refreshControlAvailability } from './controls.js';

import { t } from './i18n.js';

// ============ CONSTANTS ============

function cellBounds(chemistry) {
  if (chemistry === 'NMC')  return { vmin: 3.00, vmax: 4.20 };
  if (chemistry === 'LTO')  return { vmin: 1.80, vmax: 2.75 };
  return { vmin: 2.50, vmax: 3.65 }; // LiFePO₄ and unknown — intentional fallthrough
}

// ============ MAIN COMPONENT ============
class SolarDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._bridge = new HABridge();
    this._engine = null;
    this._charts = null;
    this._initialized = false;
    this._intervals = [];
    this._animations = [];         // P7: centralized animation list
    this._animRafId = null;        // P7: single rAF ID for all animations
    this._clockFormatter = null;
    this._resizeTimeout = null;
    this._els = {};
    this._cardsRevealed = false;
    this._fadeTimeout = null;
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
    this._peakPowerToday = 0;
    this._sunHoursToday = 0;
    this._sunHourSet = null;
    this._lastSunHourDay = null;
    this._monthStartThroughput = 0;
    this._performancePct = null;
    this._efficiencyPct = null;
    this._solarActualWatts = 0;
    this._solarEstimatedWatts = 0;
    this._energyPrice = 0;
    this._currencySymbol = '\u20B9';
    this._panelTemp = null;
    this._pendingChanges = new Set();
    this._updateRafId = null;
    this._chartsLoaded = false;
    // 24/7 reliability: WebSocket disconnection detection
    this._connCheckInterval = null;
    this._lastHassUpdate = 0;
    this._connLost = false;
    // 24/7 reliability: _init() retry with backoff
    this._initRetryDelay = 5000;
    this._initRetryMax = 300000; // 5 min cap
    this._initRetryId = null;
  }

  set hass(hass) {
    this._lastHassUpdate = Date.now();
    if (this._connLost) this._hideConnLostBanner();
    const langChanged = this._bridge._hass?.language !== hass.language;
    this._bridge.update(hass);
    this._applyTheme();
    if (langChanged && this._initialized) {
      this.disconnectedCallback();
      this._initialized = false;
    }
    if (!this._initialized) {
      // Render full HTML immediately — cards hidden, background/weather visible
      this._render();
      this._initialized = true;
      // Defer heavy init to next frame so background paints first
      requestAnimationFrame(() => this._init());
    }
    // Retry chart loading once entity discovery is complete
    const E = this._bridge.E;
    if (E && E.POWER && E.SOC && !this._chartsLoaded) {
      this._chartsLoaded = true;
      this._loadChartRange(this._activeChartRange || 'Live').catch(() => {});
    }
    const changed = this._bridge.getChangedEntities();
    if (changed.length > 0) {
      changed.forEach(id => this._pendingChanges.add(id));
    }
    if (!this._updateRafId) {
      this._updateRafId = requestAnimationFrame(() => {
        this._updateRafId = null;
        try {
          const pending = [...this._pendingChanges];
          this._pendingChanges.clear();
          if (pending.length === 0) return;
          this._updateUI(pending);
          if (this._activeChartRange === 'Live' && this._chartsLoaded) {
            const E = this._bridge.E;
            const liveEntities = new Set([E.POWER, E.CHG_POWER, E.DISCHG_POWER, E.SOC, this._bridge.gridEntities.PV_POWER?.entityId].filter(Boolean));
            const relevant = pending.some(id => liveEntities.has(id));
            if (relevant && Date.now() - this._lastLiveChartFetch > 60000) {
              this._lastLiveChartFetch = Date.now();
              this._loadChartRange('Live').catch(() => {});
            }
          }
        } catch (err) {
          console.error('[Solar] Update pipeline error:', err);
        }
      });
    }
  }

  set panel(panel) {
    this._panel = panel;
    const root = this.shadowRoot?.querySelector('.dashboard-root');
    if (root) root.classList.toggle('panel-mode', !!panel);
  }
  set narrow(narrow) { this._narrow = narrow; }


  _cacheElements() {
    const root = this.shadowRoot;
    this._els = {
      battRing:      root.getElementById('battRing'),
      battCapDot:    root.getElementById('battCapDot'),
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
      sysFirmware:   root.getElementById('sysFirmware'),
      sysBmsModel:   root.getElementById('sysBmsModel'),
      battMosfetTemp:root.getElementById('battMosfetTemp'),
      sysConfig:     root.getElementById('sysConfig'),
      sysNominal:    root.getElementById('sysNominal'),
      sysCapacity:   root.getElementById('sysCapacity'),
      sysChemistry:  root.getElementById('sysChemistry'),
      wxSource:      root.getElementById('wxSource'),
      dashRoot:      root.querySelector('.dashboard-root'),
    };
  }

  // ============ RENDER ============
  _render() {
    const root = this.shadowRoot;
    if (!root) return;
    const lang = this._bridge._hass?.language || 'en';
    root.innerHTML = `<style>${HUD_STYLES}</style>${this._getHTML(lang)}`;
    this._hud = createHud(root, {
      lang,
      onSelect: zone => this._world?.focus(zone),
      onCutaway: value => this._world?.setCutaway(value),
      onMoreInfo: zone => {
        const ids = this._bridge.gridEntities, E = this._bridge.E;
        const entityId = ({ solar: ids.PV_POWER?.entityId, battery: E.SOC, cells: E.MIN_CELL_V, controls: E.CHG_SWITCH, grid: ids.GRID_POWER?.entityId, home: ids.HOME_POWER?.entityId || E.HOME_POWER })[zone];
        if (entityId) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
      },
      onRange: (force) => this._loadChartRange(this._activeChartRange || 'Live', force).catch(() => {}),
    });
    this._cacheElements();
    // Hide cards immediately — they'll be revealed after data + weather are ready
    const dashRoot = root.querySelector('.dashboard-root');
    if (dashRoot) {
      dashRoot.classList.add('js-ready');
      if (this._panel) dashRoot.classList.add('panel-mode');
    }
  }

  _initWorld() {
    const canvas = this.shadowRoot.getElementById('sceneCanvas');
    const status = this.shadowRoot.getElementById('sceneStatus');
    const lang = this._bridge._hass?.language || 'en';
    try {
      this._world = new WorldScene(canvas, {
        onSelect: (zone, cellIndex) => {
          this._hud?.select(zone);
          this._world?.focus(zone);
          if (cellIndex != null) {
            this._world?.highlightCell(cellIndex);
            const row = this.shadowRoot?.querySelector(`.cell-row-item[data-cell-index="${cellIndex}"]`);
            row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        },
        onCellHover: index => {
          this._world?.highlightCell(index);
          const rows = this.shadowRoot?.querySelectorAll('.cell-row-item');
          rows?.forEach(r => r.classList.toggle('cell-3d-hover', index != null && r.dataset.cellIndex === String(index)));
        },
        onFrame: anchors => this._hud?.updateAnchors(anchors),
        onStatus: state => {
          status.hidden = state === 'ready';
          status.textContent = t(lang, 'sceneStatusReconnecting');
        },
      });
      this._worldResize = new ResizeObserver(entries => { const r = entries[0].contentRect; this._world?.resize(r.width, r.height); });
      this._worldResize.observe(canvas.parentElement);
      this._world.start();
    } catch (error) {
      console.warn('[Solar] 3D scene unavailable:', error);
      status.hidden = false;
      status.textContent = t(lang, 'sceneStatusUnavailable');
    }
  }

  // ============ INIT ============
  _init() {
    const root = this.shadowRoot;
    try {
      this._applyTheme();
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

      this._initWorld();

      this._weatherState = new WeatherState(this._bridge, { onChange: snapshot => {
        this._hud?.updateWeather(snapshot);
        this._weatherCloudFactor = cloudTransmission(snapshot.effective.cloud_coverage ?? 0);
        this._weatherAmbientC = snapshot.effective.temperature ?? 25;
        this._updateSky();
      }});
      this._issTracker = new ISSTracker({getLocation: () => this._skyLocation(), onChange: () => this._updateSky()});
      this._applyTheme();

      // Init charts
      this._charts = new ChartManager(this._bridge);
      this._charts.setThemeRoot(root.querySelector('.dashboard-root'));
      ['chartPower', 'chartSOC', 'chartSolar'].forEach(id => {
        this._charts.attachCrosshair(root.getElementById(id));
      });

      const analyticsContent = root.getElementById('analyticsContent');
      if (analyticsContent) {
        this._analyticsResize = new ResizeObserver(() => {
          if (!root.querySelector('.analytics-dock')?.classList.contains('collapsed')) {
            this._loadChartRange(this._activeChartRange || 'Live', true).catch(() => {});
          }
        });
        this._analyticsResize.observe(analyticsContent);
      }

      this._keydownHandler = (event) => {
        if (event.defaultPrevented) return;
        if (event.target && event.target.matches('input, textarea, select, [contenteditable]')) return;
        const key = event.key;
        if (key >= '1' && key <= '6') {
          const presets = ['overview', 'solar', 'battery', 'cells', 'controls', 'grid'];
          const zone = presets[parseInt(key, 10) - 1];
          if (zone) {
            this._hud?.select(zone);
            this._world?.focus(zone);
          }
        } else if (key === 'c' || key === 'C') {
          const cutawayBtn = root.getElementById('cutawayBtn');
          if (cutawayBtn) cutawayBtn.click();
        } else if (key === 'a' || key === 'A') {
          const analyticsToggle = root.getElementById('analyticsToggle');
          if (analyticsToggle) analyticsToggle.click();
        } else if (key === 'Escape') {
          const closeBtn = root.getElementById('inspectorClose');
          if (closeBtn) closeBtn.click();
        }
      };
      this.addEventListener('keydown', this._keydownHandler);

      // Wire chart tab handlers
      const tabs = root.querySelectorAll('.chart-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const range = tab.dataset.range;
          tabs.forEach(t => t.classList.toggle('active', t.dataset.range === range));
          this._loadChartRange(range).catch(() => {});
        });
      });

      this._controlHandler = createControlHandler(this._bridge);
      this._controlEvents = new AbortController();
      const signal = this._controlEvents.signal;
      const send = async (role, action, element) => {
        element.disabled = true;
        try { const request=this._controlHandler.send(role, action);refreshControlAvailability(root,this._bridge,this._controlHandler.pending);await request; }
        catch (error) { console.warn('[Solar] Control failed:', error); element.title = 'Request failed. Try again.'; }
        finally { if (element.isConnected) { element.disabled = false; this._refreshAllUI(); } }
      };
      for (const [id, role] of [['chgToggle','CHG_SWITCH'],['dischgToggle','DISCHG_SWITCH'],['gridToggle','GRID_SWITCH'],['absorptionToggle','ABSORPTION_SWITCH']]) {
        const input = root.getElementById(id);
        input.setAttribute('aria-label', input.closest('.ctrl').querySelector('.ctrl-name').textContent);
        input.addEventListener('change', () => send(role,{enabled:input.checked},input), {signal});
      }
      for (const [prefix,role] of [['gridConnect','GRID_CONNECT_SOC'],['gridDisconnect','GRID_DISCONNECT_SOC']]) {
        for (const [suffix,delta] of [['Minus',-1],['Plus',1]]) {
          const button = root.getElementById(prefix+suffix);
          button.setAttribute('aria-label', root.getElementById(prefix+'Val').closest('.ctrl').querySelector('.ctrl-name').textContent+' '+suffix);
          button.addEventListener('click',()=>send(role,{delta},button),{signal});
        }
      }
      for (const eventName of ['pointerover','focusin']) root.addEventListener(eventName,event=>{
        const index=event.target.closest('[data-cell-index]')?.dataset.cellIndex;
        if(index!=null)this._world?.highlightCell(Number(index));
      },{signal});
      for (const eventName of ['pointerout','focusout']) root.addEventListener(eventName,()=>this._world?.highlightCell(null),{signal});

      // Start clock
      this._startClock();
      this._calcTodayInOut().catch(() => {});

      // Fetch energy price and currency
      this._fetchEnergyPriceAndCurrency().catch(() => {});
      this._fetchMonthStartThroughput().catch(() => {});
      this._fetchTodayPeakPower().catch(() => {});
      this._fetchTodaySolarStats().catch(() => {});
      this._fetchTodayPerformance().catch(() => {});

      // Start solar estimate and UI
      this._updateSolarEstimate();
      this._updateSolarUI();
      this._updateCycleRate().catch(() => {});

      // Start background intervals & tasks
      this._startIntervals();

      // Resize handler
      this._resizeHandler = () => {
        if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
        }, 300);
      };
      window.addEventListener('resize', this._resizeHandler);

      // Visibility handler — pause all animations when panel is hidden
      this._visibilityHandler = () => {
        if (document.hidden) {
          this._world?.stop();
          this._stopIntervals();
          this._cancelAllAnimations();
        } else {
          this._world?.start();
          this._startIntervals();
          this._updateWeather();
          this._refreshAllUI();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);

      // 24/7: Page Lifecycle API — freeze/resume (Chrome 134+)
      this._freezeHandler = () => {
        this._world?.stop();
        this._stopIntervals();
        this._cancelAllAnimations();
        if (this._initRetryId) { clearTimeout(this._initRetryId); this._initRetryId = null; }
        if (this._fadeTimeout) { clearTimeout(this._fadeTimeout); this._fadeTimeout = null; }
      };
      this._resumeHandler = () => {
        this._world?.start();
        this._lastHassUpdate = Date.now();
        this._refreshAllUI();
        this._startIntervals();
      };
      document.addEventListener('freeze', this._freezeHandler);
      document.addEventListener('resume', this._resumeHandler);

      // Initial full refresh — populates all card data behind the scenes
      this._refreshAllUI();
      this._chartFetchDebounce={};
      this._loadChartRange(this._activeChartRange||'Live').catch(error=>console.warn('[Solar] Chart initialization failed',error));

      // Now reveal cards with stagger — background is already alive,
      // data is populated, cards fade in smoothly over the living backdrop.
      this._revealTimeout=setTimeout(() => {
        if(signal.aborted)return;
        this._revealRaf=requestAnimationFrame(() => {
          if(signal.aborted)return;
          this._revealCards();
          this._revealFallbackTimeout = setTimeout(() => this._revealCards(), 3000);
        });
      }, 1000);
    } catch (error) {
      console.error('[Solar] Init failed:', error);
      this._initialized = false; // allow retry
      root.innerHTML = `<style>${HUD_STYLES}</style>
<div class="dashboard-root" data-theme="dark">
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
    <div style="background:var(--glass-bg,rgba(30,30,30,0.8));border:1px solid var(--red,rgba(255,59,48,0.3));border-radius:16px;padding:32px;max-width:500px;text-align:center;backdrop-filter:blur(12px);">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h2 style="color:var(--red,#ff3b30);margin:0 0 8px;">Solar Dashboard</h2>
      <p style="color:var(--text2,#9ca3af);margin:0 0 16px;font-size:14px;">Failed to initialize — retrying automatically…</p>
      <pre style="color:var(--text3,#6b7280);font-size:12px;text-align:left;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;overflow:auto;max-height:200px;white-space:pre-wrap;word-break:break-word;">${error.message}\n${error.stack || ''}</pre>
      <button id="initRetryBtn" style="margin-top:16px;padding:8px 24px;background:var(--green,#34c759);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Retry Now</button>
      <p style="color:var(--text3,#6b7280);font-size:11px;margin:16px 0 0;">Check browser console for details</p>
    </div>
  </div>
</div>`;
      // 24/7: auto-retry with exponential backoff
      this._scheduleInitRetry();
      // Wire up manual retry button
      setTimeout(() => {
        const btn = this.shadowRoot?.getElementById('initRetryBtn');
        if (btn) btn.addEventListener('click', () => this._retryInitNow());
      }, 100);
    }
  }

  _startIntervals() {
    this._stopIntervals();
    this._intervals.push(setInterval(() => this._startClock(), 1000));
    this._intervals.push(setInterval(() => this._calcTodayInOut().catch(() => {}), 300000));
    this._intervals.push(setInterval(() => this._updateSolarEstimate(), 300000));
    this._intervals.push(setInterval(() => this._updateWeather(), 300000));
    this._intervals.push(setInterval(() => this._updateSky(), 10000));
    this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));
    this._intervals.push(setInterval(() => this._updateCycleRate().catch(() => {}), 3600000));
    this._intervals.push(setInterval(() => this._bridge.verifyEntities(), 300000));
    this._connCheckInterval = setInterval(() => this._checkConnection(), 30000);
    this._weatherState?.start();
    this._issTracker?.start();
  }

  _stopIntervals() {
    this._weatherState?.stop();
    this._issTracker?.stop();
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];
    if (this._connCheckInterval) { clearInterval(this._connCheckInterval); this._connCheckInterval = null; }
    if (this._issScheduleId) { clearTimeout(this._issScheduleId); this._issScheduleId = null; }
  }

  disconnectedCallback() {
    clearTimeout(this._revealTimeout);clearTimeout(this._revealFallbackTimeout);clearTimeout(this._resizeTimeout);cancelAnimationFrame(this._revealRaf);
    this._weatherState?.dispose(); this._weatherState=null;
    this._issTracker?.dispose(); this._issTracker=null;
    this._chartGeneration=(this._chartGeneration||0)+1;
    this._chartsLoaded=false; this._chartFetchDebounce={};
    this._controlEvents?.abort();
    this._worldResize?.disconnect();
    this._world?.dispose(); this._world = null;
    this._hud?.dispose(); this._hud = null;
    this._analyticsResize?.disconnect(); this._analyticsResize = null;
    if (this._keydownHandler) this.removeEventListener('keydown', this._keydownHandler);
    this._stopIntervals();
    if (this._charts) this._charts.detachAll();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
    if (this._freezeHandler) document.removeEventListener('freeze', this._freezeHandler);
    if (this._resumeHandler) document.removeEventListener('resume', this._resumeHandler);
    if (this._mediaQuery && this._themeHandler) this._mediaQuery.removeEventListener('change', this._themeHandler);
    this._cancelAllAnimations();
    if (this._updateRafId) { cancelAnimationFrame(this._updateRafId); this._updateRafId = null; }
    if (this._initRetryId) { clearTimeout(this._initRetryId); this._initRetryId = null; }
    if (this._fadeTimeout) { clearTimeout(this._fadeTimeout); this._fadeTimeout = null; }
    this._cardsRevealed = false;
    this._initialized = false;
  }

  // ============ THEME ============
  _applyTheme() {
    const root = this.shadowRoot.querySelector('.dashboard-root');
    if (!root) return;
    const hass = this._bridge._hass;
    const darkMode = hass?.themes?.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = darkMode ? 'dark' : 'light';
    this._world?.setTheme(root.dataset.theme);
    if (this._charts) this._charts.updateTheme();
  }

  // ============ 24/7: CONNECTION HEALTH CHECK ============
  _checkConnection() {
    if (document.hidden) return; // skip when tab hidden — visibility handler manages this
    if (!this._lastHassUpdate) return; // no hass received yet
    const stale = Date.now() - this._lastHassUpdate;
    if (stale > 60000 && !this._connLost) {
      this._connLost = true;
      this._showConnLostBanner();
    } else if (stale <= 60000 && this._connLost) {
      this._connLost = false;
      this._hideConnLostBanner();
    }
  }

  _showConnLostBanner() {
    const root = this.shadowRoot;
    if (!root) return;
    let banner = root.getElementById('connLostBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'connLostBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(255,59,48,0.9);color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;gap:8px;';
      banner.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:pulse 1.5s ease-in-out infinite;"></span> ';
      root.appendChild(banner);
    }
    banner.lastChild.textContent = ' ' + t(this._bridge._hass?.language || 'en', 'connLost');
    banner.style.display = 'flex';
  }

  _hideConnLostBanner() {
    const root = this.shadowRoot;
    if (!root) return;
    const banner = root.getElementById('connLostBanner');
    if (banner) banner.style.display = 'none';
  }

  // 24/7: _init() retry with exponential backoff
  _scheduleInitRetry() {
    if (this._initRetryId) clearTimeout(this._initRetryId);
    this._initRetryId = setTimeout(() => this._retryInit(), this._initRetryDelay);
  }

  _retryInitNow() {
    if (this._initRetryId) { clearTimeout(this._initRetryId); this._initRetryId = null; }
    this._initRetryDelay = 5000; // reset backoff
    this._retryInit();
  }

  _retryInit() {
    this._initRetryId = null;
    if (this._initialized) return; // already succeeded
    console.log(`[Solar] Retrying init (delay was ${this._initRetryDelay}ms)…`);
    try {
      this._init();
      // If _init succeeded, _initialized is true and we're done
      if (this._initialized) {
        this._initRetryDelay = 5000;
        return;
      }
    } catch (e) {
      console.error('[Solar] Init retry failed:', e);
    }
    // Still failed — increase backoff and reschedule
    this._initRetryDelay = Math.min(this._initRetryDelay * 2, this._initRetryMax);
    this._scheduleInitRetry();
  }

  // ============ HTML TEMPLATE ============
  _getHTML(lang) {
    return `
<div class="dashboard-root" data-theme="dark">
<div class="container">
  <header class="header">
    <div style="display:flex;align-items:center;gap:12px">
      <h1 style="font-size:24px;font-weight:700">${t(lang, 'solar')}</h1>
      <div class="live-dot"></div>
      <span style="font-size:12px;font-weight:600;color:var(--green)">${t(lang, 'live')}</span>
    </div>
    <div id="clock" style="font-size:14px;font-weight:500;color:var(--text2)"></div>
  </header>
  <div class="top-row">
    <div class="card" id="batteryHero">
      <h2 class="section-title">${t(lang, 'battery')}</h2>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--glass-border)" stroke-width="10"/>
          <g id="battThresholds"></g>
          <circle id="battRing" class="batt-ring" cx="100" cy="100" r="80" fill="none" stroke="var(--green)" stroke-width="10" stroke-dasharray="0 502.65" stroke-linecap="round"/>
          <circle id="battCapDot" cx="100" cy="20" r="6" fill="#fff" opacity="0" style="transition:all 800ms ease-in-out;pointer-events:none;"/>
          <text id="battSOC" x="100" y="108" text-anchor="middle" dominant-baseline="middle" class="batt-soc" fill="var(--text)" style="filter:drop-shadow(0 0 8px var(--green-glow))">0%</text>
        </svg>
        <div class="batt-status-pill" style="margin-top:10px;">
          <div id="battStatusDot" style="width:8px;height:8px;border-radius:50%;background:var(--text2);animation:pulse 2s ease-in-out infinite;"></div>
          <span id="battStatus" style="font-size:12px;font-weight:700;letter-spacing:0.02em;">${t(lang, 'idle')}</span>
        </div>
      </div>
      <div class="batt-zone-label">Live</div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battVolt">--</div><div class="stat-label">${t(lang, 'voltage')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battCurr">--</div><div class="stat-label">${t(lang, 'current')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battPow">--</div><div class="stat-label">${t(lang, 'power')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battAh">--</div><div class="stat-label">${t(lang, 'remaining')}</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battEnergy">--</div><div class="stat-label">${t(lang, 'energy')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayIn">--</div><div class="stat-label">${t(lang, 'todayIn')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayOut">--</div><div class="stat-label">${t(lang, 'todayOut')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTTE">--</div><div class="stat-label" id="battTTELabel">${t(lang, 'tte')}</div></div>
      </div>
      <div class="stat-divider"></div>
      <div class="batt-zone-label">Pack Info</div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysCycles">--</div><div class="inf-k">${t(lang, 'cycles')}</div></div>
        <div class="inf"><div class="inf-v" id="sysCapacity">215 Ah</div><div class="inf-k">${t(lang, 'capacity')}</div></div>
        <div class="inf"><div class="inf-v" id="sysNominal">51.2 V</div><div class="inf-k">${t(lang, 'nominal')}</div></div>
        <div class="inf"><div class="inf-v" id="sysConfig">16S</div><div class="inf-k">${t(lang, 'config')}</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysMinCell">-- V</div><div class="inf-k">${t(lang, 'minCell')}</div></div>
        <div class="inf"><div class="inf-v" id="sysMaxCell">-- V</div><div class="inf-k">${t(lang, 'maxCell')}</div></div>
        <div class="inf"><div class="inf-v" id="sysRuntime">--</div><div class="inf-k">${t(lang, 'runtime')}</div></div>
        <div class="inf"><div class="inf-v" id="sysThroughput">--</div><div class="inf-k">${t(lang, 'throughput')}</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="battMosfetTemp">--</div><div class="inf-k">${t(lang, 'mosfet')}</div></div>
        <div class="inf"><div class="inf-v" id="sysBmsModel">--</div><div class="inf-k">${t(lang, 'bmsModel')}</div></div>
        <div class="inf"><div class="inf-v" id="sysFirmware">--</div><div class="inf-k">${t(lang, 'firmware')}</div></div>
        <div class="inf"><div class="inf-v" id="sysChemistry">LiFePO\u2084</div><div class="inf-k">${t(lang, 'chemistry')}</div></div>
      </div>
    </div>
    <div class="grid-info" id="gridInfo" style="display:none"><span id="gridVoltDisp">--</span><span id="gridFreqDisp">--</span></div>
  </div>
        <div class="mid-row">
      <div class="card" id="solarCard">
        <h2 class="section-title">${t(lang, 'solarPanels')}</h2>
        <div class="weather-hero">
          <span id="wxEmoji" class="weather-hero-icon">🌤️</span>
          <div class="weather-hero-body">
            <div class="weather-hero-top">
              <span id="wxCondition" class="weather-hero-condition">--</span>
              <span id="wxTemp" class="weather-hero-temp">--</span>
            </div>
            <div class="weather-hero-sub"><span><span id="wxCloud">--</span> ${t(lang, 'cloud').toLowerCase()}&thinsp;·&thinsp;<span id="wxHumid">--</span> ${t(lang, 'humidity').toLowerCase()}</span><span id="wxSource" class="weather-hero-source"></span></div>
          </div>
        </div>
        <div id="solActualWrap" style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span id="solActual" class="sol-output" style="color:var(--green)">-- W</span>
          <span id="solActualLabel" style="font-size:13px;color:var(--text2)">${t(lang, 'actual')}</span>
          <span id="solPerfChip" class="sol-perf-chip" style="display:none">--%</span>
        </div>
        <div id="solEstimatedWrap" style="display:flex;align-items:baseline;gap:12px;margin-top:4px;flex-wrap:wrap">
          <span id="solOutput" style="font-size:20px;font-weight:700;color:var(--orange)">--- W</span>
          <span style="font-size:13px;color:var(--text2)">${t(lang, 'estimated')}</span>
        </div>
        <div id="solGenWrap" style="display:flex;align-items:baseline;gap:8px;margin-top:4px;flex-wrap:wrap">
          <span id="solTodayGen" style="font-size:15px;font-weight:600;color:var(--green)">--</span>
          <span style="font-size:12px;color:var(--text3)">${t(lang, 'generatedToday')}</span>
          <span style="font-size:12px;color:var(--text3)">&middot;</span>
          <span id="solForecast" style="font-size:15px;font-weight:600;color:var(--text2)">--</span>
          <span style="font-size:12px;color:var(--text3)">${t(lang, 'expected')}</span>
        </div>
        <div class="health-bar"><div class="health-fill" id="solDegFill"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;">
          <span id="solHealthPct" style="color:var(--green)">--%</span>
          <span id="solDegPct" style="color:var(--red)">--%</span>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solRated">--</div><div class="stat-label">${t(lang, 'rated')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solInstalled">--</div><div class="stat-label">${t(lang, 'installed')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solAge">--</div><div class="stat-label">${t(lang, 'age')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solModel">--</div><div class="stat-label">${t(lang, 'model')}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solType">--</div><div class="stat-label">${t(lang, 'type')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solYr1">--</div><div class="stat-label">${t(lang, 'year1Loss')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solYrN">--</div><div class="stat-label">${t(lang, 'annualLoss')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solNextYr">--</div><div class="stat-label">${t(lang, 'nextYear')}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solSavedToday">--</div><div class="stat-label">${t(lang, 'savedToday')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solSavedMonth">--</div><div class="stat-label">${t(lang, 'savedMonth')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solSavedTotal">--</div><div class="stat-label">${t(lang, 'savedTotal')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solPeakPower">--</div><div class="stat-label">${t(lang, 'peakPower')}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solPerformance">--</div><div class="stat-label">${t(lang, 'performance')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solEfficiency">--</div><div class="stat-label">${t(lang, 'efficiency')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solSunHours">--</div><div class="stat-label">${t(lang, 'sunHours')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solPanelTemp">--</div><div class="stat-label">${t(lang, 'panelTemp')}</div></div>
        </div>
      </div>
    <div class="card" id="controlsCard">
      <h2 class="section-title">${t(lang, 'controls')}</h2>
      <div class="ctrl" id="ctrlRowChg">
        <div><div class="ctrl-name">${t(lang, 'ctrlCharging')}</div><div class="ctrl-desc">${t(lang, 'descCharging')}</div></div>
        <div class="ctrl-actions">
          <span class="ctrl-badge" id="chgBadge">--</span>
          <label class="toggle"><input type="checkbox" id="chgToggle" checked><span class="slider"></span></label>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowDischg">
        <div><div class="ctrl-name">${t(lang, 'ctrlDischarging')}</div><div class="ctrl-desc">${t(lang, 'descDischarging')}</div></div>
        <div class="ctrl-actions">
          <span class="ctrl-badge" id="dischgBadge">--</span>
          <label class="toggle"><input type="checkbox" id="dischgToggle" checked><span class="slider"></span></label>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowGrid">
        <div><div class="ctrl-name">${t(lang, 'ctrlGridInput')}</div><div class="ctrl-desc">${t(lang, 'descGridInput')}</div></div>
        <div class="ctrl-actions">
          <span class="ctrl-badge" id="gridBadge">--</span>
          <label class="toggle"><input type="checkbox" id="gridToggle"><span class="slider"></span></label>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowAbsorption">
        <div><div class="ctrl-name">${t(lang, 'ctrlAbsorption')}</div><div class="ctrl-desc" id="absorptionDesc">${t(lang, 'absNotArmed')}</div><div class="ctrl-desc" id="absorptionDetails" style="font-size:0.78em;opacity:0.65;display:none"></div></div>
        <div class="ctrl-actions">
          <span class="ctrl-badge" id="absorptionBadge">--</span>
          <label class="toggle"><input type="checkbox" id="absorptionToggle"><span class="slider"></span></label>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowGridConnect">
        <div><div class="ctrl-name">${t(lang, 'ctrlGridConnect')}</div><div class="ctrl-desc">${t(lang, 'descGridConnect')}</div></div>
        <div class="ctrl-actions">
          <div class="ctrl-stepper">
            <button class="step-btn" id="gridConnectMinus">−</button>
            <span id="gridConnectVal" class="step-val">--</span>
            <button class="step-btn" id="gridConnectPlus">+</button>
          </div>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowGridDisconnect">
        <div><div class="ctrl-name">${t(lang, 'ctrlGridDisconnect')}</div><div class="ctrl-desc">${t(lang, 'descGridDisconnect')}</div></div>
        <div class="ctrl-actions">
          <div class="ctrl-stepper">
            <button class="step-btn" id="gridDisconnectMinus">−</button>
            <span id="gridDisconnectVal" class="step-val">--</span>
            <button class="step-btn" id="gridDisconnectPlus">+</button>
          </div>
        </div>
      </div>
      <div class="ctrl" id="ctrlRowBalancer">
        <div><div class="ctrl-name">${t(lang, 'ctrlBalancer')}</div><div class="ctrl-desc" id="balDesc">--</div></div>
        <div class="ctrl-actions">
          <span class="ctrl-badge" id="balBadge">--</span>
          <div id="balSwitch" style="display:flex;align-items:center;gap:6px">
            <span id="balSwitchLabel" style="font-size:12px;font-weight:600;color:var(--text2)">--</span>
            <div id="balDot" style="width:8px;height:8px;border-radius:50%;background:var(--text3)"></div>
          </div>
        </div>
      </div>
    </div>
        </div>
  <div class="card" id="chartsCard" style="margin-bottom:16px">
    <h2 class="section-title">${t(lang, 'analytics')}</h2>
    <div class="chart-tabs" id="chartTabs">
      <button class="chart-tab active" data-range="Live">${t(lang, 'tabLive')}</button>
      <button class="chart-tab" data-range="1D">${t(lang, 'tabYesterday')}</button>
      <button class="chart-tab" data-range="7D">${t(lang, 'tab7Days')}</button>
      <button class="chart-tab" data-range="30D">${t(lang, 'tab30Days')}</button>
    </div>
    <div class="chart-grid">
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartPower')}</div>
        <div class="chart-value"><span id="pwrVal">--</span></div>
        <canvas id="chartPower"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartBatterySOC')}</div>
        <div class="chart-value"><span id="socVal">--</span></div>
        <canvas id="chartSOC"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartSolar')}</div>
        <div class="chart-value"><span id="solVal">--</span></div>
        <canvas id="chartSolar"></canvas>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:11px;">
          <span style="color:var(--green);font-weight:600;">&#9632; ${t(lang, 'legendActual')}</span>
          <span id="solarOverlayLabel" style="color:var(--orange);font-weight:600;">&#9632; ${t(lang, 'legendEstimated')}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="cells-grid">
      <div id="pack1Card">
        <h2 class="section-title">${t(lang, 'cellsC1C8')}</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">${t(lang, 'temperature')}</span>
          <span id="pack1Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack1"></div>
      </div>
      <div id="pack2Card" style="border-left:1px solid var(--glass-border);padding-left:24px">
        <h2 class="section-title">${t(lang, 'cellsC9C16')}</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">${t(lang, 'temperature')}</span>
          <span id="pack2Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack2"></div>
      </div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-border)">
      <div id="balIndicator" style="text-align:center;font-size:14px;font-weight:600;color:var(--orange);display:none">
        <span id="balSrc">C1</span> <span style="color:var(--red)">\u25B2</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span style="color:var(--text3)">\u21C4</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span id="balDst">C12</span> <span style="color:var(--green)">\u25BC</span>
      </div>
      <div id="balStatus" style="display:flex;align-items:center;justify-content:center;gap:6px;text-align:center;font-size:13px;font-weight:600;color:var(--text2)">
        <span id="balStatusText"></span><span id="balTrend" class="delta-trend"></span>
      </div>
    </div>
  </div>
</div>
</div>`;
  }

  // ============ ANIMATION ENGINE ============
  // ============ P7: Centralized Animation Loop ============
  _animateValue(el, from, to, duration, formatter) {
    if (!el) return;
    if (from === to) {
      if (el.textContent === '--' || el.textContent === '') el.textContent = formatter(to);
      return;
    }
    if (Math.abs(to - from) < 0.01) { el.textContent = formatter(to); return; }

    // Cancel any existing animation for this element
    for (let i = this._animations.length - 1; i >= 0; i--) {
      if (this._animations[i].el === el) {
        this._animations[i].done = true;
        this._animations.splice(i, 1);
      }
    }

    this._animations.push({ el, from, to, duration, formatter, start: performance.now(), done: false });
    if (!this._animRafId) this._animRafId = requestAnimationFrame((t) => this._animationLoop(t));
  }

  _animationLoop(now) {
    this._animRafId = null;
    const len = this._animations.length;
    for (let i = len - 1; i >= 0; i--) {
      const a = this._animations[i];
      if (a.done) { this._animations.splice(i, 1); continue; }
      const t = Math.min((now - a.start) / a.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      a.el.textContent = a.formatter(a.from + (a.to - a.from) * eased);
      if (t < 1) continue;
      // Animation complete — flash effect
      this._animations.splice(i, 1);
      a.el.classList.remove('val-flash');
      requestAnimationFrame(() => {
        a.el.classList.add('val-flash');
      });
      const _cleanFlash = () => a.el.classList.remove('val-flash');
      const _flashTimer = setTimeout(_cleanFlash, 1000);
      a.el._flashTimer = _flashTimer;
      a.el.addEventListener('animationend', () => { clearTimeout(a.el._flashTimer); _cleanFlash(); a.el._flashTimer = null; }, { once: true, passive: true });
    }
    if (this._animations.length > 0) {
      this._animRafId = requestAnimationFrame((t) => this._animationLoop(t));
    }
  }

  _cancelAllAnimations() {
    if (this._animRafId) { cancelAnimationFrame(this._animRafId); this._animRafId = null; }
    for (const a of this._animations) {
      a.done = true;
      if (a.el._flashTimer) { clearTimeout(a.el._flashTimer); a.el._flashTimer = null; }
    }
    this._animations = [];
  }

  // ============ UI UPDATE DISPATCHER ============
  _updateUI(changedEntities) {
    const root = this.shadowRoot;
    if (!root || !this._bridge._hass) return;
    const E = this._bridge.E;
    const lang = this._bridge._hass.language || 'en';
    const batteryEntities = [E.SOC, E.VOLTAGE, E.CURRENT, E.POWER, E.REMAINING,
      E.CYCLES, E.RUNTIME, E.THROUGHPUT, E.MIN_CELL_V, E.MAX_CELL_V,
      E.MIN_V_CELL, E.MAX_V_CELL, E.FIRMWARE, E.MANUFACTURER, E.STRINGS,
      E.MOSFET_TEMP, E.CHG_POWER, E.DISCHG_POWER, this._bridge.gridEntities.PV_POWER?.entityId];
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

    this._updatePowerFlow();

    const hasCellChange = changedEntities.some(id =>
      id.includes('cell_voltage_') || id === E.BALANCING);
    if (hasCellChange) this._updateCellBalance();

    this._updateWeather();

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
        const balRow = root.getElementById('ctrlRowBalancer');
        const balBadge = root.getElementById('balBadge');
        if (balRow) balRow.classList.toggle('active', active || switchOn);
        if (!switchOn) {
          label.textContent = t(lang, 'balDisabled');
          label.style.color = 'var(--red)';
          dot.style.background = 'var(--red)';
          dot.style.boxShadow = '0 0 6px var(--red-glow)';
          desc.textContent = t(lang, 'balOff');
          if (balBadge) { balBadge.textContent = t(lang, 'badgeOff'); balBadge.className = 'ctrl-badge'; }
        } else if (active) {
          label.textContent = t(lang, 'balancing');
          label.style.color = 'var(--orange)';
          dot.style.background = 'var(--orange)';
          dot.style.boxShadow = '0 0 6px var(--orange-glow)';
          desc.textContent = t(lang, 'balActive');
          if (balBadge) { balBadge.textContent = t(lang, 'badgeActive'); balBadge.className = 'ctrl-badge active'; }
        } else {
          label.textContent = t(lang, 'idle');
          label.style.color = 'var(--green)';
          dot.style.background = 'var(--green)';
          dot.style.boxShadow = '0 0 6px var(--green-glow)';
          desc.textContent = t(lang, 'balEnabledIdle');
          if (balBadge) { balBadge.textContent = t(lang, 'badgeStandby'); balBadge.className = 'ctrl-badge'; }
        }
      }
      if (eid === E.CHG_SWITCH) {
        const isOn = val === 'on';
        const toggle = root.getElementById('chgToggle');
        if (toggle) toggle.checked = isOn;
        const row = root.getElementById('ctrlRowChg');
        if (row) row.classList.toggle('active', isOn);
        const badge = root.getElementById('chgBadge');
        if (badge) { badge.textContent = isOn ? t(lang, 'badgeActive') : t(lang, 'badgeStandby'); badge.className = `ctrl-badge ${isOn ? 'active' : ''}`; }
      }
      if (eid === E.DISCHG_SWITCH) {
        const isOn = val === 'on';
        const toggle = root.getElementById('dischgToggle');
        if (toggle) toggle.checked = isOn;
        const row = root.getElementById('ctrlRowDischg');
        if (row) row.classList.toggle('active', isOn);
        const badge = root.getElementById('dischgBadge');
        if (badge) { badge.textContent = isOn ? t(lang, 'badgeActive') : t(lang, 'badgeStandby'); badge.className = `ctrl-badge ${isOn ? 'active' : ''}`; }
      }
      if (eid === E.GRID_SWITCH) {
        const isOn = val === 'on';
        const el = root.getElementById('gridToggle');
        if (el) el.checked = isOn;
        const row = root.getElementById('ctrlRowGrid');
        if (row) row.classList.toggle('active', isOn);
        const badge = root.getElementById('gridBadge');
        if (badge) { badge.textContent = isOn ? t(lang, 'badgeActive') : t(lang, 'badgeOff'); badge.className = `ctrl-badge ${isOn ? 'active' : ''}`; }
      }
      if (eid === E.ABSORPTION_SWITCH) {
        const isOn = val === 'on';
        const el = root.getElementById('absorptionToggle');
        if (el) el.checked = isOn;
        const row = root.getElementById('ctrlRowAbsorption');
        if (row) row.classList.toggle('active', isOn);
        const badge = root.getElementById('absorptionBadge');
        if (badge) { badge.textContent = isOn ? t(lang, 'badgeArmed') : t(lang, 'badgeOff'); badge.className = `ctrl-badge ${isOn ? 'armed' : ''}`; }
      }
      const absStatusEid = this._bridge._gridEntityIds?.ABSORPTION_STATUS?.entityId;
      if (absStatusEid && eid === absStatusEid) {
        const el = root.getElementById('absorptionDesc');
        const detailEl = root.getElementById('absorptionDetails');
        if (el && val) {
          const isLastRun = val.startsWith('Last run');
          const isArmed = val.startsWith('Armed');
          const isActive = val.startsWith('Active');
          const isNotArmed = val.startsWith('Not Armed');
          el.textContent = isLastRun ? t(lang, 'absLastRun') : isArmed ? t(lang, 'absArmed') : isActive ? t(lang, 'absActive') : isNotArmed ? t(lang, 'absNotArmed') : val;
          if (val.startsWith('Active')) el.style.color = 'var(--orange)';
          else if (val.startsWith('Armed')) el.style.color = 'var(--amber, #f59e0b)';
          else if (isLastRun) el.style.color = 'var(--green)';
          else { el.style.color = ''; }
          if (detailEl) {
            if (isLastRun) {
              const durEid = this._bridge._gridEntityIds?.ABSORPTION_DURATION?.entityId;
              const durMins = durEid ? parseFloat(this._bridge._hass?.states?.[durEid]?.state) : NaN;
              const lastChanged = this._bridge._hass?.states?.[absStatusEid]?.last_changed;
              const parts = [];
              if (!isNaN(durMins)) { const h = Math.floor(durMins / 60); const m = Math.round(durMins % 60); parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`); }
              if (lastChanged) { const d = new Date(lastChanged); parts.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })); }
              detailEl.textContent = parts.join(' · ');
              detailEl.style.display = '';
            } else {
              detailEl.style.display = 'none';
            }
          }
        }
      }
      if (eid === E.GRID_CONNECT_SOC) { const el = root.getElementById('gridConnectVal'); if (el) el.textContent = parseFloat(val) + '%'; }
      if (eid === E.GRID_DISCONNECT_SOC) { const el = root.getElementById('gridDisconnectVal'); if (el) el.textContent = parseFloat(val) + '%'; }
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
    const now = new Date();

    const r = 80, circ = 2 * Math.PI * r;
    const ring = this._els.battRing;
    const capDot = this._els.battCapDot;
    if (soc != null) {
      const socEl = this._els.battSOC;
      const oldSoc = parseFloat(socEl.textContent) || 0;
      this._animateValue(socEl, oldSoc, soc, 600, v => Math.round(v) + '%');
      const color = soc < 20 ? 'var(--red)' : soc < 40 ? 'var(--orange)' : 'var(--green)';
      const glow = soc < 20 ? 'var(--red-glow)' : soc < 40 ? 'var(--orange-glow)' : 'var(--green-glow)';
      ring.style.strokeDasharray = `${circ * soc / 100} ${circ}`;
      ring.style.stroke = color;
      socEl.style.filter = `drop-shadow(0 0 8px ${glow})`;
      if (capDot) {
        if (soc > 0) {
          const angle = (soc / 100) * 2 * Math.PI - Math.PI / 2;
          const cx = 100 + r * Math.cos(angle);
          const cy = 100 + r * Math.sin(angle);
          capDot.setAttribute('cx', cx.toFixed(2));
          capDot.setAttribute('cy', cy.toFixed(2));
          capDot.style.fill = color;
          capDot.style.filter = 'drop-shadow(0 0 6px ' + color + ')';
          capDot.style.opacity = '1';
        } else {
          capDot.style.opacity = '0';
        }
      }

      // Threshold tick marks on radial gauge
      const connectSoc = this._bridge.getVal(E.GRID_CONNECT_SOC) ?? 20;
      const disconnectSoc = this._bridge.getVal(E.GRID_DISCONNECT_SOC) ?? 90;
      const threshGroup = root.getElementById('battThresholds');
      if (threshGroup) {
        let svgTicks = '';
        if (connectSoc > 0 && connectSoc < 100) {
          const a1 = (connectSoc / 100) * 2 * Math.PI - Math.PI / 2;
          const x1 = 100 + 73 * Math.cos(a1), y1 = 100 + 73 * Math.sin(a1);
          const x2 = 100 + 87 * Math.cos(a1), y2 = 100 + 87 * Math.sin(a1);
          svgTicks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="batt-threshold-tick" stroke="var(--orange, #ff9f0a)" stroke-width="2.5" opacity="0.85"/>`;
        }
        if (disconnectSoc > 0 && disconnectSoc < 100) {
          const a2 = (disconnectSoc / 100) * 2 * Math.PI - Math.PI / 2;
          const x1 = 100 + 73 * Math.cos(a2), y1 = 100 + 73 * Math.sin(a2);
          const x2 = 100 + 87 * Math.cos(a2), y2 = 100 + 87 * Math.sin(a2);
          svgTicks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="batt-threshold-tick" stroke="var(--blue, #0a84ff)" stroke-width="2.5" opacity="0.85"/>`;
        }
        if (threshGroup.innerHTML !== svgTicks) threshGroup.innerHTML = svgTicks;
      }
    } else {
      this._els.battSOC.textContent = '--%';
      this._els.battSOC.style.filter = 'none';
      ring.style.strokeDasharray = `0 ${circ}`;
      ring.style.stroke = 'var(--secondary-text)';
      if (capDot) capDot.style.opacity = '0';
    }

    const cur = current || 0;
    // I15: Derive idle threshold from battery capacity (0.5% of fullAh)
    const idleThreshold = 0.005 * (this._bridge.battSpec?.fullAh || 100);
    const lang = this._bridge._hass?.language || 'en';
    const status = cur > idleThreshold ? t(lang, 'charging') : cur < -idleThreshold ? t(lang, 'discharging') : t(lang, 'idle');
    const statusColor = status === t(lang, 'charging') ? 'var(--green)' : status === t(lang, 'discharging') ? 'var(--red)' : 'var(--text2)';
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
    if (cur < -idleThreshold && remaining > 0) {
      tte = fmtDHM(remaining / Math.abs(cur));
      if (tteLabel) tteLabel.textContent = t(lang, 'tte');
    } else if (cur > idleThreshold) {
      if (soc != null && soc < 100) {
        const fullCap = (soc > 0 && remaining > 0)
          ? Math.max(battSpec.fullAh || 0, remaining / (soc / 100))
          : (battSpec.fullAh || 100);
        const toFill = remaining > 0 ? fullCap - remaining : fullCap * (1 - soc / 100);
        if (toFill > 0) tte = fmtDHM(toFill / cur);
        else tte = '\u221E (' + t(lang, 'charging') + ')';
      } else {
        tte = '\u221E (' + t(lang, 'charging') + ')';
      }
      if (tteLabel) tteLabel.textContent = t(lang, 'ttf');
    } else {
      tte = '\u221E (' + t(lang, 'idle') + ')';
      if (tteLabel) tteLabel.textContent = t(lang, 'tte');
    }
    this._els.battTTE.textContent = tte;

    // PV production and battery charging are distinct measurements.
    const solarActual = readEnergyState(this._bridge).solarW;
    this._solarActualWatts = solarActual;
    if (solarActual > this._peakPowerToday) {
      this._peakPowerToday = solarActual;
      const peakEl = this.shadowRoot.getElementById('solPeakPower');
      if (peakEl) peakEl.textContent = this._peakPowerToday.toLocaleString() + ' W';
    }

    // Track sun hours — count unique hours where solar output > 10% of rated
    const panelConfig = this._getPanelConfig();
    const ratedTotal = panelConfig.count * panelConfig.ratedWatts;
    if (ratedTotal > 0 && solarActual > 0) {
      // Reset at midnight (new day in HA timezone)
      const todayKey = this._getDateKeyInTZ();
      if (this._lastSunHourDay !== todayKey) {
        this._sunHourSet = new Set();
        this._sunHoursToday = 0;
        this._lastSunHourDay = todayKey;
      }
      const threshold = ratedTotal * 0.1;
      if (solarActual > threshold) {
        if (!this._sunHourSet) this._sunHourSet = new Set();
        this._sunHourSet.add(this._getHourInTZ());
        this._sunHoursToday = this._sunHourSet.size;
      }
    }

    const solActualEl = this._els.solActual;
    if (solarActual == null) solActualEl.textContent = '—';
    else this._animateValue(solActualEl, parseFloat(solActualEl.textContent) || 0, solarActual, 600, v => Math.round(v) + ' W');

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
  _updatePowerFlow() {
    refreshControlAvailability(this.shadowRoot,this._bridge,this._controlHandler?.pending);
    const state = readEnergyState(this._bridge);
    this._hud?.updateEnergy(state);
    this._world?.setEnergy(state);
    this._world?.setPanelConfig({ ...this._getPanelConfig(), width: this._bridge.panelWidth, height: this._bridge.panelHeight });
    const grid = this._bridge.getGridSnap();
    for (const [id, value, unit] of [['gridVoltDisp', grid.gridVoltage, 'V'], ['gridFreqDisp', grid.gridFreq, 'Hz']]) {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.textContent = value == null ? '—' : value.toFixed(1) + ' ' + unit;
    }
  }
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
      // Solar follows the measured PV source used by the 3D overview.
      if (solEl) {
        const chargeVal = readEnergyState(this._bridge).solarW;
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
    if (pwrEl) {
      if (powerData?.length) {
        const avg = powerData.reduce((s, v) => s + (v || 0), 0) / powerData.length;
        pwrEl.textContent = Math.round(Math.abs(avg)) + ' W';
      } else {
        pwrEl.textContent = '--';
      }
    }
    if (socEl) {
      if (socData?.length) {
        const avg = socData.reduce((s, v) => s + (v || 0), 0) / socData.length;
        socEl.textContent = Math.round(avg) + '%';
      } else {
        socEl.textContent = '--';
      }
    }
    if (solEl) {
      if (solarData?.length) {
        const avg = solarData.reduce((s, v) => s + (v || 0), 0) / solarData.length;
        solEl.textContent = Math.round(avg) + ' W';
      } else {
        solEl.textContent = '--';
      }
    }
  }

  // ============ WEATHER UPDATE ============
  _updateWeather() { this._weatherState?.update(); }

  _skyLocation() {
    const latitudeDeg=this._bridge.latitude, longitudeDeg=this._bridge.longitude;
    return latitudeDeg==null||longitudeDeg==null?null:{latitudeDeg,longitudeDeg,elevationM:this._bridge.elevation||0};
  }

  _updateSky() {
    if (!this._world || !this._weatherState) return;
    const snapshot=this._weatherState.snapshot(), location=this._skyLocation(), lang=this._bridge._hass?.language || 'en';
    const state=computeSky(new Date(),location,{weather:{...snapshot.effective,condition:snapshot.condition},iss:this._issTracker?.snapshot()});
    if (!state) { this.shadowRoot.getElementById('skyQuality').textContent=t(this._bridge._hass?.language || 'en', 'locationUnavailable'); return; }
    this._world.setSky(state);
    this.shadowRoot.getElementById('skySummary').textContent=`${t(lang, 'sun')} ${state.sun.elevationDeg.toFixed(1)}° · ${t(lang, 'moon')} ${Math.round(state.moon.illumination*100)}%`;
    this.shadowRoot.getElementById('skyQuality').textContent=`${t(lang, 'observerSky')} · ${t(lang, 'weather')} ${t(lang, 'quality_' + snapshot.quality)}`;
  }

  // ============ SOLAR UPDATE ============
  async _fetchEnergyPriceAndCurrency() {
    try {
      const rate = await this._bridge._fetchEnergyPrice();
      this._energyPrice = rate || 0;
    } catch (_) { this._energyPrice = 0; }
    try {
      const sym = getCurrencySymbol(this._bridge._hass);
      this._currencySymbol = sym || '\u20B9';
    } catch (_) { this._currencySymbol = '\u20B9'; }
    // Refresh UI once price/currency is loaded
    this._updateSolarUI();
  }

  async _fetchMonthStartThroughput() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const throughputEntity = this._bridge.E.THROUGHPUT;
      if (!throughputEntity) return;
      const history = await this._bridge.fetchHistoryRange(throughputEntity, startOfMonth, now, true);
      if (history && history.length > 0) {
        this._monthStartThroughput = history[0].v || 0;
      }
    } catch (_) { this._monthStartThroughput = 0; }
    // Refresh UI once month-start data is loaded
    this._updateSolarUI();
  }

  async _fetchTodayPeakPower() {
    try {
      const now = new Date();
      const midnight = this._getTodayMidnight();
      const chgPowerEntity = this._bridge.gridEntities.PV_POWER?.entityId;
      if (!chgPowerEntity) return;
      const rawHistory = await this._bridge.fetchHistoryRange(chgPowerEntity, midnight, now, false);
      const scale=powerUnitScale(this._bridge,chgPowerEntity);
      const history=rawHistory?.map(h=>({...h,v:h.v==null?null:h.v*scale}));
      if (history && history.length > 0) {
        // Find max value in today's history
        const maxPower = history.reduce((max, h) => Math.max(max, h.v || 0), 0);
        if (maxPower > this._peakPowerToday) {
          this._peakPowerToday = maxPower;
        }
      }
    } catch (_) { /* keep existing peak */ }
  }

  async _fetchTodaySolarStats() {
    try {
      const now = new Date();
      const midnight = this._getTodayMidnight();
      const chgPowerEntity = this._bridge.gridEntities.PV_POWER?.entityId;
      if (!chgPowerEntity) return;
      const rawHistory = await this._bridge.fetchHistoryRange(chgPowerEntity, midnight, now, false);
      const scale=powerUnitScale(this._bridge,chgPowerEntity);
      const history=rawHistory?.map(h=>({...h,v:h.v==null?null:h.v*scale}));
      if (!history || history.length === 0) return;
      
      const panelConfig = this._getPanelConfig();
      const ratedTotal = panelConfig.count * panelConfig.ratedWatts;
      const threshold = ratedTotal * 0.1;
      
      let totalEfficiency = 0;
      let effCount = 0;
      const hourSet = new Set();
      
      for (const h of history) {
        const watts = h.v || 0;
        if (watts > 0) {
          // Efficiency
          totalEfficiency += (watts / ratedTotal) * 100;
          effCount++;
          
          // Sun hours - count unique hours above threshold
          if (watts > threshold) {
            const hour = this._getHourInTZ(h.t);
            hourSet.add(hour);
          }
        }
      }
      
      if (effCount > 0) {
        this._efficiencyPct = totalEfficiency / effCount;
      }
      this._sunHoursToday = hourSet.size;
      this._sunHourSet = hourSet;
      this._lastSunHourDay = this._getDateKeyInTZ();
      
    } catch (_) { /* keep existing values */ }
  }

  async _fetchTodayPerformance() {
    try {
      const now = new Date();
      const midnight = this._getTodayMidnight();
      const chgPowerEntity = this._bridge.gridEntities.PV_POWER?.entityId;
      if (!chgPowerEntity) return;
      const rawHistory = await this._bridge.fetchHistoryRange(chgPowerEntity, midnight, now, false);
      const scale=powerUnitScale(this._bridge,chgPowerEntity);
      const history=rawHistory?.map(h=>({...h,v:h.v==null?null:h.v*scale}));
      if (!history || history.length === 0) return;
      
      const panelConfig = this._getPanelConfig();
      let totalPerf = 0;
      let perfCount = 0;
      
      for (const h of history) {
        const actualWatts = h.v || 0;
        if (actualWatts > 0) {
          const timestamp = new Date(h.t);
          const result = this._engine.calcSolarOutput(
            timestamp, 
            panelConfig, 
            (1 - this._weatherCloudFactor) * 100, 
            this._weatherAmbientC
          );
          if (result.watts > 0) {
            totalPerf += (actualWatts / result.watts) * 100;
            perfCount++;
          }
        }
      }
      
      if (perfCount > 0) {
        this._performancePct = totalPerf / perfCount;
      }
    } catch (_) { /* keep existing value */ }
  }

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

  _getTodayMidnight() {
    const tz = this._bridge.timezone;
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('sv', { timeZone: tz }).format(now);
    const svFmt = new Intl.DateTimeFormat('sv', { timeZone: tz });
    const timeFmt = new Intl.DateTimeFormat('sv', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    let candidate = new Date(`${todayStr}T12:00:00Z`);
    if (svFmt.format(candidate) < todayStr) candidate = new Date(candidate.getTime() + 86400000);
    if (svFmt.format(candidate) > todayStr) candidate = new Date(candidate.getTime() - 86400000);
    const [lh, lm] = timeFmt.format(candidate).split(':').map(Number);
    let midnightUTC = new Date(candidate.getTime() - (lh * 3600 + lm * 60) * 1000);
    const [vh, vm] = timeFmt.format(midnightUTC).split(':').map(Number);
    if (vh !== 0 || vm !== 0) midnightUTC = new Date(midnightUTC.getTime() - (vh * 3600 + vm * 60) * 1000);
    return midnightUTC;
  }

  _getHourInTZ(date = new Date()) {
    const tz = this._bridge.timezone;
    return parseInt(new Intl.DateTimeFormat('en', { timeZone: tz, hour: 'numeric', hour12: false }).format(date), 10);
  }

  _getDateKeyInTZ(date = new Date()) {
    const tz = this._bridge.timezone;
    return new Intl.DateTimeFormat('sv', { timeZone: tz }).format(date);
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
      this._panelTemp = this._weatherAmbientC != null ? this._weatherAmbientC : null;
      const solOutput = root.getElementById('solOutput');
      if (solOutput) {
        this._animateValue(solOutput, parseFloat(solOutput.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      }
      const solForecast = root.getElementById('solForecast');
      if (solForecast) {
        this._animateValue(solForecast, parseFloat(solForecast.textContent) || 0, 0, 600, v => v.toFixed(1) + ' kWh');
      }
      // Night empty state: replace -- W with moon icon + sunrise time
      const solActualEl = root.getElementById('solActual');
      if (solActualEl && !solActualEl.classList.contains('sol-output-empty') && !this._fadeTimeout) {
        const isEmpty = solActualEl.textContent.includes('--');
        if (isEmpty) {
          // Fade out current content
          solActualEl.style.opacity = '0';
          // Fade out estimated row
          const estWrap = root.getElementById('solEstimatedWrap');
          if (estWrap) {
            estWrap.style.transition = 'opacity 0.3s ease';
            estWrap.style.opacity = '0';
          }
          this._fadeTimeout = setTimeout(() => {
            solActualEl.classList.add('sol-output-empty');
            const nextRise = this._getNextSunrise();
            const lang = this._bridge._hass?.language || 'en';
            solActualEl.innerHTML = `<span class="moon-icon">🌙</span><span class="sunrise-time">${t(lang, 'resumesAt')} ${nextRise}</span><span class="sunrise-sub">Sun below horizon</span>`;
            // Center the actual row and hide its label
            const actualWrap = root.getElementById('solActualWrap');
            if (actualWrap) actualWrap.style.justifyContent = 'center';
            const actualLabel = root.getElementById('solActualLabel');
            if (actualLabel) actualLabel.style.display = 'none';
            // Fade in night content
            solActualEl.style.opacity = '1';
            this._fadeTimeout = null;
          }, 300);
        }
      }
      return;
    }

    // Day: full solar math pipeline
    if (!this._wasDay) {
      this._lastForecastHour = -1; // reset on sunrise
      this._peakPowerToday = 0;
      this._sunHourSet = new Set();
      this._sunHoursToday = 0;
    }
    this._wasDay = true;
    // Clear night empty state if it was active
    const solActualDayEl = root.getElementById('solActual');
    if (solActualDayEl && solActualDayEl.classList.contains('sol-output-empty') && !this._fadeTimeout) {
      // Fade out night content
      solActualDayEl.style.opacity = '0';
      this._fadeTimeout = setTimeout(() => {
        solActualDayEl.classList.remove('sol-output-empty');
        solActualDayEl.innerHTML = '-- W';
        solActualDayEl.style.color = 'var(--green)';
        // Restore actual row layout
        const actualWrap = root.getElementById('solActualWrap');
        if (actualWrap) actualWrap.style.justifyContent = '';
        const actualLabel = root.getElementById('solActualLabel');
        if (actualLabel) actualLabel.style.display = '';
        // Show estimated row again
        const estWrap = root.getElementById('solEstimatedWrap');
        if (estWrap) estWrap.style.opacity = '1';
        // Fade in day content
        solActualDayEl.style.opacity = '1';
        this._fadeTimeout = null;
      }, 300);
    }
    const panelConfig = this._getPanelConfig();
    this._engine.getDegradationInfo(now, panelConfig);
    const result = this._engine.calcSolarOutput(now, panelConfig, (1 - this._weatherCloudFactor) * 100, this._weatherAmbientC);
    this._panelTemp = result.panelTemp != null ? result.panelTemp : null;
    this._solarEstimatedWatts = result.watts;

    // Performance %: actual vs estimated
    if (result.watts > 0 && this._solarActualWatts > 0) {
      this._performancePct = (this._solarActualWatts / result.watts) * 100;
    }
    // Efficiency %: actual vs rated capacity
    const ratedTotal = panelConfig.count * panelConfig.ratedWatts;
    if (ratedTotal > 0 && this._solarActualWatts > 0) {
      this._efficiencyPct = (this._solarActualWatts / ratedTotal) * 100;
    }

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

  _getNextSunrise() {
    const nextRising = this._bridge._hass?.states?.['sun.sun']?.attributes?.next_rising;
    if (nextRising) {
      return new Date(nextRising).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '06:00';
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

    // Money saved + peak + performance + efficiency + sun hours + panel temp
    const savedToday = this._todayIn * this._energyPrice;
    const throughput = this._bridge.getVal(this._bridge.E.THROUGHPUT) || 0;
    const nomV = this._bridge.battSpec?.nomV || 51.2;
    const savedTotal = (throughput * nomV / 1000) * this._energyPrice;

    // Monthly savings: delta from month-start throughput (fetched from HA history)
    let monthKwh = this._todayIn; // fallback: today only
    if (this._monthStartThroughput != null) {
      const monthAh = throughput - this._monthStartThroughput;
      monthKwh = monthAh * nomV / 1000;
    }
    const savedMonth = monthKwh * this._energyPrice;

    // Without a configured tariff the price is 0; show unavailable rather than a misleading zero saving.
    for (const [id, value] of [['solSavedToday', savedToday], ['solSavedMonth', savedMonth], ['solSavedTotal', savedTotal]]) {
      const el = root.getElementById(id);
      if (!el) continue;
      if (!this._energyPrice) { el.textContent = '--'; continue; }
      this._animateValue(el, parseFloat(el.textContent.replace(/[^0-9.-]/g, '')) || 0, value, 600, v => this._currencySymbol + Math.round(v).toLocaleString());
    }
    const peakPowerEl = root.getElementById('solPeakPower');
    if (peakPowerEl) this._animateValue(peakPowerEl, parseFloat(peakPowerEl.textContent) || 0, this._peakPowerToday, 600, v => Math.round(v).toLocaleString() + ' W');
    const isNight = !this._wasDay;
    
    // Use historical efficiency/performance/sun hours if available, otherwise calculate from live data
    const pc = this._getPanelConfig();
    const ratedTotal = pc.count * pc.ratedWatts;
    let perfVal = this._performancePct || 0;
    let effVal = this._efficiencyPct || 0;
    if (!isNight) {
      // Only update from live data if no historical value
      if (perfVal === 0 && this._solarEstimatedWatts > 0 && this._solarActualWatts > 0) {
        perfVal = (this._solarActualWatts / this._solarEstimatedWatts) * 100;
      }
      if (effVal === 0 && ratedTotal > 0 && this._solarActualWatts > 0) {
        effVal = (this._solarActualWatts / ratedTotal) * 100;
      }
    }
    
    const performanceEl = root.getElementById('solPerformance');
    if (performanceEl) {
      performanceEl.textContent = isNight ? '\u{1F319}' : perfVal.toFixed(0) + '%';
      performanceEl.classList.toggle('night-icon', isNight);
    }
    const solPerfChip = root.getElementById('solPerfChip');
    if (solPerfChip) {
      if (!isNight && this._solarEstimatedWatts > 50 && this._solarActualWatts > 10) {
        const ratio = (this._solarActualWatts / this._solarEstimatedWatts) * 100;
        const cls = ratio >= 90 ? 'optimal' : ratio >= 70 ? 'moderate' : 'low';
        const label = ratio >= 90 ? 'Optimal' : ratio >= 70 ? 'Moderate' : 'Low';
        solPerfChip.textContent = `\u26A1 ${Math.round(ratio)}% ${label}`;
        solPerfChip.className = `sol-perf-chip ${cls}`;
        solPerfChip.style.display = 'inline-flex';
      } else {
        solPerfChip.style.display = 'none';
      }
    }
    const efficiencyEl = root.getElementById('solEfficiency');
    if (efficiencyEl) {
      efficiencyEl.textContent = isNight ? '\u{1F319}' : effVal.toFixed(1) + '%';
      efficiencyEl.classList.toggle('night-icon', isNight);
    }
    const sunHoursEl = root.getElementById('solSunHours');
    if (sunHoursEl) {
      sunHoursEl.textContent = isNight ? '\u{1F319}' : (this._sunHoursToday || 0) + 'h';
      sunHoursEl.classList.toggle('night-icon', isNight);
    }
    const panelTempEl = root.getElementById('solPanelTemp');
    if (panelTempEl) {
      if (isNight) {
        panelTempEl.textContent = '\u{1F319}';
        panelTempEl.classList.add('night-icon');
      } else {
        panelTempEl.textContent = this._panelTemp != null ? Math.round(this._panelTemp) + '\u00B0C' : '--';
        panelTempEl.classList.remove('night-icon');
      }
    }
  }

  // ============ CELL BALANCE ============
  _updateCellBalance() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const lang = this._bridge._hass?.language || 'en';
    const voltages = [];
    for (let i = 1; i <= 16; i++) {
      const v = this._bridge.getVal(E['CELL' + i]);
      voltages.push((v != null && v > 0) ? v : null);
    }
    const validVoltages = voltages.filter(v => v != null);
    if (validVoltages.length === 0) return;

    // P15: Skip if voltages haven't changed (cell voltages drift slowly, most updates are identical)
    const key = voltages.join(',');
    if (key === this._lastCellVoltagesKey) return;
    this._lastCellVoltagesKey = key;

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
      row.dataset.cellIndex = String(globalI); row.tabIndex = 0;
      row.setAttribute('aria-label', `Cell ${globalI + 1}, ${Number(v).toFixed(3)} volts`);
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
      if (!row._wired) {
        row._wired = true;
        row.addEventListener('pointerenter', () => {
          const idx = parseInt(row.dataset.cellIndex, 10);
          if (!isNaN(idx)) this._world?.highlightCell(idx);
        });
        row.addEventListener('pointerleave', () => {
          this._world?.highlightCell(null);
        });
        row.addEventListener('focus', () => {
          const idx = parseInt(row.dataset.cellIndex, 10);
          if (!isNaN(idx)) this._world?.highlightCell(idx);
        });
        row.addEventListener('blur', () => {
          this._world?.highlightCell(null);
        });
        row.addEventListener('click', () => {
          const idx = parseInt(row.dataset.cellIndex, 10);
          if (!isNaN(idx)) {
            this._hud?.select('cells');
            this._world?.focus('cells');
            this._world?.highlightCell(idx);
          }
        });
      }
    });
  }

  _applyBal(voltages) {
    const root = this.shadowRoot;
    const lang = this._bridge._hass?.language || 'en';
    const valid = voltages
      .map((v, i) => ({ v, i }))
      .filter(x => x.v != null && x.v > 0);
    if (valid.length === 0) return;

    const maxEntry = valid.reduce((a, b) => (b.v > a.v ? b : a));
    const minEntry = valid.reduce((a, b) => (b.v < a.v ? b : a));
    const maxI = maxEntry.i;
    const minI = minEntry.i;
    const delta = (maxEntry.v - minEntry.v) * 1000;
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

    this._world?.setCellStates({ voltages, minCell: minI, maxCell: maxI, balancing });

    const balStatusTextEl = root.getElementById('balStatusText') || root.getElementById('balStatus');
    const balTrendEl = root.getElementById('balTrend');
    const oldDelta = parseFloat(balStatusTextEl.textContent.replace(/[^0-9.]/g, '')) || 0;
    const suffix = balancing ? t(lang, 'mVBalancing') : t(lang, 'mV');
    this._animateValue(balStatusTextEl, oldDelta, delta, 600, v => `\u0394 ${Math.round(v)}${suffix}`);
    if (balTrendEl) {
      if (this._lastBalDelta != null) {
        if (delta < this._lastBalDelta - 0.5) {
          balTrendEl.textContent = '\u2193';
          balTrendEl.className = 'delta-trend closing';
        } else if (delta > this._lastBalDelta + 0.5) {
          balTrendEl.textContent = '\u2191';
          balTrendEl.className = 'delta-trend widening';
        } else {
          balTrendEl.textContent = '\u2194';
          balTrendEl.className = 'delta-trend stable';
        }
      } else {
        balTrendEl.textContent = '';
      }
    }
    this._lastBalDelta = delta;
  }

  // ============ CALC TODAY IN/OUT ============
  async _calcTodayInOut() {
    const lifecycle=this._controlEvents?.signal;
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

      const pvEntity=this._bridge.gridEntities.PV_POWER?.entityId;
      const pvHistory=pvEntity?await this._bridge.fetchHistoryRange(pvEntity,midnightUTC,now,true):null;
      if(lifecycle?.aborted)return;
      this._todaySolar=pvHistory?.length?integrateWatts(pvHistory.map(h=>({...h,v:h.v==null?null:h.v*powerUnitScale(this._bridge,pvEntity)}))):null;

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

    if(lifecycle?.aborted)return;
    // _todayIn / _todayOut are kWh
    const inEl = root.getElementById('battTodayIn');
    this._animateValue(inEl, parseFloat(inEl.textContent) || 0, this._todayIn, 600, v => v.toFixed(2) + ' kWh');
    const outEl = root.getElementById('battTodayOut');
    this._animateValue(outEl, parseFloat(outEl.textContent) || 0, this._todayOut, 600, v => v.toFixed(2) + ' kWh');

    // PV generation includes power consumed directly by the home.
    const solTodayEl = root.getElementById('solTodayGen');
    if (solTodayEl) {
      if(this._todaySolar==null)solTodayEl.textContent='—';
      else this._animateValue(solTodayEl, parseFloat(solTodayEl.textContent) || 0, this._todaySolar, 600, v => v.toFixed(1) + ' kWh');
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
  async _loadChartRange(range, force = false) {
    const previousRange=this._activeChartRange;
    this._activeChartRange = range;
    if (!this._charts) return;
    // P22: Debounce to prevent API spam from rapid tab clicks / visibility resume
    const now = Date.now();
    if (!force && previousRange===range&&this._chartFetchDebounce[range] && now - this._chartFetchDebounce[range] < 2000) return;
    this._chartFetchDebounce[range] = now;
    const generation=this._chartGeneration=(this._chartGeneration||0)+1;
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const lang = this._bridge._hass?.language || 'en';
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
    const solarPowerEntity = this._bridge.gridEntities.PV_POWER?.entityId;
    const samePowerEntity = batteryPowerEntity && batteryPowerEntity === solarPowerEntity;

    let result, solarResult;
    try {
      if (samePowerEntity) {
        // NI3: Both charts use the same entity — fetch once, loadRange splits signed data
        // (battery chart takes negative=discharge, solar chart takes positive=charge)
        result = await this._charts.loadRange(range, { power: canvases.power, soc: canvases.soc }, {
          power: batteryPowerEntity,
          soc: E.SOC,
          _signed: !E.DISCHG_POWER,
        }, this._bridge.timezone);
        solarResult = { powerData: result.powerData, timeXLabel: result.timeXLabel };
      } else {
        [result, solarResult] = await Promise.all([
          this._charts.loadRange(range, { power: canvases.power, soc: canvases.soc }, {
            power: batteryPowerEntity,
            soc: E.SOC,
            _signed: !E.DISCHG_POWER,
          }, this._bridge.timezone),
          solarPowerEntity
            ? this._charts.loadRange(range, {}, {
                power: solarPowerEntity,
                _signed: false,
              }, this._bridge.timezone)
            : Promise.resolve({ powerData: [], socData: [], timeXLabel: () => () => '' }),
        ]);
      }
    } catch (e) {
      console.warn('[Solar] Chart data load failed:', e);
      return;
    }

    if(generation!==this._chartGeneration||!this.isConnected)return;
    // Render solar chart with estimated overlay or single actual line
    if (canvases.solar) {
      if (solarResult?.powerData?.length) {
        const actualPts = solarResult.powerData.map(d => (d.v !== null) ? Math.max(d.v * powerUnitScale(this._bridge,solarPowerEntity), 0) : 0);
        if (this._engine && this._solarEngineReady) {
          const panelConfig = this._getPanelConfig();
          const isLive = range === 'Live';
          const is30D = range === '30D';
          const cloudPct = isLive ? (1 - this._weatherCloudFactor) * 100 : 0;
          const ambientC = isLive ? this._weatherAmbientC : null;
          let overlayPts, overlayLabel;
          if (is30D) {
            // 30D: show 7-day rolling average of actual as trend line (filter nighttime zeros)
            overlayPts = actualPts.map((_, i) => {
              const window = actualPts.slice(Math.max(0, i - 6), i + 1).filter(v => v > 0);
              return window.length > 0 ? window.reduce((a, b) => a + b, 0) / window.length : 0;
            });
            overlayLabel = t(lang, 'sevenDAvg');
          } else {
            overlayPts = solarResult.powerData.map(d => {
              const out = this._engine.calcSolarOutput(d.t, panelConfig, cloudPct, ambientC);
              return out.watts;
            });
            overlayLabel = t(lang, 'west');
          }
          this._charts.drawChart(canvases.solar, [
            { points: actualPts, color: 'rgb(34,197,94)', label: 'W', fill: true },
            { points: overlayPts, color: 'rgb(249,115,22)', label: overlayLabel, fill: false },
          ], { minY: 0, xLabel: solarResult.timeXLabel(solarResult.powerData), yFormat: v => Math.round(v) + ' W' }, true);
          const overlayLabelEl = root.getElementById('solarOverlayLabel');
          if (overlayLabelEl) overlayLabelEl.textContent = '\u25A0 ' + (is30D ? t(lang, 'sevenDAvg') : t(lang, 'estimated'));
        } else {
          this._charts.drawChart(canvases.solar, [
            { points: actualPts, color: 'rgb(34,197,94)', label: 'W', fill: true },
          ], { minY: 0, xLabel: solarResult.timeXLabel(solarResult.powerData), yFormat: v => Math.round(v) + ' W' }, true);
        }
        this._charts.attachCrosshair(canvases.solar);
      } else {
        this._charts.showPlaceholder(canvases.solar, solarResult?.powerData === null ? 'Fetch error' : 'No data available');
      }
    }

    // Update chart value displays consistently
    const snap = {
      power:       this._bridge.getVal(E.POWER),
      chgPower:    this._bridge.getVal(E.CHG_POWER),
      dischgPower: this._bridge.getVal(E.DISCHG_POWER),
      soc:         this._bridge.getVal(E.SOC),
    };
    this._updateChartValues(snap);

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
    const lang = this._bridge._hass?.language || 'en';
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
    this._calcTodayInOut().catch(() => {});
    this._updateCellBalance();
    this._updateWeather();
    this._updateSolarEstimate();
    this._updateSolarUI();

    // Dispatch all system entities
    const systemEntities = [E.TEMP1, E.TEMP2, E.MOSFET_TEMP, E.CYCLES, E.RUNTIME, E.THROUGHPUT,
      E.MIN_CELL_V, E.MAX_CELL_V, E.FIRMWARE, E.MANUFACTURER, E.BAL_SWITCH, E.CHG_SWITCH, E.DISCHG_SWITCH,
      E.STRINGS, E.REMAINING, E.GRID_SWITCH, E.ABSORPTION_SWITCH, E.GRID_CONNECT_SOC, E.GRID_DISCONNECT_SOC,
      this._bridge._gridEntityIds?.ABSORPTION_STATUS?.entityId].filter(Boolean);
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
