export const STYLES = `
  :host { display: block; width: 100%; min-height: 100vh; }

  [data-theme="dark"]{
    --bg:var(--primary-background-color, #0A0A0F);
    --glass:rgba(255,255,255,0.06);
    --glass-hover:rgba(255,255,255,0.09);
    --glass-border:rgba(255,255,255,0.12);
    --glass-highlight:rgba(255,255,255,0.15);
    --glass-blur:24px;
    --text:var(--primary-text-color, #F5F5F7);
    --text2:var(--secondary-text-color, rgba(255,255,255,0.55));
    --text3:rgba(255,255,255,0.25);
    --fill-subtle:rgba(255,255,255,0.04);
    --green:var(--success-color, #30D158);--green-glow:rgba(48,209,88,0.25);--green-bg:rgba(48,209,88,0.12);
    --orange:var(--warning-color, #FF9F0A);--orange-glow:rgba(255,159,10,0.25);--orange-bg:rgba(255,159,10,0.12);
    --red:var(--error-color, #FF453A);--red-glow:rgba(255,69,58,0.25);--red-bg:rgba(255,69,58,0.12);
    --blue:var(--info-color, #0A84FF);--blue-glow:rgba(10,132,255,0.25);--blue-bg:rgba(10,132,255,0.12);
    --indigo:#5E5CE6;--teal:#64D2FF;
    --mesh-1:rgba(10,132,255,0.08);--mesh-2:rgba(48,209,88,0.06);
    --mesh-3:rgba(255,159,10,0.05);--mesh-4:rgba(94,92,230,0.07);
    --shadow:0 8px 32px rgba(0,0,0,0.4);--shadow-sm:0 2px 12px rgba(0,0,0,0.3);
    --chart-grid:rgba(255,255,255,0.06);--chart-text:rgba(255,255,255,0.35);
    --icon-fill:var(--primary-text-color, rgba(255,255,255,0.9));
  }
  [data-theme="light"]{
    --bg:var(--primary-background-color, #E8E9EF);
    --glass:rgba(255,255,255,0.82);--glass-hover:rgba(255,255,255,0.92);
    --glass-border:rgba(0,0,0,0.10);--glass-highlight:rgba(0,0,0,0.06);
    --glass-blur:20px;
    --text:var(--primary-text-color, #1D1D1F);--text2:var(--secondary-text-color, rgba(0,0,0,0.62));--text3:rgba(0,0,0,0.35);
    --fill-subtle:rgba(0,0,0,0.05);
    --green:var(--success-color, #1E8C3A);--green-glow:rgba(30,140,58,0.2);--green-bg:rgba(30,140,58,0.1);
    --orange:var(--warning-color, #C47000);--orange-glow:rgba(196,112,0,0.2);--orange-bg:rgba(196,112,0,0.1);
    --red:var(--error-color, #D0281F);--red-glow:rgba(208,40,31,0.2);--red-bg:rgba(208,40,31,0.1);
    --blue:var(--info-color, #0062CC);--blue-glow:rgba(0,98,204,0.15);--blue-bg:rgba(0,98,204,0.08);
    --indigo:#4B48C8;--teal:#3AAFE0;
    --mesh-1:rgba(0,98,204,0.07);--mesh-2:rgba(30,140,58,0.06);
    --mesh-3:rgba(196,112,0,0.05);--mesh-4:rgba(75,72,200,0.07);
    --shadow:0 8px 32px rgba(0,0,0,0.12);--shadow-sm:0 2px 12px rgba(0,0,0,0.08);
    --chart-grid:rgba(0,0,0,0.08);--chart-text:rgba(0,0,0,0.60);
    --icon-fill:var(--primary-text-color, rgba(0,0,0,0.80));
  }

  * { margin:0; padding:0; box-sizing:border-box; }
  :host {
    font-family: Inter, -apple-system, system-ui, sans-serif;
    background: var(--bg); color: var(--text);
    min-height: 100vh; overflow-x: hidden;
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 16px; }
  .card {
    background: var(--glass);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border-radius: 22px;
    border: 1px solid var(--glass-border);
    padding: 24px;
    position: relative; overflow: hidden;
    transition: background 0.3s ease, border-color 0.3s ease;
  }
  .card:hover { background: var(--glass-hover); border-color: var(--glass-highlight); }

  /* Only hide cards when JS is running — prevents invisible dashboard if JS errors */
  .js-ready .card { opacity: 0; transform: translateY(20px); }
  .js-ready .card.revealed { opacity: 1; transform: translateY(0); transition: opacity 500ms ease-out, transform 500ms ease-out; }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%; height: 1px;
    background: linear-gradient(90deg, transparent, var(--glass-highlight), transparent);
  }

  #weatherParticles {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: -2; pointer-events: none;
  }

  /* Mesh gradient — must be on .dashboard-root so it inherits --mesh-1/2/3 vars
     set on that element (CSS vars don't propagate from shadow DOM up to :host::before) */
  .dashboard-root::before {
    content: ''; position: fixed;
    top: 0; left: 0; right: 0; bottom: 0; z-index: -1;
    transition: background 3s ease;
    background:
      radial-gradient(ellipse at 20% 50%, var(--mesh-1) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, var(--mesh-2) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, var(--mesh-3) 0%, transparent 50%);
    animation: meshMove 20s ease-in-out infinite alternate;
  }
  @keyframes meshMove {
    0% { transform: scale(1) translate(0,0); }
    100% { transform: scale(1.1) translate(-2%,3%); }
  }

  /* Grid layout */
  .top-row { display: grid; grid-template-columns: 7fr 5fr; gap: 16px; margin-bottom: 16px; }
  .right-col { display: flex; flex-direction: column; gap: 16px; }
  .chart-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
  .cells-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 768px) {
    /* Medium breakpoint — tablet / small laptop portrait */
    .top-row { grid-template-columns: 1fr 1fr; }
    .chart-row { grid-template-columns: repeat(2, 1fr); }
    .stat-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .container { padding: 12px; }
    .card { padding: 18px; }
    .batt-soc { font-size: 42px !important; }
    .stat-val { font-size: 15px !important; }
    .chart-wrap canvas { height: 190px !important; }
    .section-title { font-size: 15px !important; }
    .header h1 { font-size: 22px !important; }
  }
  @media (max-width: 700px) {
    .top-row, .chart-row, .cells-grid, .bottom-row { grid-template-columns: 1fr; }
    #pack2Card { border-left: none !important; padding-left: 0 !important; border-top: 1px solid var(--glass-border); padding-top: 16px; margin-top: 16px; }
    .container { padding: 10px; }
    .card { padding: 16px; border-radius: 16px; --shimmer-duration: 20s !important; }
    /* Battery hero */
    .batt-soc { font-size: 36px !important; }
    .stat-val { font-size: 14px !important; }
    .stat-label { font-size: 10px !important; }
    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 4px !important; margin-top: 10px !important; }
    .info-row { gap: 4px !important; margin-bottom: 4px !important; }
    .section-title { font-size: 14px !important; margin-bottom: 12px !important; }
    /* Solar panels */
    .sol-output { font-size: 24px !important; }
    #solOutput { font-size: 18px !important; }
    /* Charts */
    .chart-wrap canvas { height: 180px !important; }
    .chart-title { font-size: 12px !important; }
    .chart-value { font-size: 16px !important; }
    /* Cells */
    .cell-id { font-size: 11px !important; }
    .cell-val { font-size: 11px !important; }
    .cell-row-item { padding: 5px 0 !important; }
    .cell-bar-bg { height: 12px !important; }
    /* Controls */
    .ctrl-name { font-size: 13px !important; }
    .ctrl-desc { font-size: 10px !important; }
    .ctrl { padding: 12px 0 !important; }
    /* System */
    .inf-v { font-size: 10px !important; }
    .inf-k { font-size: 8px !important; }
    .inf { padding: 4px 1px !important; }
    /* Power flow */
    .flow-icon { width: 36px !important; height: 36px !important; }
    .flow-label { font-size: 10px !important; }
    /* Header */
    .header { flex-wrap: wrap !important; gap: 4px !important; padding: 8px 0 12px !important; }
    .header h1 { font-size: 20px !important; }
    .header #clock { order: 3; width: 100%; font-size: 11px !important; }
  }
  /* I8: Phone-specific refinements */
  @media (max-width: 500px) {
    .container { padding: 6px !important; }
    .card { padding: 12px !important; border-radius: 12px !important; }
    .section-title { font-size: 13px !important; margin-bottom: 8px !important; }
    .header { padding: 6px 0 8px !important; }
    .header h1 { font-size: 17px !important; }
    .header #clock { font-size: 10px !important; }
    .batt-soc { font-size: 28px !important; }
    .stat-val { font-size: 12px !important; }
    .stat-label { font-size: 9px !important; }
    .stat-grid { gap: 2px !important; }
    .info-row { gap: 2px !important; margin-bottom: 2px !important; }
    .inf-v { font-size: 9px !important; }
    .inf-k { font-size: 7px !important; }
    .inf { padding: 3px 0 !important; }
    .flow-icon { width: 28px !important; height: 28px !important; }
    .flow-label { font-size: 9px !important; }
    .flow-watt { font-size: 11px !important; }
    .chart-wrap canvas { height: 150px !important; }
    .chart-title { font-size: 11px !important; }
    .chart-value { font-size: 14px !important; }
    .chart-tabs { padding: 2px !important; gap: 2px !important; }
    .chart-tab { font-size: 11px !important; padding: 4px 8px !important; }
    .cell-id, .cell-val { font-size: 10px !important; }
    .cell-row-item { padding: 3px 0 !important; }
    .cell-bar-bg { height: 10px !important; }
    .sol-output { font-size: 18px !important; }
    #solOutput { font-size: 14px !important; }
    .ctrl { padding: 8px 0 !important; }
    .ctrl-name { font-size: 12px !important; }
    .ctrl-desc { font-size: 9px !important; }
  }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 0 16px; }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green-glow);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }

  /* Battery Hero */
  .batt-ring { transform: rotate(-90deg); transform-origin: center; transition: stroke-dasharray 800ms ease-in-out, stroke-dashoffset 800ms ease-in-out, stroke 800ms ease-in-out; }
  .batt-soc { font-size: 48px; font-weight: 800; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
  .stat-item { text-align: center; }
  .stat-val { font-size: 18px; font-weight: 700; color: var(--text); }
  .stat-label { font-size: 11px; font-weight: 500; color: var(--text2); margin-top: 2px; }
  .stat-divider { height: 1px; background: var(--glass-border); margin: 12px 0; opacity: 0.5; }

  /* Power Flow */
  .flow { display: flex; align-items: flex-start; justify-content: center; padding: 16px 0 24px; gap: 0; }
  .flow-node { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 56px; }
  .flow-icon { width: 48px; height: 48px; transition: filter 0.6s ease; }
  .flow-icon svg { width: 100%; height: 100%; stroke: var(--icon-fill); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.6s ease; }
  /* Sun: shimmer with twinkling rays */
  .flow-icon.icon-sun-active svg { stroke: var(--orange); }
  .flow-icon.icon-sun-active { filter: drop-shadow(0 0 8px rgba(255,159,10,0.5)); }
  .flow-icon.icon-sun-active svg line { animation: rayTwinkle var(--anim-speed, 1.5s) ease-in-out infinite alternate; transform-origin: 24px 24px; }
  .flow-icon.icon-sun-active svg line:nth-child(2) { animation-delay: 0s; }
  .flow-icon.icon-sun-active svg line:nth-child(3) { animation-delay: 0.2s; }
  .flow-icon.icon-sun-active svg line:nth-child(4) { animation-delay: 0.4s; }
  .flow-icon.icon-sun-active svg line:nth-child(5) { animation-delay: 0.6s; }
  .flow-icon.icon-sun-active svg line:nth-child(6) { animation-delay: 0.15s; }
  .flow-icon.icon-sun-active svg line:nth-child(7) { animation-delay: 0.35s; }
  .flow-icon.icon-sun-active svg line:nth-child(8) { animation-delay: 0.55s; }
  .flow-icon.icon-sun-active svg line:nth-child(9) { animation-delay: 0.75s; }
  .flow-icon.icon-sun-active svg circle { animation: sunPulse var(--anim-speed, 1.5s) ease-in-out infinite alternate; transform-origin: 24px 24px; }
  @keyframes rayTwinkle {
    0% { opacity: 0.4; stroke-width: 1; }
    50% { opacity: 1; stroke-width: 2.5; }
    100% { opacity: 0.5; stroke-width: 1.2; }
  }
  @keyframes sunPulse {
    from { filter: drop-shadow(0 0 4px rgba(255,159,10,0.4)); transform: scale(1); }
    to { filter: drop-shadow(0 0 12px rgba(255,159,10,0.8)); transform: scale(1.08); }
  }
  /* Battery: electric blue crackle when charging */
  .flow-icon.icon-batt-charge svg { stroke: #00F0FF; }
  .flow-icon.icon-batt-charge { animation: battElectric var(--anim-speed, 1.5s) ease-in-out infinite; }
  @keyframes battElectric {
    0% { filter: drop-shadow(0 0 8px rgba(0,240,255,0.5)); transform: translate(0, 0); }
    6% { filter: drop-shadow(0 0 16px rgba(0,240,255,0.8)); transform: translate(-1px, 1px); }
    12% { filter: drop-shadow(0 0 6px rgba(0,240,255,0.4)); transform: translate(1px, -1px); }
    18% { filter: drop-shadow(0 0 14px rgba(0,240,255,0.7)); transform: translate(0, 1px); }
    25% { filter: drop-shadow(0 0 6px rgba(0,240,255,0.35)); transform: translate(-1px, 0); }
    35% { filter: drop-shadow(0 0 10px rgba(0,240,255,0.5)); transform: translate(0, 0); }
    45% { filter: drop-shadow(0 0 7px rgba(0,240,255,0.4)); transform: translate(1px, 1px); }
    52% { filter: drop-shadow(0 0 18px rgba(0,240,255,0.9)); transform: translate(-1px, -1px); }
    58% { filter: drop-shadow(0 0 6px rgba(0,240,255,0.4)); transform: translate(1px, 0); }
    65% { filter: drop-shadow(0 0 12px rgba(0,240,255,0.6)); transform: translate(0, -1px); }
    75% { filter: drop-shadow(0 0 8px rgba(0,240,255,0.5)); transform: translate(0, 1px); }
    82% { filter: drop-shadow(0 0 15px rgba(0,240,255,0.75)); transform: translate(-1px, 0); }
    88% { filter: drop-shadow(0 0 6px rgba(0,240,255,0.35)); transform: translate(1px, -1px); }
    100% { filter: drop-shadow(0 0 8px rgba(0,240,255,0.5)); transform: translate(0, 0); }
  }
  .flow-icon.icon-batt-discharge svg { stroke: var(--red); }
  .flow-icon.icon-batt-discharge { animation: battDrain var(--anim-speed, 1.2s) steps(2, jump-none) infinite; }
  @keyframes battDrain {
    0% { filter: drop-shadow(0 0 6px var(--red-glow)); transform: translate(0, 0); }
    6% { filter: drop-shadow(0 0 16px rgba(255,69,58,0.7)); transform: translate(1px, -1px); }
    12% { filter: drop-shadow(0 0 5px var(--red-glow)); transform: translate(-1px, 1px); }
    20% { filter: drop-shadow(0 0 14px rgba(255,69,58,0.6)); transform: translate(0, -1px); }
    30% { filter: drop-shadow(0 0 6px var(--red-glow)); transform: translate(1px, 0); }
    42% { filter: drop-shadow(0 0 8px var(--red-glow)); transform: translate(0, 1px); }
    52% { filter: drop-shadow(0 0 18px rgba(255,69,58,0.8)); transform: translate(-1px, -1px); }
    60% { filter: drop-shadow(0 0 5px var(--red-glow)); transform: translate(1px, 1px); }
    70% { filter: drop-shadow(0 0 12px rgba(255,69,58,0.5)); transform: translate(0, -1px); }
    82% { filter: drop-shadow(0 0 15px rgba(255,69,58,0.6)); transform: translate(-1px, 0); }
    100% { filter: drop-shadow(0 0 6px var(--red-glow)); transform: translate(0, 0); }
  }
  /* House windows — hidden by default */
  .home-window { fill: transparent; stroke: none; transition: fill 0.6s ease; }
  /* House: consuming from battery — warm amber windows */
  .flow-icon.icon-home-active svg { stroke: var(--orange); }
  .flow-icon.icon-home-active { filter: drop-shadow(0 0 8px rgba(255,159,10,0.4)); }
  .flow-icon.icon-home-active .home-window { fill: #FFAA00; stroke: none; animation: windowGlow var(--anim-speed, 2s) ease-in-out infinite alternate; }
  .flow-icon.icon-home-active .home-window:nth-child(4) { animation-delay: 0.4s; }
  @keyframes windowGlow {
    from { fill: rgba(255,170,0,0.5); filter: drop-shadow(0 0 2px rgba(255,170,0,0.3)); }
    to { fill: rgba(255,200,50,0.9); filter: drop-shadow(0 0 6px rgba(255,170,0,0.6)); }
  }
  /* House: solar powered — green windows */
  .flow-icon.icon-home-idle svg { stroke: var(--green); }
  .flow-icon.icon-home-idle { filter: drop-shadow(0 0 8px rgba(48,209,88,0.4)); }
  .flow-icon.icon-home-idle .home-window { fill: #30D158; stroke: none; animation: windowGlowGreen var(--anim-speed, 2s) ease-in-out infinite alternate; }
  .flow-icon.icon-home-idle .home-window:nth-child(4) { animation-delay: 0.4s; }
  @keyframes windowGlowGreen {
    from { fill: rgba(48,209,88,0.5); filter: drop-shadow(0 0 2px rgba(48,209,88,0.3)); }
    to { fill: rgba(80,230,120,0.9); filter: drop-shadow(0 0 6px rgba(48,209,88,0.6)); }
  }
  /* Dim state */
  .flow-icon.glow-dim { filter: none; box-shadow: none; animation: none; }
  .flow-icon.glow-dim svg { stroke: var(--text3); }
  .flow-label { font-size: 11px; font-weight: 600; color: var(--text2); }
  .flow-line-wrap { flex: 1; min-width: 40px; position: relative; display: flex; align-items: center; padding: 0 4px; margin-top: 22px; }
  .flow-line { width: 100%; height: 3px; border-radius: 2px; background: var(--glass-border); position: relative; overflow: hidden; transition: box-shadow 0.4s ease, background 0.4s ease; }
  .flow-pulse { display: none; }
  .flow-particles { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
  .flow-dot { position: absolute; width: 4px; height: 4px; border-radius: 50%; top: 0; opacity: 0; }
  .flow-line-wrap:not(.flow-idle) .flow-line::after {
    content: ''; position: absolute; top: -2px; left: 0; right: 0; bottom: -2px; border-radius: 4px;
    background: linear-gradient(90deg, transparent 0%, var(--flow-color, #fff) 50%, transparent 100%);
    background-size: 40% 100%; background-repeat: no-repeat;
    animation: lineSweep var(--sweep-speed, 2s) linear infinite;
    opacity: 0.4;
  }
  @keyframes lineSweep { 0% { background-position: -40% 0; } 100% { background-position: 140% 0; } }
  .flow-watt { position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 600; white-space: nowrap; }
  .flow-idle .flow-particles { display: none; }
  .flow-idle .flow-line { opacity: 0.3; }
  .flow-arc-canvas { position: absolute; top: 50%; left: 0; transform: translateY(-50%); width: 100%; height: 20px; pointer-events: none; z-index: 1; }

  .sol-output { font-size: 42px; font-weight: 800; text-shadow: 0 0 24px var(--orange-glow); color: var(--orange); }
  .health-bar { height: 8px; border-radius: 4px; background: var(--glass-border); overflow: hidden; margin: 12px 0; }
  .health-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--red), var(--orange), var(--green)); transition: width 0.5s ease; position: relative; }
  .health-fill::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%; background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%); border-radius: 4px 4px 0 0; }

  .chart-tabs { display: flex; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
  .chart-tab { padding: 6px 12px; border-radius: 10px; background: transparent; border: 1px solid var(--glass-border); color: var(--text2); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap; }
  .chart-tab:hover:not(.active) { color: var(--text); background: var(--glass); }
  .chart-tab.active { background: var(--green); color: #000; border-color: var(--green); box-shadow: 0 0 12px var(--green-glow); }
  .chart-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @media (max-width: 768px) { .chart-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } }
  .chart-wrap canvas { width: 100%; height: 160px; border-radius: 12px; }
  .chart-value-pulse { animation: chartPulse 0.6s ease; }
  @keyframes chartPulse { 0% { opacity: 0.4; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.03); } 100% { opacity: 1; transform: scale(1); } }
  .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .chart-value { font-size: 20px; font-weight: 700; margin-bottom: 8px; }

  .cell-row-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 8px; background: transparent; transition: background 0.8s ease, box-shadow 0.8s ease; }
  .cell-id { font-size: 11px; font-weight: 600; color: var(--text2); width: 28px; transition: color 0.8s ease; }
  .cell-bar-bg { flex: 1; height: 14px; border-radius: 7px; background: var(--glass-border); position: relative; overflow: hidden; }
  .cell-bar { height: 100%; border-radius: 7px; background: linear-gradient(90deg, var(--orange), var(--green)); transition: width 0.5s ease, background 0.8s ease, opacity 0.8s ease; position: relative; }
  .cell-bar::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%; background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%); border-radius: 7px 7px 0 0; }
  .cell-val { font-size: 12px; font-weight: 600; width: 50px; text-align: right; transition: color 0.8s ease; }
  .cell-tag { font-size: 10px; font-weight: 700; margin-left: 2px; }
  .cell-tag.high { color: var(--red); }
  .cell-tag.low { color: var(--blue); }
  .cell-row-item.cell-high { background: rgba(255, 59, 48, 0.12); box-shadow: 0 0 12px rgba(255, 59, 48, 0.15); animation: pulseHigh 2.5s ease-in-out infinite alternate; }
  .cell-row-item.cell-high .cell-id { color: var(--red); }
  .cell-row-item.cell-high .cell-val { color: var(--red); }
  .cell-row-item.cell-low { background: rgba(0, 122, 255, 0.12); box-shadow: 0 0 12px rgba(0, 122, 255, 0.15); animation: pulseLow 2.5s ease-in-out infinite alternate; }
  .cell-row-item.cell-low .cell-id { color: var(--blue); }
  .cell-row-item.cell-low .cell-val { color: var(--blue); }
  @keyframes pulseHigh { from { background: rgba(255, 59, 48, 0.06); box-shadow: 0 0 8px rgba(255, 59, 48, 0.08); } to { background: rgba(255, 59, 48, 0.18); box-shadow: 0 0 16px rgba(255, 59, 48, 0.22); } }
  @keyframes pulseLow { from { background: rgba(0, 122, 255, 0.06); box-shadow: 0 0 8px rgba(0, 122, 255, 0.08); } to { background: rgba(0, 122, 255, 0.18); box-shadow: 0 0 16px rgba(0, 122, 255, 0.22); } }
  /* Balancing animation highlights */
  .cell-row-item.cell-high-balancing { background: rgba(255, 59, 48, 0.2); box-shadow: 0 0 16px rgba(255, 59, 48, 0.3); animation: balPulseSrc 1s ease-in-out infinite alternate; transition: background 0.6s ease, box-shadow 0.6s ease; }
  .cell-row-item.cell-high-balancing .cell-id { color: var(--red); transition: color 0.6s ease; }
  .cell-row-item.cell-high-balancing .cell-val { color: var(--red); transition: color 0.6s ease; }
  .cell-row-item.cell-high-balancing .cell-bar { background: linear-gradient(90deg, var(--red), rgba(255,59,48,0.6)); animation: balDrain 2s ease-in-out infinite alternate; transition: background 0.6s ease, opacity 0.6s ease; }
  .cell-row-item.cell-low-balancing { background: rgba(34, 197, 94, 0.2); box-shadow: 0 0 16px rgba(34, 197, 94, 0.3); animation: balPulseDst 1s ease-in-out infinite alternate; transition: background 0.6s ease, box-shadow 0.6s ease; }
  .cell-row-item.cell-low-balancing .cell-id { color: var(--green); transition: color 0.6s ease; }
  .cell-row-item.cell-low-balancing .cell-val { color: var(--green); transition: color 0.6s ease; }
  .cell-row-item.cell-low-balancing .cell-bar { background: linear-gradient(90deg, var(--green), rgba(34,197,94,0.6)); animation: balFill 2s ease-in-out infinite alternate; transition: background 0.6s ease, opacity 0.6s ease; }
  @keyframes balPulseSrc { from { background: rgba(255, 59, 48, 0.1); box-shadow: 0 0 8px rgba(255, 59, 48, 0.15); } to { background: rgba(255, 59, 48, 0.25); box-shadow: 0 0 20px rgba(255, 59, 48, 0.4); } }
  @keyframes balPulseDst { from { background: rgba(34, 197, 94, 0.1); box-shadow: 0 0 8px rgba(34, 197, 94, 0.15); } to { background: rgba(34, 197, 94, 0.25); box-shadow: 0 0 20px rgba(34, 197, 94, 0.4); } }
  @keyframes balDrain { from { opacity: 1; } to { opacity: 0.6; } }
  @keyframes balFill { from { opacity: 0.6; } to { opacity: 1; } }
  @keyframes balPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
  /* Balancing arrow animation — staggered charge flow */
  .bal-arrow { display: inline-block; animation: balArrowFlow 1.2s ease-in-out infinite; }
  .bal-arrow:nth-child(1) { animation-delay: 0s; }
  .bal-arrow:nth-child(2) { animation-delay: 0.15s; }
  .bal-arrow:nth-child(3) { animation-delay: 0.3s; }
  .bal-arrow:nth-child(4) { animation-delay: 0.45s; }
  .bal-arrow:nth-child(5) { animation-delay: 0.6s; }
  .bal-arrow:nth-child(6) { animation-delay: 0.75s; }
  @keyframes balArrowFlow {
    0%, 100% { opacity: 0.3; transform: translateX(0); }
    50% { opacity: 1; transform: translateX(3px); color: var(--orange); }
  }

  .ctrl { display: flex; justify-content: space-between; align-items: center; padding: 18px 0; border-bottom: 1px solid var(--glass-border); }
  .ctrl:last-child { border-bottom: none; }
  #controlsCard { display: flex; flex-direction: column; justify-content: space-between; }
  .ctrl-name { font-size: 14px; font-weight: 600; }
  .ctrl-desc { font-size: 11px; color: var(--text2); margin-top: 2px; }
  .toggle { position: relative; width: 44px; height: 24px; cursor: pointer; display: inline-block; }
  .toggle input { display: none; }
  .slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--glass-border); border-radius: 12px; transition: 0.3s; }
  .slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: var(--text); border-radius: 50%; transition: 0.3s; }
  .toggle input:checked + .slider { background: var(--green); box-shadow: 0 0 10px var(--green-glow); }
  .toggle input:checked + .slider::before { transform: translateX(20px); background: #fff; }
  .info-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; word-break: break-word; }
  .info-row:last-of-type { margin-bottom: 0; }
  .inf { text-align: center; padding: 8px 4px; }
  .inf-v { font-size: 15px; font-weight: 700; }
  .inf-k { font-size: 10px; font-weight: 500; color: var(--text2); margin-top: 2px; }

  @keyframes valFlash {
    0% { color: #fff; text-shadow: 0 0 8px rgba(255,255,255,0.6); }
    100% { color: inherit; text-shadow: inherit; }
  }
  .val-flash { animation: valFlash 300ms ease-out; }

  @keyframes prismShimmer {
    0%   { background-position: -300% 0; }
    100% { background-position: 300% 0; }
  }
  .card.revealed::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      var(--shimmer-angle, 120deg),
      transparent 0%,
      transparent 35%,
      rgba(255,255,255, var(--shimmer-o, 0.02)) 44%,
      rgba(255,255,255, var(--shimmer-peak, 0.035)) 50%,
      rgba(255,255,255, var(--shimmer-o, 0.02)) 56%,
      transparent 65%,
      transparent 100%
    );
    background-size: 300% 100%;
    animation: prismShimmer var(--shimmer-duration, 10s) ease-in-out infinite;
    animation-delay: var(--shimmer-delay, 0s);
    pointer-events: none;
    border-radius: 22px;
  }
  .card.revealed:nth-child(1)::after { --shimmer-angle: 115deg; --shimmer-o: 0.02;  --shimmer-peak: 0.035; --shimmer-duration: 11s; --shimmer-delay: 0s; }
  .card.revealed:nth-child(2)::after { --shimmer-angle: 140deg; --shimmer-o: 0.018; --shimmer-peak: 0.03;  --shimmer-duration: 14s; --shimmer-delay: -4s; }
  .card.revealed:nth-child(3)::after { --shimmer-angle: 130deg; --shimmer-o: 0.022; --shimmer-peak: 0.038; --shimmer-duration: 12s; --shimmer-delay: -8s; }
  .card.revealed:nth-child(4)::after { --shimmer-angle: 150deg; --shimmer-o: 0.015; --shimmer-peak: 0.028; --shimmer-duration: 15s; --shimmer-delay: -2s; }

  /* Skeleton loading — shimmer overlay on value elements */
  .skeleton .stat-val,
  .skeleton .stat-label,
  .skeleton .inf-v,
  .skeleton .inf-k,
  .skeleton .section-title,
  .skeleton .flow-icon,
  .skeleton .batt-soc,
  .skeleton .batt-ring,
  .skeleton .cell-row-item,
  .skeleton .chart-container,
  .skeleton .health-fill,
  .skeleton .toggle-switch,
  .skeleton .live-dot {
    color: transparent !important;
    background: transparent !important;
    border-color: transparent !important;
    stroke: transparent !important;
    fill: transparent !important;
    box-shadow: none !important;
    filter: none !important;
    position: relative;
  }
  .skeleton .stat-val::after,
  .skeleton .inf-v::after,
  .skeleton .section-title::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    height: 100%; width: 100%;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--glass-border) 25%, rgba(255,255,255,0.08) 50%, var(--glass-border) 75%);
    background-size: 200% 100%;
    animation: skeletonPulse 1.5s ease-in-out infinite;
  }
  .skeleton .stat-label::after,
  .skeleton .inf-k::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    height: 8px; width: 70%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--glass-border) 25%, rgba(255,255,255,0.06) 50%, var(--glass-border) 75%);
    background-size: 200% 100%;
    animation: skeletonPulse 1.5s ease-in-out infinite;
  }
  .skeleton .batt-soc::after {
    width: 60px; height: 24px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 12px;
  }
  .skeleton .batt-ring { opacity: 0.15 !important; }
  .skeleton .flow-icon { opacity: 0.15 !important; }
  .skeleton .live-dot { opacity: 0.3 !important; }
  .skeleton .card { opacity: 1 !important; transform: none !important; }
  .skeleton .card.revealed { opacity: 1 !important; transform: none !important; }

  /* Skeleton fade-out transition — when .skeleton class is removed */
  .dashboard-root {
    transition: none;
  }
  .dashboard-root.skeleton .stat-val::after,
  .dashboard-root.skeleton .inf-v::after,
  .dashboard-root.skeleton .section-title::after,
  .dashboard-root.skeleton .stat-label::after,
  .dashboard-root.skeleton .inf-k::after,
  .dashboard-root.skeleton .batt-soc::after {
    transition: opacity 0.6s ease-out;
    opacity: 1;
  }
  .dashboard-root:not(.skeleton) .stat-val::after,
  .dashboard-root:not(.skeleton) .inf-v::after,
  .dashboard-root:not(.skeleton) .section-title::after,
  .dashboard-root:not(.skeleton) .stat-label::after,
  .dashboard-root:not(.skeleton) .inf-k::after,
  .dashboard-root:not(.skeleton) .batt-soc::after {
    opacity: 0;
    pointer-events: none;
  }

  @keyframes skeletonPulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
