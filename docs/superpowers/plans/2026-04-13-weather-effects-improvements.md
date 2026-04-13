# Weather Effects Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 12 weather effect improvements: particle bucketing, star colour variance, smooth aurora with curtain effect, hexagonal snowflakes, stratified fog, bokeh aperture blades, lightning screen flash with branching bolts, solar/lunar halo, rainbow arc, volumetric clouds, continuous cloud-coverage dimming, and wind bearing particle direction.

**Architecture:** Tasks 1–9 are isolated to `src/weather-fx.js`. Tasks 10–12 also touch `src/solar-dashboard.js` (to pass new parameters). Implement in dependency order — particle bucketing first, then visual effects, cloud coverage dimming last (depends on solar-dashboard.js changes).

**Tech Stack:** HTML5 Canvas 2D API, vanilla JS ES modules, Rollup (`npm run build`)

---

## File Map

| File | Changes |
|------|---------|
| `src/weather-fx.js` | Tasks 1–12 — constructor properties, `_createParticles`, `_renderOverlay`, `_render`, `_startParticles`, `stop`, `resize`, `start` signature |
| `src/solar-dashboard.js` | Tasks 11–12 — pass `cloudCoverage` and `windBearing` attributes into `WeatherFX.start()` |
| `dist/solar-dashboard.js` | Rebuilt after every task (`npm run build`) |

---

## Task 1: Particle Type Buckets (Perf 9b)

Eliminate per-frame `.filter()` calls by bucketing particles by `kind` at creation time.

**Files:**
- Modify: `src/weather-fx.js:52-76` (constructor), `148-164` (stop), `167-178` (resize), `132-144` (start overlay), `189-249` (_startParticles), `472-597` (_renderOverlay), `601-1059` (_render)

- [ ] **Step 1: Add bucket properties to constructor** (after line 75, before closing `}`)

```js
this._particlesByType = {};        // keyed by particle.kind
this._overlayParticlesByType = {}; // same for overlay particles
this._flashAlpha = 0;              // reserved for Task 7
this._flashDecay = 0;
this._rainbowFade = 0;             // reserved for Task 9
```

- [ ] **Step 2: Add `_bucketize` helper method** (after `_createParticles`, before `_generateBolt` at line 459)

```js
_bucketize(arr) {
  const b = {};
  for (const p of arr) {
    if (!b[p.kind]) b[p.kind] = [];
    b[p.kind].push(p);
  }
  return b;
}
```

- [ ] **Step 3: Wire buckets in `start()` — overlay particle assignments** (lines 132-142)

After line 134 (`this._overlayParticles = this._createParticles(newOverlayType, this.canvas);`), add:
```js
this._overlayParticlesByType = this._bucketize(this._overlayParticles);
```
After line 139 (`this._overlayParticles = [];`), add:
```js
this._overlayParticlesByType = {};
```

- [ ] **Step 4: Wire buckets in `_startParticles()`** (lines 189-249)

After line 212 (fade-out branch: `state._particles = state._currentType ? state._createParticles(...) : [];`), add:
```js
state._particlesByType = state._currentType ? state._bucketize(state._particles) : {};
```
After line 232 (first-start branch: `state._particles = type ? state._createParticles(type, canvas) : [];`), add:
```js
state._particlesByType = type ? state._bucketize(state._particles) : {};
```

- [ ] **Step 5: Wire buckets in `stop()`** (lines 148-164)

After line 155 (`this._particles = [];`), add: `this._particlesByType = {};`
After line 158 (`this._overlayParticles = [];`), add: `this._overlayParticlesByType = {};`
Also add: `this._flashAlpha = 0; this._rainbowFade = 0;`

- [ ] **Step 6: Wire buckets in `resize()`** (lines 167-178)

After line 173 (`this._particles = this._createParticles(this._currentType, this.canvas);`), add:
```js
this._particlesByType = this._bucketize(this._particles);
```
After line 176 (`this._overlayParticles = this._createParticles(this._overlayType, this.canvas);`), add:
```js
this._overlayParticlesByType = this._bucketize(this._overlayParticles);
```

- [ ] **Step 7: Replace `.filter()`/`.find()` in `_renderOverlay()`** (lines 472-597)

| Old | New |
|-----|-----|
| `this._overlayParticles.filter(p => p.kind === 'ray')` | `this._overlayParticlesByType.ray \|\| []` |
| `this._overlayParticles.filter(p => p.kind === 'mote')` | `this._overlayParticlesByType.mote \|\| []` |
| `this._overlayParticles.forEach(...)` (diffuse, line 517) | `(this._overlayParticlesByType.halo \|\| []).forEach(...)` |
| `this._overlayParticles.filter(p => p.kind === 'aurora')` | `this._overlayParticlesByType.aurora \|\| []` |
| `this._overlayParticles.filter(p => p.kind === 'star')` | `this._overlayParticlesByType.star \|\| []` |
| `this._overlayParticles.find(p => p.kind === 'shootingStar')` | `(this._overlayParticlesByType.shootingStar \|\| [])[0]` |

- [ ] **Step 8: Replace `.filter()`/`.find()` in `_render()`** (lines 601-1059)

| Line | Old | New |
|------|-----|-----|
| 724 | `state._particles.filter(p => p.kind === 'ray')` | `state._particlesByType.ray \|\| []` |
| 742 | `state._particles.filter(p => p.kind === 'mote')` | `state._particlesByType.mote \|\| []` |
| 763 | `state._particles.filter(p => p.kind === 'drop')` (pouring) | `state._particlesByType.drop \|\| []` |
| 776 | `state._particles.filter(p => p.kind === 'ripple')` (pouring) | `state._particlesByType.ripple \|\| []` |
| 799 | `state._particles.filter(p => p.kind === 'drop')` (rainy/storm) | `state._particlesByType.drop \|\| []` |
| 813 | `state._particles.filter(p => p.kind === 'ripple')` (rainy/storm) | `state._particlesByType.ripple \|\| []` |
| 830 | `state._particles.find(p => p.kind === 'lightning')` | `(state._particlesByType.lightning \|\| [])[0]` |
| 872 | `state._particles.filter(p => p.kind === 'aurora')` | `state._particlesByType.aurora \|\| []` |
| 890 | `state._particles.filter(p => p.kind === 'star')` | `state._particlesByType.star \|\| []` |
| 913 | `state._particles.find(p => p.kind === 'shootingStar')` | `(state._particlesByType.shootingStar \|\| [])[0]` |
| 944 | `state._particles.filter(p => p.kind === 'flake')` | `state._particlesByType.flake \|\| []` |
| 955 | `state._particles.filter(p => p.kind === 'bokeh')` | `state._particlesByType.bokeh \|\| []` |
| 977 | `state._particles.forEach(...)` (fog) | `(state._particlesByType.fogBlob \|\| []).forEach(...)` |
| 993 | `state._particles.forEach(...)` (cloudy) | `(state._particlesByType.cloud \|\| []).forEach(...)` |
| 1009 | `state._particles.filter(p => p.kind === 'drop')` (sleet) | `state._particlesByType.drop \|\| []` |
| 1026 | `state._particles.filter(p => p.kind === 'pellet')` | `state._particlesByType.pellet \|\| []` |
| 1039 | `state._particles.filter(p => p.kind === 'ripple')` (sleet) | `state._particlesByType.ripple \|\| []` |

- [ ] **Step 9: Build**
```bash
npm run build
```

- [ ] **Step 10: Visual verify** — Open HA dashboard and cycle through conditions (sunny, rainy, storm, snowy, fog, clear-night). All effects should be unchanged.

- [ ] **Step 11: God rays — track sun position** (bonus addition to this task)

In `_renderOverlay`, the `sunrays` overlay type currently hardcodes the ray origin at `cx = w * 0.85, cy = 0`. Replace with the live sun position:

```js
// OLD:
const cx = w * 0.85, cy = 0;

// NEW — origin tracks the actual sun disc:
const elev = this._sunElevation > 0 ? this._sunElevation : 5;
const cx = w * (this._sunAzimuth / 360);
const cy = Math.max(0, h * (0.8 - elev / 90 * 0.75) - 10);
```

Also in `_createParticles` for `sunny` type, replace the hardcoded ray angles with a fan that radiates outward from the sun position. Rays should spread in all directions from (cx, cy), adapting count and spread with elevation:
```js
// Ray spread adapts with elevation — wide at horizon, tight at zenith
const spread = 0.15 + (90 - elev) / 90 * 0.25; // radians
const rayCount = Math.round(8 + elev / 90 * 12);  // 8 (zenith) → 20 (horizon)
// Replace fixed 5-ray loop with rayCount rays:
for (let i = 0; i < rayCount; i++) {
  particles.push({
    kind: 'ray',
    angle: -Math.PI + (i / rayCount) * Math.PI * 2, // full 360° fan from sun
    width: 0.04 + Math.random() * 0.06,
    o: 0.025 + Math.random() * 0.025,
    phase: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.3
  });
}
```
Note: `elev` and sun position are available at render time via `this._sunElevation` and `this._sunAzimuth`, but `_createParticles` runs at creation time. Store `cx`/`cy` computation in render using live values — ray angles in particles are relative offsets, actual origin is computed each frame.

- [ ] **Step 12: Build**
```bash
npm run build
```

- [ ] **Step 13: Visual verify** — On `sunny` or `partlycloudy` conditions, rays should radiate from the sun disc position rather than top-right corner.

- [ ] **Step 14: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "perf: particle type buckets eliminate per-frame filter calls"
```

---

## Task 2: Star Colour Variance

Assign spectral class colour at star creation time; apply in both overlay and main night render paths.

**Files:**
- Modify: `src/weather-fx.js:358-382` (night particle creation), `560-569` (_renderOverlay stars), `889-911` (_render night stars)

- [ ] **Step 1: Add colour to star creation** (in `_createParticles`, `night` type, line ~360-365)

Replace the star push with:
```js
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
```

- [ ] **Step 2: Apply colour in `_renderOverlay` stars** (line 565)

Replace `ctx.fillStyle = '#fff';` with `ctx.fillStyle = p.color || '#fff';`

Note: the overlay star section has no cross glyph, so only the circle fill needs updating.

- [ ] **Step 3: Apply colour in `_render` night stars** (lines 893-910)

Replace `ctx.fillStyle = '#fff';` (line 894) with `ctx.fillStyle = p.color || '#fff';`
Replace `ctx.strokeStyle = '#fff';` (cross glyph, line ~900, 903) with `ctx.strokeStyle = p.color || '#fff';`

- [ ] **Step 4: Build**
```bash
npm run build
```

- [ ] **Step 5: Visual verify** — Switch to a night condition (clear-night or nighttime partlycloudy). Stars should show a mix of white, pale blue, yellow, orange, and rare red tints.

- [ ] **Step 6: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: star colour variance by spectral class"
```

---

## Task 3: Smooth Aurora + Curtain Effect (8 + 9c)

Replace per-pixel `lineTo` loop with `quadraticCurveTo` across 10 control points. Add vertical oscillation, per-band vertical gradient (curtain fade), red lower fringe, and extended spectral hue palette.

**Files:**
- Modify: `src/weather-fx.js:368-376` (aurora creation), `542-556` (_renderOverlay aurora), `871-887` (_render night aurora)

- [ ] **Step 1: Update aurora creation** (line ~370 in _createParticles night type)

Replace aurora push with extended hue palette and `yBaseInitial`:
```js
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
```

- [ ] **Step 2: Replace per-pixel loop in `_renderOverlay`** (lines 542-556)

Replace the entire aurora forEach block with quadraticCurveTo + vertical curtain gradient:
```js
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
});
```

- [ ] **Step 3: Replace per-pixel loop in `_render` night section** (lines 871-887)

Apply identical logic using `state._particlesByType.aurora || []`, `auroraDim`, and `state._alpha * p.o * auroraDim`:
```js
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
});
```

- [ ] **Step 4: Build**
```bash
npm run build
```

- [ ] **Step 5: Visual verify** — Aurora should appear as smooth flowing curves (no jagged edges) that breathe in width and drift vertically.

- [ ] **Step 6: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: smooth aurora with quadratic curves and vertical oscillation"
```

---

## Task 4: Hexagonal Snowflakes

Replace `ctx.arc` circle fill for flake particles with a 6-arm crystal drawn with `ctx.stroke`.

**Files:**
- Modify: `src/weather-fx.js:384-396` (flake creation), `944-954` (_render snowy flakes)

- [ ] **Step 1: Add `angle` property to flake creation** (line ~387-395)

Add `angle: Math.random() * Math.PI * 2` to the flake push:
```js
particles.push({
  kind: 'flake', x: Math.random() * w, y: Math.random() * h,
  r: (1 + Math.random() * 2) * (0.5 + depth * 0.5),
  vy: (0.2 + Math.random() * 0.4) * (0.4 + depth * 0.6),
  sway: Math.random() * Math.PI * 2, swaySpeed: 0.3 + Math.random() * 0.5,
  swayAmp: (0.3 + depth * 0.7) * (1 - windFactor * 0.7),
  windDrift: windFactor * 2.0 * (0.3 + depth * 0.7),
  o: (0.15 + Math.random() * 0.25) * (0.5 + depth * 0.5),
  angle: Math.random() * Math.PI * 2
});
```

- [ ] **Step 2: Replace circle draw with hexagonal crystal** (lines 944-954)

Replace the flake forEach body. Remove `ctx.fillStyle = flakeColor + p.o + ')'; ctx.beginPath(); ctx.arc(...); ctx.fill();` and replace with:
```js
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
```

- [ ] **Step 3: Build**
```bash
npm run build
```

- [ ] **Step 4: Visual verify** — Snowflakes should appear as rotating 6-arm crystals. Larger flakes should have branch pairs; tiny ones are simple arms.

- [ ] **Step 5: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: hexagonal snowflake geometry with rotating arms"
```

---

## Task 5: Stratified Fog Layers

Replace 12 flat ellipse blobs with 4 stratified layers with per-frame turbulence.

**Files:**
- Modify: `src/weather-fx.js:406-414` (fog creation), `973-987` (_render fog)

- [ ] **Step 1: Replace fog blob creation** (lines 406-414)

Replace the `type === 'fog'` block with:
```js
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
        vx: (layer.speed + (Math.random() - 0.5) * 0.1) * (1 + windFactor * 0.3),
        o: layer.alphaMin + Math.random() * (layer.alphaMax - layer.alphaMin),
        amp: layer.amp
      });
    }
  });
```

- [ ] **Step 2: Replace fog render loop** (lines 973-987)

Replace the fog block with:
```js
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
```

- [ ] **Step 3: Build**
```bash
npm run build
```

- [ ] **Step 4: Visual verify** — Fog should show 4 distinct depth layers drifting at different speeds, with gentle vertical turbulence on each blob.

- [ ] **Step 5: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: stratified fog layers with sine turbulence"
```

---

## Task 6: Bokeh Aperture Blades

Add 6 faint radial lines after each bokeh circle to simulate a hexagonal iris.

**Files:**
- Modify: `src/weather-fx.js:398-405` (bokeh creation), `955-970` (_render bokeh)

- [ ] **Step 1: Add `angle` to bokeh creation** (line ~400-404)

Add `angle: Math.random() * Math.PI / 3` to bokeh push:
```js
particles.push({
  kind: 'bokeh', x: Math.random() * w, y: Math.random() * h,
  r: 10 + Math.random() * 15, vy: 0.1 + Math.random() * 0.2,
  vx: (Math.random() - 0.5) * 0.3 - windFactor * 1.2,
  o: 0.04 + Math.random() * 0.04,
  angle: Math.random() * Math.PI / 3
});
```

- [ ] **Step 2: Add blade lines after bokeh arc fill** (after `ctx.fill()` at ~line 968, before `ctx.shadowBlur = 0`)

Insert after `ctx.fill();`:
```js
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
```

Then keep the existing `ctx.shadowBlur = 0;` (remove the duplicate if needed).

- [ ] **Step 3: Build**
```bash
npm run build
```

- [ ] **Step 4: Visual verify** — Snowy foreground bokeh circles should show 6 faint spokes radiating outward. The effect should be very subtle on small bokeh.

- [ ] **Step 5: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: bokeh hexagonal aperture blade lines"
```

---

## Task 7: Lightning Screen Flash + Branching Bolts + Bolt Cache (1 + 9a)

Replace existing per-bolt low-alpha flicker with a class-level 120ms white screen flash. Add 30% child branch probability to `_generateBolt` — branches are shorter, dimmer, and flicker faster. Cache bolt tree at class level.

**Files:**
- Modify: `src/weather-fx.js:52-76` (constructor — already done in Task 1), `461-468` (_generateBolt), `830-861` (lightning render in `_render`), `1055-1059` (end of `_render`)

Note: `_flashAlpha` and `_flashDecay` were already added to the constructor and `stop()` in Task 1.

- [ ] **Step 1: Add `_boltCache` to constructor**

```js
this._boltCache = null;
```
Also add `this._boltCache = null;` to `stop()`.

- [ ] **Step 2: Change `_generateBolt` to return a branch tree** (lines 461-468)

Replace `_generateBolt` with a version that returns `{points, branches[], baseAlpha, decayMult}`:
```js
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
```

- [ ] **Step 3: Add recursive bolt renderer helper** (after `_generateBolt`)

```js
_drawBolt(ctx, boltTree, alpha) {
  if (!boltTree || !boltTree.points.length) return;
  ctx.globalAlpha = alpha * boltTree.baseAlpha;
  ctx.beginPath();
  boltTree.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
  ctx.stroke();
  for (const branch of boltTree.branches) {
    this._drawBolt(ctx, branch, alpha * 0.6);
  }
}
```

- [ ] **Step 4: Update bolt-fire trigger to use tree and set class-level flash** (lines 853-860)

Replace the `if (lp.timer > lp.interval)` block with:
```js
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
```

- [ ] **Step 5: Update bolt render to use `_drawBolt`** (lines 842-851)

Replace the existing `lp.bolt.forEach(...)` stroke block with:
```js
if (lp.bolt && lp.flashAlpha > 0) {
  ctx.strokeStyle = light ? 'rgba(60,60,120,1)' : '#fff';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = light ? 'rgba(60,60,120,0.6)' : 'rgba(180,180,255,0.8)';
  state._drawBolt(ctx, lp.bolt, state._alpha * lp.flashAlpha * 0.7);
  ctx.shadowBlur = 0;
}
```

- [ ] **Step 6: Remove the existing low-alpha screen fill** (lines 833-840)

Remove these lines from inside `if (lp.flashAlpha > 0)`:
```js
// DELETE:
ctx.globalAlpha = state._alpha * lp.flashAlpha * flicker * (light ? 0.06 : 0.12);
ctx.fillStyle = light ? 'rgba(0,0,0,1)' : '#fff';
ctx.fillRect(0, 0, w, h);
```

- [ ] **Step 7: Add screen flash overlay at end of `_render`** (before `ctx.globalAlpha = 1`)

```js
if (state._flashAlpha > 0) {
  ctx.globalAlpha = state._flashAlpha;
  ctx.fillStyle = 'rgba(220,230,255,1)';
  ctx.fillRect(0, 0, w, h);
  state._flashAlpha = Math.max(0, state._flashAlpha - state._flashDecay);
}
```

- [ ] **Step 8: Build**
```bash
npm run build
```

- [ ] **Step 9: Visual verify** — Lightning should show branching child bolts (dimmer, diverging from main path). Each strike triggers a 120ms blue-white screen flash. `lightning` = 0.45 peak, `lightning-rainy` = 0.35.

- [ ] **Step 10: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: branching lightning bolts with 120ms screen flash"
```

---

## Task 8: Solar / Lunar Halo (22° Ring)

Add a radial gradient ring around the sun disc (daytime clear) and moon disc (nighttime clear).

**Files:**
- Modify: `src/weather-fx.js:617-678` (sun disc block), `680-719` (moon disc block)

**Important:** `cloudDim` is a local `const` computed inside each disc block, not stored on `this`. Both halo blocks derive their own `cloudDim` using the existing formula.

- [ ] **Step 1: Add solar halo after sun disc render** (after line 675, still inside `if (cloudDim > 0)` block)

Insert after the disc `ctx.fill()` at line 674 (before `ctx.globalAlpha = state._alpha;` at 676):
```js
// Solar halo — 22° ring, fades out as clouds increase
const haloStrength = Math.max(0, cloudDim - 0.45) / 0.55;
if (haloStrength > 0 && elev > 5) {
  const haloR = sunR * 2.8;
  const inner = haloR * 0.88, outer = haloR * 1.12;
  const haloGrd = ctx.createRadialGradient(sunX, sunY, inner, sunX, sunY, outer);
  haloGrd.addColorStop(0,   'rgba(255,200,180,0)');
  haloGrd.addColorStop(0.3, `rgba(255,230,220,${(haloStrength * 0.30).toFixed(3)})`);
  haloGrd.addColorStop(0.7, `rgba(230,230,255,${(haloStrength * 0.30).toFixed(3)})`);
  haloGrd.addColorStop(1,   'rgba(200,200,255,0)');
  ctx.globalAlpha = state._alpha;
  ctx.fillStyle = haloGrd;
  ctx.beginPath();
  ctx.arc(sunX, sunY, outer, 0, Math.PI * 2);
  ctx.fill();
}
```

- [ ] **Step 2: Add lunar halo after moon disc render** (after moon `ctx.fill()` at line 714, still inside `if (totalBright > 0 || cloudDim > 0)` block)

Insert after the sharp disc `ctx.fill()` (and its closing `}`) at line 715, before `ctx.globalAlpha = state._alpha;` at 717:
```js
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
```

- [ ] **Step 3: Build**
```bash
npm run build
```

- [ ] **Step 4: Visual verify** — On `sunny` or `clear-night` (or `partlycloudy`), a faint ring should appear around the sun/moon disc. Should be invisible on `cloudy`/`fog`/`rainy`.

- [ ] **Step 5: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: solar and lunar 22-degree halo ring"
```

---

## Task 9: Rainbow Arc

Render a 6-band arc at the antisolar point during daytime rainy/pouring conditions.

**Files:**
- Modify: `src/weather-fx.js:52-76` (constructor — `_rainbowFade` already added in Task 1), `148-164` (stop — already reset in Task 1), `719-721` (after moon disc, before particle type branching)

- [ ] **Step 1: Insert rainbow render block** (after moon disc block ends at line 719, before `if (state._currentType === 'sunny')` at line 721)

Insert a new block between line 719 and 721:
```js
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
```

- [ ] **Step 2: Build**
```bash
npm run build
```

- [ ] **Step 3: Visual verify** — Switch to `rainy` or `pouring` condition in daylight. After ~3 seconds a faint ROYGBV arc should fade in. Its horizontal position should track with the sun azimuth (antisolar point = sun azimuth + 180°). Should be invisible at night or when sun is below 5°.

- [ ] **Step 4: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: rainbow arc for rainy/pouring daytime conditions"
```

---

## Task 10: Volumetric Clouds

Replace 8 flat `ctx.ellipse` cloud blobs with multi-lobe cumulus shapes using radial gradient compositing passes. 2 depth layers with parallax drift for Z-depth buildup.

**Files:**
- Modify: `src/weather-fx.js` — `_createParticles` cloudy type (~lines 415-423), cloudy render block (~lines 989-1002)

- [ ] **Step 1: Replace cloudy particle creation** (lines ~415-423)

Replace the `type === 'cloudy'` block with 2-layer multi-lobe cloud objects:
```js
} else if (type === 'cloudy') {
  // 2 depth layers: far (small, slow) and near (large, fast)
  const LAYERS = [
    { count: 4, scale: 0.65, speed: 0.12, alpha: 0.55, yRange: [0.05, 0.45] },
    { count: 4, scale: 1.0,  speed: 0.22, alpha: 0.80, yRange: [0.10, 0.50] },
  ];
  LAYERS.forEach((layer, li) => {
    for (let ci = 0; ci < layer.count; ci++) {
      const r = (80 + Math.random() * 60) * layer.scale;
      particles.push({
        kind: 'cloud',
        x: Math.random() * w,
        y: h * (layer.yRange[0] + Math.random() * (layer.yRange[1] - layer.yRange[0])),
        r,          // base radius — lobes scale from this
        vx: layer.speed * (0.8 + Math.random() * 0.4),
        alpha: layer.alpha,
        layer: li
      });
    }
  });
```

- [ ] **Step 2: Replace cloudy render block** (lines ~989-1002)

Replace with multi-lobe volumetric rendering:
```js
} else if (state._currentType === 'cloudy') {
  // Lobe offsets relative to cloud center (cumulus silhouette: flat base, bumpy top)
  const LOBES = [
    { dx:  0,     dy:  0,    rs: 1.00 }, // center
    { dx: -0.50,  dy: -0.35, rs: 0.80 }, // left crown
    { dx:  0.50,  dy: -0.35, rs: 0.80 }, // right crown
    { dx:  0,     dy:  0.25, rs: 0.60 }, // base bulge
  ];
  // Sort by layer (far → near) for correct depth order
  const clouds = [...(state._particlesByType.cloud || [])].sort((a, b) => a.layer - b.layer);
  clouds.forEach(p => {
    p.x += p.vx;
    if (p.x > w + p.r * 2) p.x = -p.r * 2;
    const baseAlpha = state._alpha * p.alpha;
    // Pass 1 (lighter): bright lobe fills
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    LOBES.forEach(lobe => {
      const lx = p.x + lobe.dx * p.r, ly = p.y + lobe.dy * p.r, lr = p.r * lobe.rs;
      const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      grd.addColorStop(0,    light ? `rgba(200,200,210,${baseAlpha * 0.6})` : `rgba(255,255,255,${baseAlpha * 0.5})`);
      grd.addColorStop(0.4,  light ? `rgba(190,190,205,${baseAlpha * 0.35})` : `rgba(245,248,255,${baseAlpha * 0.3})`);
      grd.addColorStop(0.75, light ? `rgba(180,185,200,${baseAlpha * 0.10})` : `rgba(200,220,245,${baseAlpha * 0.08})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    // Pass 2 (multiply): shadow interior — darkens overlapping lobe regions
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    LOBES.forEach(lobe => {
      const lx = p.x + lobe.dx * p.r, ly = p.y + lobe.dy * p.r, lr = p.r * lobe.rs * 0.7;
      const sgrd = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      const sd = night ? 0.25 : 0.18;
      sgrd.addColorStop(0,   `rgba(80,100,130,${sd})`);
      sgrd.addColorStop(0.6, `rgba(80,100,130,${sd * 0.3})`);
      sgrd.addColorStop(1,   'rgba(80,100,130,0)');
      ctx.fillStyle = sgrd;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    // Pass 3 (screen): top highlight — sun catches crown
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const hx = p.x - p.r * 0.15, hy = p.y - p.r * 0.25, hr = p.r * 0.3;
    const hgrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    const ha = state._alpha * (night ? 0.04 : 0.12);
    hgrd.addColorStop(0, `rgba(255,255,240,${ha})`);
    hgrd.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = hgrd;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = state._alpha;
```

- [ ] **Step 3: Build**
```bash
npm run build
```

- [ ] **Step 4: Visual verify** — Cloudy condition should show soft volumetric cloud shapes with visible lobe bumps, darker interiors, and a bright crown highlight. Far-layer clouds should appear smaller and lighter than near-layer.

- [ ] **Step 5: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: volumetric multi-lobe cloud rendering"
```

---

## Task 11: Cloud Coverage % Continuous Dimming

Replace discrete `SUN_CLOUD_DIM` / `MOON_CLOUD_DIM` lookup tables with a sigmoid formula derived from `cloud_coverage` attribute (0–100). Pass `cloudCoverage` through from `solar-dashboard.js`.

**Files:**
- Modify: `src/solar-dashboard.js` — `_applyWeatherBackdrop` and `WeatherFX.start()` call — pass `cloudCoverage`
- Modify: `src/weather-fx.js` — `start()` signature, replace lookup table usages with `_calcCloudDim()`

- [ ] **Step 1: Add `_calcCloudDim` to `WeatherFX`** (as a static or instance method, before `start()`)

```js
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
```

- [ ] **Step 2: Add `cloudCoverage` to `start()` signature**

Change:
```js
start(weatherCondition, isNight, theme = 'dark', windSpeed = 0, moonBrightness = 0, moonElevation = -90, moonAzimuth = 180, sunElevation = -90, sunAzimuth = 180)
```
To:
```js
start(weatherCondition, isNight, theme = 'dark', windSpeed = 0, moonBrightness = 0, moonElevation = -90, moonAzimuth = 180, sunElevation = -90, sunAzimuth = 180, cloudCoverage = null)
```
And store: `this._cloudCoverage = cloudCoverage;`  
Add `this._cloudCoverage = null;` to constructor.

- [ ] **Step 3: Replace `SUN_CLOUD_DIM[...]` with `_calcCloudDim()` in `_render()`**

Find every usage of `SUN_CLOUD_DIM[state._weatherCondition]` in the sun disc block (~line 618) and replace with:
```js
const cloudDim = state._calcCloudDim(state._cloudCoverage ?? null, state._weatherCondition);
```

Similarly replace `MOON_CLOUD_DIM[state._weatherCondition]` (~line 682) with:
```js
const cloudDim = state._calcCloudDim(state._cloudCoverage ?? null, state._weatherCondition);
```

The `SUN_CLOUD_DIM` and `MOON_CLOUD_DIM` constants at the top of the file can remain as fallback reference but are no longer used by the disc renders.

- [ ] **Step 4: Pass `cloud_coverage` from `solar-dashboard.js`**

In `src/solar-dashboard.js`, find the `WeatherFX.start()` call inside `_applyWeatherBackdrop` (or wherever the weather condition is applied). Add `cloudCoverage` from the weather entity attributes:

```js
// In _applyWeatherBackdrop or wherever WeatherFX.start() is called:
const cloudCoverage = weatherAttrs.cloud_coverage ?? null; // HA provides 0-100
this._weatherFX.start(
  condition, isNight, theme, windSpeed,
  moonBrightness, moonElevation, moonAzimuth,
  sunElevation, sunAzimuth,
  cloudCoverage   // new param
);
```

- [ ] **Step 5: Build**
```bash
npm run build
```

- [ ] **Step 6: Visual verify** — Sun and moon disc brightness should vary smoothly with `cloud_coverage`. At 77% coverage (current PirateWeather reading) the sky should appear moderately dimmed. Switching between `sunny` and `partlycloudy` should show smooth dimming rather than a discrete jump.

- [ ] **Step 7: Commit**
```bash
git add src/weather-fx.js src/solar-dashboard.js dist/solar-dashboard.js
git commit -m "feat: continuous cloud-coverage dimming via sigmoid formula"
```

---

## Task 12: Wind Bearing for Particle Direction

Use `wind_bearing` (degrees: 0=N wind from north, 90=E) to set actual downwind particle direction instead of always drifting left. Affects rain, snow, fog, and sleet.

**Files:**
- Modify: `src/weather-fx.js` — `start()` signature, `_createParticles`, particle render loops
- Modify: `src/solar-dashboard.js` — pass `windBearing` from weather entity attributes

- [ ] **Step 1: Add `windBearing` to `start()` and constructor**

Add `windBearing = 180` parameter to `start()` (default 180 = wind from north → blows south → particles move down, natural default). Store as `this._windBearing = windBearing;`. Add `this._windBearing = 180;` to constructor.

- [ ] **Step 2: Compute downwind dx/dy in `_createParticles`**

At the top of `_createParticles`, after `windFactor`, add:
```js
// Convert meteorological bearing to downwind canvas direction
// Bearing = direction wind comes FROM; downwind = bearing + 180
const downwindRad = ((this._windBearing + 180) % 360) * Math.PI / 180;
const windDx = Math.sin(downwindRad); // +1 = right, -1 = left
const windDy = Math.cos(downwindRad); // +1 = down (adds to fall speed)
```

- [ ] **Step 3: Apply to rain `drop` particles** (rainy/storm/pouring/sleet creation)

Replace `wind: baseWind + windFactor * (maxWind - baseWind)` with directional components:
```js
windDx: windDx * windFactor * maxWind,  // horizontal drift per frame
// vy (vertical fall speed) stays unchanged — windDy is small at typical bearings
```

Update rain render to use `windDx`: replace `p.x -= p.speed * p.wind` with `p.x += p.speed * p.windDx`.
Update rain stroke angle: replace `ctx.lineTo(p.x + p.len * p.wind, p.y - p.len)` with `ctx.lineTo(p.x + p.len * p.windDx, p.y - p.len)`.

- [ ] **Step 4: Apply to snow `flake` particles**

Replace `windDrift: windFactor * 2.0 * (0.3 + depth * 0.7)` with:
```js
windDrift: windDx * windFactor * 2.0 * (0.3 + depth * 0.7),
```

- [ ] **Step 5: Apply to `fogBlob` particles**

In fog creation, replace `vx: (layer.speed + ...) * (1 + windFactor * 0.3)` with:
```js
vx: (layer.speed * windDx + (Math.random() - 0.5) * 0.1) * (1 + windFactor * 0.3),
```

- [ ] **Step 6: Apply to `pellet` (sleet) particles**

Replace the `vx` component with: `vx: windDx * windFactor * 2.5 * (0.5 + depth * 0.5)`

- [ ] **Step 7: Pass `wind_bearing` from `solar-dashboard.js`**

In the `WeatherFX.start()` call, add:
```js
const windBearing = weatherAttrs.wind_bearing ?? 180;
this._weatherFX.start(...existingParams, cloudCoverage, windBearing);
```
Also update the `start()` signature to add `windBearing` after `cloudCoverage`.

- [ ] **Step 8: Build**
```bash
npm run build
```

- [ ] **Step 9: Visual verify** — With `wind_bearing: 209` (current reading = SSW wind, blowing NNE), rain should streak slightly toward the upper-right. Snow should drift in the same direction. Fog should drift with wind direction.

- [ ] **Step 10: Commit**
```bash
git add src/weather-fx.js src/solar-dashboard.js dist/solar-dashboard.js
git commit -m "feat: wind bearing drives actual particle direction"
```

---

## Final Step: Push

- [ ] **Sync and push**
```bash
git pull --rebase
git push
```

CI will auto-bump the version and create a release. HACS will pick up the new `dist/solar-dashboard.js` automatically.
