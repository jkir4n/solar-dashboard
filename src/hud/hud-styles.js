export const HUD_STYLES = `
:host {
  display: block;
  min-width: 300px;
  height: var(--solar-dashboard-height, 100dvh);
  min-height: 720px;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif;
  font-feature-settings: "tnum" 1, "cv02" 1, "cv03" 1, "cv04" 1;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

:host([panel]), .dashboard-root.panel-mode {
  height: 100dvh !important;
  min-height: 100dvh !important;
}

.dashboard-root {
  --text: #29433f;
  --text2: #74847d;
  --text3: #8b9890;
  --glass-bg: rgba(255, 255, 249, .93);
  --glass-border: #d9e1d7;
  --green: #4d886c;
  --green-glow: rgba(77, 136, 108, .25);
  --green-bg: rgba(77, 136, 108, .12);
  --orange: #b88a3c;
  --orange-glow: rgba(184, 138, 60, .25);
  --orange-bg: rgba(184, 138, 60, .12);
  --red: #ac5550;
  --red-glow: rgba(172, 85, 80, .25);
  --red-bg: rgba(172, 85, 80, .12);
  --blue: #687da1;
  --cyan: #5e8790;
  --flow-solar: #af8539;
  --flow-battery: #548a75;
  --flow-grid: #7582a2;
  --bg: #eff2eb;
  --crosshair-color: #455f59;
  --dot-outline-color: #fcfcf6;
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 720px;
  width: 100%;
  overflow: hidden;
  background: radial-gradient(ellipse at 40% 45%, #fffdf4, #e9eee8);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.dashboard-root[data-theme="dark"] {
  --text: #e2e9e4;
  --text2: #a1b1ad;
  --text3: #8ba09a;
  --glass-bg: rgba(26, 43, 50, .94);
  --glass-border: #364a50;
  --green: #8cb89a;
  --green-glow: rgba(140, 184, 154, .25);
  --green-bg: rgba(140, 184, 154, .12);
  --orange: #d2b26e;
  --orange-glow: rgba(210, 178, 110, .25);
  --orange-bg: rgba(210, 178, 110, .12);
  --red: #d66860;
  --red-glow: rgba(214, 104, 96, .25);
  --red-bg: rgba(214, 104, 96, .12);
  --blue: #a8b0cf;
  --cyan: #78a6b0;
  --flow-solar: #d2b26e;
  --flow-battery: #8cb89a;
  --flow-grid: #a8b0cf;
  --bg: #162a34;
  --crosshair-color: #b9c9c3;
  --dot-outline-color: #172d35;
  background: radial-gradient(ellipse at 40% 45%, #2b444b, #142630);
}

.dashboard-root button { font: inherit; color: inherit; cursor: pointer; }
.dashboard-root button:focus-visible, .dashboard-root input:focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; }
.dashboard-root [hidden] { display: none !important; }

/* ── Full-Bleed 3D World Stage ── */
.world-container {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
#sceneCanvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  pointer-events: auto;
}
#sceneStatus {
  position: absolute;
  top: 40%;
  left: 20%;
  right: 20%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  font-size: 13px;
  text-align: center;
  z-index: 20;
  pointer-events: auto;
}

/* ── Floating 3D Projected Badges ── */
.world-badges {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 2;
}
.world-badge {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: auto;
  border: 1px solid var(--glass-border);
  border-radius: 9px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(0,0,0,0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.world-badge:hover {
  transform: translate(-50%, -105%) scale(1.04);
  box-shadow: 0 10px 24px rgba(0,0,0,0.18);
}
.world-badge span { font-size: 9px; color: var(--text2); }
.world-badge strong { font-size: 11px; font-weight: 600; }
.world-badge:after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  height: 14px;
  width: 1px;
  background: var(--text3);
}

/* ── Top Command Bar ── */
.command-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 68px;
  padding: 0 30px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  gap: 25px;
  z-index: 5;
}
.solar-brand {
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.solar-brand > span { color: var(--orange); font-size: 30px; }
.connection-status {
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--text2);
  font-size: 11px;
}
.connection-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2s ease-in-out infinite;
}
#clockSlot { margin-left: auto; }
#clock { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px; color: var(--text2); }

/* ── Top Energy Summary Strip ── */
.energy-summary {
  position: absolute;
  left: 28px;
  right: 360px;
  top: 84px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  overflow: hidden;
  z-index: 4;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
}
.energy-metric {
  background: transparent;
  border: 0;
  border-right: 1px solid var(--glass-border);
  padding: 14px 16px;
  text-align: left;
  min-width: 0;
  transition: background 0.2s ease;
}
.energy-metric:last-child { border-right: 0; }
.energy-metric:hover { background: rgba(0,0,0,0.02); }
.energy-metric > span {
  font-size: 11px;
  color: var(--text2);
  display: flex;
  gap: 7px;
  align-items: center;
}
.energy-metric strong {
  display: block;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.8px;
  margin: 6px 0;
  white-space: nowrap;
}
.energy-metric small { font-size: 9px; color: var(--text2); display: block; min-height: 12px; }
.energy-metric.selected { box-shadow: inset 0 -2px var(--orange); }

[class^="dot-"] { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-solar { background: var(--flow-solar); }
.dot-home { background: var(--cyan); }
.dot-battery { background: var(--flow-battery); }
.dot-grid { background: var(--flow-grid); }

/* ── Camera & Mode Navigation Pills ── */
.scene-navigation {
  position: absolute;
  left: 28px;
  bottom: 240px;
  z-index: 4;
  display: flex;
  gap: 4px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 5px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}
.scene-navigation button {
  border: 0;
  background: transparent;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 7px;
  transition: background 0.2s ease;
}
.scene-navigation button:hover { background: rgba(0,0,0,0.04); }
.scene-navigation button.selected, .scene-navigation button[aria-pressed="true"] {
  background: var(--glass-border);
  font-weight: 600;
}

/* ── Right Equipment Inspector Drawer ── */
.equipment-inspector {
  position: absolute;
  right: 24px;
  top: 84px;
  width: 320px;
  max-height: calc(100% - 350px);
  display: none;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  overflow: hidden;
  z-index: 10;
  box-shadow: 0 16px 40px rgba(0,0,0,0.14);
}
.equipment-inspector.open { display: flex; }

.inspector-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 10px;
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text2);
}
#inspectorClose {
  display: block;
  border: 0;
  background: none;
  font-size: 21px;
  cursor: pointer;
  color: var(--text2);
  line-height: 1;
  padding: 0 4px;
}
#inspectorClose:hover { color: var(--text); }

.inspector-panels {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
  padding: 0 18px 14px;
  flex: 1;
}
.inspector-panels .card {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  padding: 0 !important;
  opacity: 1 !important;
  transform: none !important;
  overflow: visible;
}
.inspector-panels h2 { font-size: 19px; letter-spacing: -0.5px; font-weight: 600; margin: 6px 0 14px; }
.more-info {
  border: 0;
  border-top: 1px solid var(--glass-border);
  background: transparent;
  padding: 11px 18px;
  text-align: right;
  color: var(--text2) !important;
  font-size: 11px !important;
  font-weight: 500;
  transition: color 0.2s ease;
}
.more-info:hover { color: var(--text) !important; }

/* ── Environment & Sky Panel ── */
.environment-panel {
  position: absolute;
  right: 24px;
  bottom: 240px;
  width: 320px;
  padding: 16px 18px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.environment-caption { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: var(--text2); margin-bottom: 2px; }
.environment-panel strong { font-size: 15px; font-weight: 600; }
.environment-panel > span { font-size: 10px; color: var(--text2); }

.weather-details { font-size: 11px; max-height: 38vh; overflow-y: auto; margin-top: 6px; }
.weather-details summary { cursor: pointer; color: var(--text2); font-weight: 500; }
.weather-details dl { display: grid; grid-template-columns: 1fr auto; gap: 6px; margin: 8px 0; }
.weather-details dd { margin: 0; font-weight: 600; }
.weather-details p { color: var(--text2); line-height: 1.4; font-size: 9px; margin-bottom: 8px; }
.weather-details button { border: 1px solid var(--glass-border); border-radius: 6px; padding: 6px 10px; background: var(--glass-bg); font-size: 10px; }

/* ── Bottom Analytics Dock ── */
.analytics-dock {
  position: absolute;
  left: 28px;
  right: 24px;
  bottom: 30px;
  height: 196px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 4;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
  transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.analytics-dock.collapsed { height: 42px; }
.analytics-dock.collapsed #analyticsContent { display: none; }
#analyticsToggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 20px;
  border: 0;
  background: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
#analyticsContent { padding: 0 20px 10px; height: calc(100% - 42px); }

#chartsCard {
  opacity: 1 !important;
  transform: none !important;
  box-shadow: none !important;
  border: 0 !important;
  background: none !important;
  padding: 0 !important;
  margin: 0 !important;
  height: 100%;
}
#chartsCard > .section-title { display: none; }

.chart-tabs { display: flex; gap: 4px; margin-bottom: 6px; }
.chart-tab { font-size: 10px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--glass-border); background: transparent; cursor: pointer; }
.chart-tab.active { background: var(--green); color: #fff; border-color: var(--green); font-weight: 600; }
.chart-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; height: calc(100% - 32px); }
.chart-wrap { position: relative; display: flex; flex-direction: column; min-height: 0; }
.chart-wrap canvas { width: 100%; height: 75px !important; min-height: 70px !important; }
.chart-title { font-size: 10px; font-weight: 600; }
.chart-value { font-size: 14px; font-weight: 700; position: absolute; right: 0; top: 0; }

.scene-footer {
  position: absolute;
  bottom: 8px;
  left: 30px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  gap: 15px;
  color: var(--text2);
  font-size: 9px;
  z-index: 3;
  pointer-events: none;
}

/* ── Migrated Inspector Sub-Components ── */
.batt-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-radius: 16px;
  background: var(--glass-border);
  font-size: 10px;
  font-weight: 600;
}
.batt-ring { transform: rotate(-90deg); transform-origin: center; }
.batt-soc { font-size: 38px; font-weight: 800; letter-spacing: -1px; }
.batt-zone-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-top: 14px; }

.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 8px; margin: 12px 0; }
.stat-item { text-align: left; }
.stat-val { font-size: 16px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.stat-label { font-size: 10px; color: var(--text2); margin-top: 1px; }
.stat-divider { height: 1px; background: var(--glass-border); margin: 10px 0; opacity: 0.6; }

.info-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px; }
.inf { text-align: left; }
.inf-v { font-size: 12px; font-weight: 600; }
.inf-k { font-size: 9px; color: var(--text2); margin-top: 1px; }

.weather-hero { display: flex; align-items: center; gap: 10px; padding: 6px 0 10px; border-bottom: 1px solid var(--glass-border); }
.weather-hero-icon { font-size: 28px; line-height: 1; }
.weather-hero-body { flex: 1; min-width: 0; }
.weather-hero-top { display: flex; justify-content: space-between; align-items: baseline; }
.weather-hero-condition { font-size: 12px; font-weight: 600; }
.weather-hero-temp { font-size: 17px; font-weight: 700; }
.weather-hero-sub { display: flex; justify-content: space-between; font-size: 9px; color: var(--text2); margin-top: 2px; }
.weather-hero-source { font-size: 8px; opacity: 0.6; }

.sol-output { font-size: 28px; font-weight: 700; color: var(--orange); }
.sol-perf-chip {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--glass-border);
  margin-left: 6px;
}
.sol-perf-chip.optimal { background: var(--green-bg); color: var(--green); }
.sol-perf-chip.moderate { background: var(--orange-bg); color: var(--orange); }
.sol-perf-chip.low { opacity: 0.6; }

.health-bar { height: 7px; border-radius: 4px; background: var(--glass-border); overflow: hidden; margin: 10px 0; }
.health-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--red), var(--orange), var(--green)); }

.ctrl { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--glass-border); }
.ctrl-name { font-size: 12px; font-weight: 600; }
.ctrl-desc { font-size: 9px; color: var(--text2); line-height: 1.4; }
.ctrl-actions { display: flex; align-items: center; gap: 6px; }
.ctrl-badge { font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: var(--glass-border); }
.ctrl-badge.active { background: var(--green-bg); color: var(--green); }
.ctrl-badge.armed { background: var(--orange-bg); color: var(--orange); }

.toggle { position: relative; width: 40px; height: 22px; cursor: pointer; display: inline-block; }
.toggle input { display: none; }
.slider { position: absolute; inset: 0; background: var(--glass-border); border-radius: 11px; transition: .25s; }
.slider:before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: var(--text); border-radius: 50%; transition: .25s; }
.toggle input:checked + .slider { background: var(--green); }
.toggle input:checked + .slider:before { transform: translateX(18px); background: #fff; }

.ctrl-stepper { display: flex; align-items: center; gap: 4px; }
.step-btn { width: 24px; height: 24px; border-radius: 5px; border: 1px solid var(--glass-border); background: var(--glass-bg); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.step-val { font-size: 11px; font-weight: 700; min-width: 30px; text-align: center; }

.cell-row-item { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 6px; transition: background 0.2s ease; }
.cell-row-item:focus-visible { outline: 2px solid var(--orange); }
.cell-row-item.cell-3d-hover { outline: 2px solid var(--orange) !important; background: rgba(184, 138, 60, .18) !important; border-radius: 6px; }
.cell-id { font-size: 10px; font-weight: 600; color: var(--text2); width: 24px; }
.cell-bar-bg { flex: 1; height: 10px; border-radius: 5px; background: var(--glass-border); overflow: hidden; }
.cell-bar { height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--orange), var(--green)); }
.cell-val { font-size: 11px; font-weight: 700; width: 48px; text-align: right; }
.cell-tag.high { color: var(--red); font-weight: 800; }
.cell-tag.low { color: var(--blue); font-weight: 800; }
.cell-row-item.cell-high .cell-val { color: var(--red); }
.cell-row-item.cell-low .cell-val { color: var(--blue); }

.delta-trend { font-size: 12px; font-weight: 800; margin-left: 4px; }
.delta-trend.closing { color: var(--green); }
.delta-trend.widening { color: var(--red); }

.large-reading { font-size: 32px; font-weight: 700; margin: 16px 0; }
.measurement-note { color: var(--text2); font-size: 10px; }
#gridInfo { gap: 14px; font-size: 13px; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes valFlash { 0% { filter: brightness(1.4); } 100% { filter: brightness(1); } }
.val-flash { animation: valFlash 300ms ease-out; }

/* ── Responsive Tablet Breakpoint (768px – 1199px) ── */
@media (min-width: 768px) and (max-width: 1199px) {
  .energy-summary { right: 330px; left: 20px; }
  .equipment-inspector, .environment-panel { right: 20px; width: 290px; }
  .analytics-dock { left: 20px; right: 20px; }
  .scene-navigation { left: 20px; }
}

/* ── Responsive Mobile Breakpoint (< 768px) ── */
@media (max-width: 767px) {
  :host { height: auto; min-height: 100dvh; }
  .dashboard-root { height: auto; min-height: 100dvh; display: flex; flex-direction: column; overflow: visible; padding-bottom: 14px; }
  .command-header { position: relative; height: 60px; padding: 0 16px; flex-shrink: 0; }
  .solar-brand { font-size: 20px; }
  .energy-summary { position: relative; inset: auto; margin: 12px 14px 0; flex-shrink: 0; }
  .energy-metric { padding: 10px 8px; }
  .energy-metric strong { font-size: 19px; }
  .energy-metric small { display: none; }
  .world-container { position: relative; inset: auto; height: 48dvh; min-height: 300px; width: 100%; flex-shrink: 0; }
  .world-badge { padding: 6px 8px; }
  .world-badge span { display: none; }
  .scene-navigation { position: relative; inset: auto; margin: 10px 14px; overflow-x: auto; align-self: flex-start; max-width: calc(100% - 28px); flex-shrink: 0; }
  .scene-navigation button { font-size: 10px; white-space: nowrap; padding: 7px 10px; }
  .equipment-inspector {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 52dvh;
    border-radius: 18px 18px 0 0;
    display: none;
    z-index: 30;
    box-shadow: 0 -20px 60px rgba(0,0,0,0.3);
  }
  .equipment-inspector.open { display: flex; }
  #inspectorClose { display: block; }
  .environment-panel { position: relative; inset: auto; width: auto; margin: 0 14px 14px; flex-shrink: 0; }
  .analytics-dock { position: relative; inset: auto; margin: 0 14px; height: auto; max-height: 440px; }
  .analytics-dock.collapsed { height: 42px; }
  .chart-grid { grid-template-columns: 1fr !important; }
  .chart-wrap { height: 95px !important; }
  .scene-footer { position: relative; inset: auto; margin: 14px 16px 0; flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-root * { animation: none !important; transition: none !important; }
}
`;
