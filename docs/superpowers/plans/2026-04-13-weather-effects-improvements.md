# Weather Effects Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 weather effect improvements to `src/weather-fx.js`: particle bucketing, star colour variance, smooth aurora, hexagonal snowflakes, stratified fog, bokeh aperture blades, lightning screen flash, solar/lunar halo, and rainbow arc.

**Architecture:** All changes isolated to `src/weather-fx.js`. No new files, no changes to other source files. Implement in dependency order — particle bucketing first (all subsequent render tasks benefit), then visual effects in sequence.

**Tech Stack:** HTML5 Canvas 2D API, vanilla JS ES modules, Rollup (`npm run build`)

---

## File Map

| File | Changes |
|------|---------|
| `src/weather-fx.js` | All 9 tasks — constructor properties, `_createParticles`, `_renderOverlay`, `_render`, `_startParticles`, `stop`, `resize` |
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

- [ ] **Step 11: Commit**
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

## Task 3: Smooth Aurora + Vertical Oscillation (8 + 9c)

Replace per-pixel `lineTo` loop with `quadraticCurveTo` across 10 control points. Add bounded vertical oscillation around fixed `yBaseInitial`.

**Files:**
- Modify: `src/weather-fx.js:368-376` (aurora creation), `542-556` (_renderOverlay aurora), `871-887` (_render night aurora)

- [ ] **Step 1: Add `yBaseInitial` to aurora creation** (line ~370 in _createParticles night type)

Replace aurora push with:
```js
const yBase = h * (0.08 + i * 0.07);
particles.push({
  kind: 'aurora', yBase, yBaseInitial: yBase,
  hue: 120 + i * 30,
  amplitude: 15 + Math.random() * 25, freq: 0.002 + Math.random() * 0.002,
  phase: Math.random() * Math.PI * 2, speed: 0.003 + Math.random() * 0.003,
  thickness: 30 + Math.random() * 40, o: 0.06 + Math.random() * 0.04
});
```

- [ ] **Step 2: Replace per-pixel loop in `_renderOverlay`** (lines 542-556)

Replace the entire aurora forEach block (lines 542-556) with:
```js
(this._overlayParticlesByType.aurora || []).forEach((p, bandIndex) => {
  p.phase += p.speed;
  const t = p.phase;
  const yBase = p.yBaseInitial + Math.sin(t * 0.015 + bandIndex * 0.8) * 12;
  const lineWidth = 6 + 4 * Math.sin(t * 0.03 + bandIndex);
  // Build 10 control points
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const x = w * i / 9;
    const y = yBase
      + Math.sin(x * p.freq + t) * p.amplitude
      + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3;
    pts.push({ x, y });
  }
  ctx.globalAlpha = scale * p.o * overlayAurDim;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 1)`;
  ctx.lineWidth = lineWidth;
  ctx.shadowBlur = lineWidth * 1.5;
  ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
  ctx.stroke();
});
```

- [ ] **Step 3: Replace per-pixel loop in `_render` night section** (lines 871-887)

Replace the aurora forEach block (lines 872-887) with the same quadraticCurveTo logic. Use `state._particlesByType.aurora || []` instead of `this._overlayParticlesByType.aurora`, use `auroraDim` instead of `overlayAurDim`, and `state._alpha * p.o * auroraDim` instead of `scale * p.o * overlayAurDim`.

```js
(state._particlesByType.aurora || []).forEach((p, bandIndex) => {
  p.phase += p.speed;
  const t = p.phase;
  const yBase = p.yBaseInitial + Math.sin(t * 0.015 + bandIndex * 0.8) * 12;
  const lineWidth = 6 + 4 * Math.sin(t * 0.03 + bandIndex);
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const x = w * i / 9;
    const y = yBase
      + Math.sin(x * p.freq + t) * p.amplitude
      + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3;
    pts.push({ x, y });
  }
  ctx.globalAlpha = state._alpha * p.o * auroraDim;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 1)`;
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

## Task 7: Lightning Screen Flash + Bolt Cache (1 + 9a)

Replace existing per-bolt low-alpha flicker with a class-level 120ms white screen flash. Cache bolt path at class level so segments persist across particle rebuilds (resize/stop).

**Files:**
- Modify: `src/weather-fx.js:52-76` (constructor — already done in Task 1), `830-861` (lightning render in `_render`), `1055-1059` (end of `_render`)

Note: `_flashAlpha` and `_flashDecay` were already added to the constructor and `stop()` in Task 1.

- [ ] **Step 1: Add `_boltCache` to constructor** (after `_flashDecay` line added in Task 1)

```js
this._boltCache = null;
```

Also add `this._boltCache = null;` to `stop()` alongside the other resets.

- [ ] **Step 2: Modify the bolt-fire trigger to cache bolt and set class-level flash** (lines 853-860)

Replace the entire `if (lp.timer > lp.interval)` block with:
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

- [ ] **Step 3: Remove the existing low-alpha screen fill** (lines 833-840)

The existing code inside `if (lp.flashAlpha > 0)` fills the canvas with very low alpha (0.06-0.12). Remove these lines:
```js
// DELETE these 4 lines:
ctx.globalAlpha = state._alpha * lp.flashAlpha * flicker * (light ? 0.06 : 0.12);
ctx.fillStyle = light ? 'rgba(0,0,0,1)' : '#fff';
ctx.fillRect(0, 0, w, h);
```
Keep the rest of the flicker block (bolt rendering at lines 842-851).

- [ ] **Step 4: Add screen flash overlay at end of `_render`** (before `ctx.globalAlpha = 1` at line 1057)

Insert before `ctx.globalAlpha = 1;`:
```js
// Lightning screen flash overlay
if (state._flashAlpha > 0) {
  ctx.globalAlpha = state._flashAlpha;
  ctx.fillStyle = 'rgba(220,230,255,1)';
  ctx.fillRect(0, 0, w, h);
  state._flashAlpha = Math.max(0, state._flashAlpha - state._flashDecay);
}
```

- [ ] **Step 5: Build**
```bash
npm run build
```

- [ ] **Step 6: Visual verify** — On lightning/storm condition, each bolt strike should produce a clean blue-white flash that fades smoothly over ~120ms. `lightning` condition = slightly brighter (0.45) than `lightning-rainy` (0.35).

- [ ] **Step 7: Commit**
```bash
git add src/weather-fx.js dist/solar-dashboard.js
git commit -m "feat: lightning full-screen flash overlay with 120ms fade"
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

## Final Step: Push

- [ ] **Sync and push**
```bash
git pull --rebase
git push
```

CI will auto-bump the version and create a release. HACS will pick up the new `dist/solar-dashboard.js` automatically.
