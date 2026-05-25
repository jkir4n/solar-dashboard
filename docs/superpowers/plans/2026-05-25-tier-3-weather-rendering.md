# Tier 3 Weather Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 6 Tier 3 weather rendering phases (T3.1–T3.6) as individually-deployable `feat:` commits, upgrading the WeatherFX canvas system with forecast-aware rendering, fog improvements, moon phase accuracy, rainbow enhancement, aurora enhancement, and atmospheric cloud perspective.

**Architecture:** Six sequential phases on a single file (`src/weather-fx.js`) plus targeted changes to `src/solar-dashboard.js` (T3.1, T3.3) and `src/solar-engine.js` (T3.3). Each phase is self-contained and ships as one commit. T3.1 must precede others (it wires forecast-blended values into WeatherFX); remaining phases have no inter-dependencies and can be skipped independently.

**Tech Stack:** Vanilla JS ES2020, Canvas 2D API, Simplex FBM noise (`src/noise.js`, `snFBM(x, y, octaves)`), Meeus astronomical algorithms, Rollup bundler (`npm run build`).

---

## Key Source Facts (from code research)

### `start()` signature — `src/weather-fx.js` line 559
```javascript
start(weatherCondition, isNight, theme = 'dark', windSpeed = 0, moonBrightness = 0,
  moonElevation = -90, moonAzimuth = 180, sunElevation = -90, sunAzimuth = 180,
  cloudCoverage = null, windBearing = 180, visibility = null, precipIntensity = null,
  thunderstormProb = null, heatIndex = null, windChill = null, uvIndex = null,
  humidity = null, temperature = null, precipProbability = null,
  windGustSpeed = 0, dewPoint = null, pressure = null)
```

### `updateDynamic()` signature — line 521
```javascript
updateDynamic(cloudCoverage, windBearing, sunElevation, sunAzimuth, moonElevation,
  moonAzimuth, moonBrightness, visibility = null, precipIntensity = null,
  thunderstormProb = null, heatIndex = null, windChill = null,
  precipProbability = null, windGustSpeed = undefined, dewPoint = undefined,
  pressure = undefined)
```

### Current `start()` call site — `src/solar-dashboard.js` line 2726
```javascript
this._weatherFx.start(condition, isNight, theme,
  effWind, moonBrightness, moonElevation, moonAzimuth, sunElevation, sunAzimuth,
  effCloud, effBearing, effVis, effPI, effTS, effHI, effWC,
  effUV, effHum, effTemp, effPP, effGust, effDew, effPressure);
```

### Current `updateDynamic()` call site — line 2729
```javascript
this._weatherFx.updateDynamic(effCloud, effBearing, sunElevation, sunAzimuth,
  moonElevation, moonAzimuth, moonBrightness, effVis, effPI, effTS, effHI, effWC,
  effPP, effGust, effDew, effPressure);
```

### `_effective` fields — assembled in `_assembleEffective()` at line 3063
Fields: `cloud_coverage`, `temperature`, `apparent_temperature`, `dew_point`, `humidity`, `uv_index`, `pressure`, `wind_speed`, `wind_gust_speed`, `wind_bearing`, `visibility`, `precipitation_intensity` (current-only), `precipitation_probability`, `thunderstorm_probability` (current-only), `heat_index`, `wind_chill`, `twilightFactor`

**Not in `_effective`:** `moon_illumination` (added by T3.3)

### `MOON_PHASE_BRIGHTNESS` — line 625
```javascript
const MOON_PHASE_BRIGHTNESS = {
  'new_moon': 0.0, 'waxing_crescent': 0.15, 'first_quarter': 0.4,
  'waxing_gibbous': 0.7, 'full_moon': 1.0, 'waning_gibbous': 0.7,
  'last_quarter': 0.4, 'waning_crescent': 0.15,
};
```
Used at lines 2678 and 3153 to populate `moonBrightness`.

### `getMoonPosition()` — `src/solar-engine.js` line 134
Meeus Ch.47 pattern: computes `JD`, `T`, fundamental arguments `L0, M, Ms, F, D`, perturbation sums `dL` and `dB`, ecliptic → equatorial → horizontal conversion. Returns `{ elevation, azimuth }`.

### Current moon disc render — `src/weather-fx.js` ~line 1903
Gate: `state._moonElevCur > -2`. Disc rendered when `cloudDim >= 0.35`. Glow always rendered when moon is up. Currently a uniform circle (no phase clipping).

### Current aurora render — `src/weather-fx.js` lines 1596–1650
Loop over `this._overlayParticlesByType.aurora` (4 bands). Each band: single sine wave (`Math.sin(x * p.freq + t)`), second harmonic at `Math.sin(x * p.freq * 2.3 + t * 1.7) * 0.3` already present in y-position. Gradient: transparent top → core hue → cool/warm fringe at bottom (hsl). No vertical rays. No nitrogen emission pass.

### Fog spawn — `src/weather-fx.js` lines 1137–1163
`FOG_LAYERS` (4 layers, yBase: 0.75/0.55/0.38/0.22). Gate: condition string `type === 'fog'` only. Uniform random `x: Math.random() * w`. No visibility check.

### Rainbow — `src/weather-fx.js` lines 2065–2096
`_rainbowFade` property (line 167, initialised 0). Gate: `isRainyCond && !night && state._sunElevCur > 5`. 6 spectral bands arc. No afterglow. No secondary bow.

### `_renderCloudToOffscreen(p, isNight)` — line 273
Far-layer check: `const isFar = p.layer === 0`. Visibility check: `const lowVis = (this._visibility != null && this._visibility < 10)`. Both variables exist but the blue-shift/alpha code to act on them is the T3.6 addition.

### `_calcCloudDim(cloudCoverage, condition)` — line 493

---

## Task 1: Forecast-Aware Rendering (T3.1)

> Source: spec §T3.1 / `docs/weather-rendering.md` §3.6

**Files:**
- Verify only: `src/solar-dashboard.js` (lines 2699–2730) — `_updateWeather()` call site
- Verify only: `src/weather-fx.js` — celestial render blocks (planets, ISS, Milky Way)

**Background:** Research confirms the `start()` and `updateDynamic()` call sites at lines 2726 and 2729 **already pass `_effective.*` values** (`effWind`, `effCloud`, `effVis`, etc.) via the `eff` variable block. The T3.1 wiring is largely complete from a prior session. This task is a verification and gap-fill pass, not a full implementation.

- [ ] **Step 1: Verify call sites are passing `_effective` values**

  Read lines 2699–2730 of `src/solar-dashboard.js`. Confirm:
  - `effWind = eff?.wind_speed ?? windSpeed` ✓
  - `effCloud = eff?.cloud_coverage ?? cloudCoverage` ✓
  - `effVis = eff?.visibility ?? visibility` ✓
  - `effGust = eff?.wind_gust_speed ?? null` ✓
  - `effDew = eff?.dew_point ?? null` ✓
  - `effPressure = eff?.pressure ?? null` ✓
  - `effTemp = eff?.temperature ?? null` ✓
  - `effHum = eff?.humidity ?? null` ✓
  - `effUV = eff?.uv_index ?? null` ✓
  - `effGust = eff?.wind_gust_speed ?? null` ✓ (`_effective.windGust`)
  - `effPI = eff?.precipitation_intensity ?? null` ✓ (`_effective.precipIntensity`)
  - `effWC = eff?.wind_chill ?? null` ✓ (`_effective.feelsLike` / wind_chill proxy)

  If any of these are missing (passing raw `attrs.*` instead), add the `eff?.` expression following the existing pattern.

- [ ] **Step 2: Verify `moonBrightness` is NOT changed**

  Confirm the `start()` call at line 2726 still passes raw `moonBrightness` (not `_effective.moon_illumination`) — T3.3 will replace this. Do not change it here.

- [ ] **Step 3: Verify celestial objects read `this._cloudCoverage` (forecast-blended after T3.1)**

  In `src/weather-fx.js`, search for planet render block (~line 2021), Milky Way block (~line 1983), and ISS block. Each computes `cloudDim` via `state._calcCloudDim(state._cloudCovCur, state._weatherCondition)`. Since `_cloudCovCur` lerps toward `this._cloudCoverage` (which is set from `effCloud` in `start()`/`updateDynamic()`), these already read the forecast-blended value. No code change needed.

  If any celestial block reads `state._cloudCoverage` directly (not `state._cloudCovCur`), change it to `state._cloudCovCur`.

- [ ] **Step 4: Build**
  ```bash
  npm run build
  ```
  Expected: no errors, `dist/solar-dashboard.js` updated.

- [ ] **Step 5: Verify (visual)**

  Load the dashboard. Open browser devtools console. Run:
  ```javascript
  // Check _effective is populated
  document.querySelector('solar-dashboard')._effective
  ```
  Confirm object has `cloud_coverage`, `visibility`, `wind_speed` with numeric values (not null for all).

  Then: Set HA weather entity to `partlycloudy` with `cloud_coverage: 80` and a forecast showing `cloud_coverage: 20` two hours ahead. Verify stars and planets dim progressively as forecast blending weight increases, without the condition string changing.

- [ ] **Step 6: Commit**
  ```bash
  git add src/solar-dashboard.js src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: wire _effective forecast-blended values to WeatherFX start/updateDynamic"
  ```
  > If Step 1 found no gaps (all `eff.*` already wired), this commit may only touch `dist/solar-dashboard.js` from the build. That is acceptable — the task is to confirm and document the state.

---

## Task 2: Fog Density Gradient + Noise Placement (T3.2)

> Source: spec §T3.2 / `docs/weather-rendering.md` §3.2 + §3.2a

**Files:**
- Modify: `src/weather-fx.js`
  - Fog spawn block A: lines ~1136–1157 (`else if (type === 'fog')` branch) — the primary fog spawn
  - Fog spawn block B: lines ~1357–1380 (`if (type !== 'fog' && this._visibility < 5)` block) — the haze-fog overlay that runs after all condition branches
  - Fog render block: fogBlob render loop in the main render function (~line 2108+)

**Background: Two-block fog architecture**

There are two separate fog-related spawn blocks in `_createParticles()`:

1. **Block A** (`else if (type === 'fog')`, ~line 1136): The primary fog spawn. Runs only when condition is exactly `'fog'`. Uses `FOG_LAYERS` (4 layers). Currently NO visibility gate, NO density calculation, uniform `Math.random() * w` x-placement. **T3.2 changes go here**: add visibility gate + `fogDensity` + noise-driven x-placement.

2. **Block B** (`if (type !== 'fog' && this._visibility != null && this._visibility < 5)`, ~line 1357): The haze-fog overlay. Runs AFTER all condition branches for any non-fog condition when visibility is already < 5km. Uses `FOG_VIS_LAYERS` (not `FOG_LAYERS`). Already has a `fogDensity` value and count-scaling, but uses uniform `Math.random() * w` for x-placement. **T3.2a noise-driven placement also applies here** — both blocks should use noise clustering.

T3.2's visibility gate logic applies only to Block A (Block B already has its own `type !== 'fog'` + `this._visibility < 5` gate). T3.2a noise placement applies to BOTH blocks.

- [ ] **Step 1: Add visibility gate + fogDensity to Block A (`type === 'fog'`)**

  Locate the `else if (type === 'fog')` block at line ~1136 in `src/weather-fx.js`.

  **Before** the `const FOG_LAYERS = [...]` declaration, add the visibility gate and compute `fogDensity`:

  ```javascript
  // BEFORE: no gate — spawns whenever type === 'fog'
  } else if (type === 'fog') {
    const FOG_LAYERS = [
  ```

  ```javascript
  // AFTER: visibility-driven gate and density
  } else if (type === 'fog') {
    // T3.2: Visibility gate — skip fog render if visibility is clear (≥5km) even with fog condition
    // Reads this._visibility directly (raw value from start()/updateDynamic()) — see Architecture note below
    if (this._visibility == null || this._visibility >= 5) return;

    let fogDensity = Math.max(0, Math.min(1, 1 - (this._visibility / 5)));
    // Temperature–dew_point spread: narrow spread → persistent fog
    const _spread = (this._temperature ?? 15) - (this._dewPoint ?? 10);
    const _persistBoost = _spread < 2 ? 1.3 : _spread > 8 ? 0.5 : 1.0;
    fogDensity = Math.max(0, Math.min(1, fogDensity * _persistBoost));
    // Cloud coverage secondary amplifier
    fogDensity *= (0.7 + (this._cloudCoverage ?? 0) / 300);

    const FOG_LAYERS = [
  ```

  Note: `fogDensity` uses `let` (not `const`) because it is reassigned after the initial declaration.

  **Architecture note — `this._visibility` value when condition is `'fog'`:** `_assembleEffective()` computes `_effective.visibility` as `lerp(actual, forecast, w)` (line 3087 of `solar-dashboard.js`) — it is always blended regardless of condition. However, when condition is `'fog'` the blend weight `w` is very low (condition corroboration suppresses it), so in practice `effVis` ≈ raw actual visibility. The hard guard (A8.8) is therefore satisfied by the existing architecture. No separate `_rawVisibility` field is needed.

- [ ] **Step 2: Replace uniform x-placement with noise-driven placement in Block A**

  Inside the `FOG_LAYERS.forEach` loop (Block A), replace `x: Math.random() * w` with noise-clustered placement. The loop currently reads:
  ```javascript
  FOG_LAYERS.forEach((layer, li) => {
    for (let bi = 0; bi < layer.count; bi++) {
      particles.push({
        kind: 'fogBlob',
        x: Math.random() * w,
  ```

  Replace with:
  ```javascript
  // T3.2a: Noise-driven fog placement — fog forms banks, not uniform sheets
  const _noiseSeed = Math.random() * 1000;
  FOG_LAYERS.forEach((layer, li) => {
    for (let bi = 0; bi < layer.count; bi++) {
      const _noiseVal = snFBM(_noiseSeed + bi * 0.3, li * 2.0, 3); // 3 octaves, 1D
      const _noiseX = ((bi / layer.count) + _noiseVal * 0.15) * w;
      const _noiseRx = 90 + 70 * (0.5 + _noiseVal * 0.5);
      const _noiseAlpha = layer.alphaMin + (layer.alphaMax - layer.alphaMin) * (0.5 + _noiseVal * 0.5);
      particles.push({
        kind: 'fogBlob',
        x: _noiseX,
        fogDensity,                                    // carry density for render gradient
  ```

  Complete the particle object with the existing remaining fields (`yBase`, `layer`, `blobIndex`, `rx: _noiseRx`, `ry`, `vx`, `o: _noiseAlpha`, `amp`).

- [ ] **Step 2b: Replace uniform x-placement with noise-driven placement in Block B (`FOG_VIS_LAYERS`)**

  Locate Block B at ~line 1357. The `FOG_VIS_LAYERS.forEach` loop currently also uses `x: Math.random() * w`:
  ```javascript
  FOG_VIS_LAYERS.forEach((layer, li) => {
    for (let bi = 0; bi < layer.count; bi++) {
      particles.push({
        kind: 'fogBlob',
        x: Math.random() * w,
  ```

  Apply the same noise-driven placement (add `_noiseSeed` before the forEach, use `_noiseX` / `_noiseRx` / `_noiseAlpha` identically). Block B does not need a new `fogDensity` variable — it already computes `const fogDensity = Math.max(0.15, 1 - this._visibility / 5)` at the top of its block. Carry `fogDensity` on each particle object the same way as Block A.

- [ ] **Step 3: Add 3-stop vertical density gradient to fog render**

  Find the fogBlob render loop (search for `(state._particlesByType.fogBlob || []).forEach(p => {` — the main render pass, not the overlay pass). This is around line 2108.

  Before the per-blob ellipse fill, insert the vertical gradient pass. The gradient is drawn once per frame behind all blobs:

  ```javascript
  // T3.2: Vertical density gradient — denser at canvas bottom
  if ((state._particlesByType.fogBlob || []).length > 0) {
    const _fd = state._particlesByType.fogBlob[0].fogDensity ?? 0.5;
    const _fogGrad = ctx.createLinearGradient(0, h * 0.4, 0, h);
    _fogGrad.addColorStop(0,   `rgba(200, 210, 220, 0)`);
    _fogGrad.addColorStop(0.5, `rgba(200, 210, 220, ${(_fd * 0.15).toFixed(3)})`);
    _fogGrad.addColorStop(1,   `rgba(200, 210, 220, ${(_fd * 0.35).toFixed(3)})`);
    ctx.save();
    ctx.globalAlpha = state._alpha;
    ctx.fillStyle = _fogGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  ```

  This must be inserted before the `.forEach(p => { ... })` blob loop begins.

  **Step 3b: Per-blob warm/cold colour interpolation (fog colour temperature)**

  After the vertical gradient fill code block above, add the following per-blob warmth computation. This drives a separate RGB lerp on each blob's fill colour — it is NOT the wind-feel tint system:

  ```javascript
  // T3.2: Fog colour temperature — warm at sunrise/sunset, cold in overcast/night
  const _fogWarmth = Math.max(0, Math.sin(state._sunElevCur * Math.PI / 180));
  const _cloudDimFog = state._calcCloudDim(state._cloudCovCur, state._weatherCondition);
  const _fogWarmthEff = _fogWarmth * _cloudDimFog * (state._temperature > 25 ? 1.2 : 1.0);
  // Per-blob colour lerp: warm=(240,220,180) sunrise orange, cold=(180,190,200) grey-blue
  // Store on particle at spawn, use as fill colour in the fogBlob render forEach:
  //   const _r = Math.round(180 + _fogWarmthEff * 60);  // 180→240
  //   const _g = Math.round(190 + _fogWarmthEff * 30);  // 190→220
  //   const _b = Math.round(200 - _fogWarmthEff * 20);  // 200→180
  //   fogBlobColor = `rgba(${_r},${_g},${_b},${p.o * fogAlpha})`;
  ```

  To integrate: inside the `fogBlob` render forEach (after the gradient pass), replace the existing `ctx.fillStyle` line for each blob with:

  ```javascript
  const _r = Math.round(180 + _fogWarmthEff * 60);
  const _g = Math.round(190 + _fogWarmthEff * 30);
  const _b = Math.round(200 - _fogWarmthEff * 20);
  ctx.fillStyle = `rgba(${_r},${_g},${_b},${p.o})`;
  ```

  `_fogWarmthEff` is computed once per frame (above the forEach), then read per-blob. The existing fill colour (typically a fixed rgba string) is replaced by this dynamic warm/cold lerp.

- [ ] **Step 4: Build**
  ```bash
  npm run build
  ```
  Expected: no errors.

- [ ] **Step 5: Verify (visual)**

  Test scenario A — Fog condition: Set HA condition to `fog` with `visibility: 0.8` (km).
  - Canvas bottom should be visibly denser/hazier than canvas top (vertical gradient).
  - Fog blobs should cluster into patches, not appear in a uniform row.
  - Both checks pass when the gradient is visible and blob distribution is irregular.

  Test scenario B — Haze: Set condition to `partlycloudy` with `visibility: 3` (km).
  - Fog blobs should appear (Block B gate: visibility < 5km, condition ≠ 'fog') with noise-clustered placement.
  - Density should be lighter than scenario A.

  Test scenario C — Clear: Set `visibility: 12` (km).
  - No fog blobs from Block A (visibility gate returns early) and no blobs from Block B (Block B's own gate fails: ≥5km).

  Test scenario D — Sunrise with fog: Set sun elevation to 5°.
  - Fog blobs should appear with a warm orange tint driven by `effectiveWarmth` — a per-blob RGB lerp between warm `(240,220,180)` and cold `(180,190,200)`. This is NOT the wind-feel tint system — it is a dedicated fog colour computation from §3.2.

- [ ] **Step 6: Commit**
  ```bash
  git add src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: fog visibility-gate, noise-driven placement, density gradient"
  ```

---

## Task 3: Moon Phase-Accurate Disc (T3.3)

> Source: spec §T3.3 / `docs/weather-rendering.md` §3.3 / `docs/weather-architecture.md` §7.11

**Files:**
- Modify: `src/solar-engine.js` — add `computeMoonPhaseAngle(jde)` after `getMoonPosition()` (line ~195)
- Modify: `src/solar-dashboard.js` — replace `MOON_PHASE_BRIGHTNESS` lookup; add `moon_illumination` to `_effective`
- Modify: `src/weather-fx.js` — canvas clipping for phase shape; cloud gating migration

**Background:** Moon brightness currently comes from `MOON_PHASE_BRIGHTNESS` (line 625) — an 8-state discrete HA sensor lookup, updated at most once per day. This task replaces it with continuous local Meeus Ch.48 computation, adds crescent/gibbous canvas clipping to the disc, and migrates moon cloud gating from condition strings to continuous `cloudDim`.

**Signature changes in this task:** `start()` and `updateDynamic()` each gain one new parameter `moonPhaseAngle = 0` (appended after the existing `pressure` parameter). Update call sites in `solar-dashboard.js` accordingly (Steps 2d, 2e).

### Step 1 — `src/solar-engine.js`: Add `computeMoonPhaseAngle(jde)`

- [ ] **Step 1a: Add method after `getMoonPosition()`**

  In `src/solar-engine.js`, locate `getMoonPosition(date)` at line 134. After its closing `}` (approximately line 195), add:

  ```javascript
  // Moon phase — Meeus Ch.48: elongation → phase angle → illumination fraction
  // Returns { phaseAngle: 0–360°, illumination: 0–1 }
  computeMoonPhaseAngle(date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    const T  = (JD - 2451545.0) / 36525;

    // D = Moon–Sun elongation (Meeus Ch.47, reused from getMoonPosition arguments)
    // L0, M, Ms, F omitted — not needed for elongation-only phase angle calculation
    const D  = toRad((297.8501921 + 445267.1114034 * T) % 360);

    // Geocentric elongation of moon from sun (Meeus Ch.48, eq. 48.2)
    // Simplified: use D (moon–sun elongation) as the phase angle proxy
    // Phase angle i ≈ 180° − D (elongation from sun)
    const elongation = toDeg(D); // D is already the Moon–Sun elongation

    // Phase angle: 0° = new moon, 180° = full moon (Meeus eq. 48.4)
    const phaseAngle = ((elongation % 360) + 360) % 360;   // 0°=new moon, 180°=full moon

    // Illuminated fraction (Meeus eq. 48.1): k = (1 - cos(i)) / 2
    // At 0° (new moon) → illumination=0; at 180° (full moon) → illumination=1
    const illumination = (1 - Math.cos(phaseAngle * Math.PI / 180)) / 2;

    return { phaseAngle, illumination };
  }
  ```

  Note: `phaseAngle` is in degrees. `Math.cos()` requires radians — multiply by `Math.PI / 180` before passing to `Math.cos()`. `D` (the Moon–Sun elongation argument from Ch.47) serves as the elongation directly; the method re-derives it from `T` independently so `computeMoonPhaseAngle` can be called without `getMoonPosition`.

### Step 2 — `src/solar-dashboard.js`: Replace discrete lookup

- [ ] **Step 2a: Update `_assembleEffective()` to add `moon_illumination`**

  In `_assembleEffective()` at line 3063 (`src/solar-dashboard.js`), after the `twilightFactor` field, add:

  ```javascript
  // REPLACE this block in _assembleEffective (around line 3063):
  // (within the this._effective = { ... } object literal)
  twilightFactor: computeTwilightTarget(this._sunElevCur),
  ```

  ```javascript
  // WITH:
  twilightFactor: computeTwilightTarget(this._sunElevCur),
  moon_illumination: (() => {
    if (!this._engine || this._bridge.latitude == null) return 0.5;
    const { illumination } = this._engine.computeMoonPhaseAngle(new Date());
    return illumination;
  })(),
  ```

- [ ] **Step 2b: Replace `MOON_PHASE_BRIGHTNESS` usage in `_applyWeatherBackdrop()`**

  Locate lines 2678–2681 in `src/solar-dashboard.js`:
  ```javascript
  // REPLACE:
  const _mb = moonState ? MOON_PHASE_BRIGHTNESS[moonState.state] : undefined;
  if (_mb !== undefined) this._lastMoonBrightness = _mb;
  const moonBrightness = this._lastMoonBrightness;
  ```

  ```javascript
  // WITH:
  // T3.3: Use continuous Meeus Ch.48 illumination instead of discrete HA sensor lookup
  const _mb = this._effective?.moon_illumination ?? (moonState ? MOON_PHASE_BRIGHTNESS[moonState.state] : undefined);
  if (_mb !== undefined) this._lastMoonBrightness = _mb;
  const moonBrightness = this._lastMoonBrightness ?? 0.5;
  ```

  This retains `MOON_PHASE_BRIGHTNESS` as a fallback when `_effective` is not yet populated (e.g., first render before `_assembleEffective()` has run). Do NOT delete `MOON_PHASE_BRIGHTNESS` — it remains as fallback.

- [ ] **Step 2c: Replace `MOON_PHASE_BRIGHTNESS` usage in `_assembleEffective()` at line 3153**

  Locate:
  ```javascript
  // REPLACE (line ~3153):
  const moonBrightness = moonState ? (MOON_PHASE_BRIGHTNESS[moonState.state] ?? 0.5) : 0.5;
  ```

  ```javascript
  // WITH:
  // T3.3: Continuous illumination from Meeus Ch.48 (falls back to discrete lookup if engine unavailable)
  const moonBrightness = this._effective?.moon_illumination
    ?? (moonState ? (MOON_PHASE_BRIGHTNESS[moonState.state] ?? 0.5) : 0.5);
  ```

- [ ] **Step 2d: Compute `moonPhaseAngle` and pass it to `start()`**

  In `_applyWeatherBackdrop()` (around line 2678, near the existing `moonBrightness` computation), add:

  ```javascript
  // T3.3: Compute continuous phase angle for waxing/waning disc clipping
  const _moonPhaseResult = (this._engine && this._bridge.latitude != null)
    ? this._engine.computeMoonPhaseAngle(new Date())
    : null;
  const moonPhaseAngle = _moonPhaseResult?.phaseAngle ?? 0; // degrees 0–360
  ```

  Then append `moonPhaseAngle` as a new final argument to the `this._weatherFx.start(...)` call at line ~2726:
  ```javascript
  // REPLACE:
  this._weatherFx.start(condition, isNight, theme,
    effWind, moonBrightness, moonElevation, moonAzimuth, sunElevation, sunAzimuth,
    effCloud, effBearing, effVis, effPI, effTS, effHI, effWC,
    effUV, effHum, effTemp, effPP, effGust, effDew, effPressure);
  // WITH:
  this._weatherFx.start(condition, isNight, theme,
    effWind, moonBrightness, moonElevation, moonAzimuth, sunElevation, sunAzimuth,
    effCloud, effBearing, effVis, effPI, effTS, effHI, effWC,
    effUV, effHum, effTemp, effPP, effGust, effDew, effPressure, moonPhaseAngle);
  ```

- [ ] **Step 2e: Pass `moonPhaseAngle` to `updateDynamic()`**

  Similarly append `moonPhaseAngle` to the `this._weatherFx.updateDynamic(...)` call at line ~2729:
  ```javascript
  // REPLACE:
  this._weatherFx.updateDynamic(effCloud, effBearing, sunElevation, sunAzimuth,
    moonElevation, moonAzimuth, moonBrightness, effVis, effPI, effTS, effHI, effWC,
    effPP, effGust, effDew, effPressure);
  // WITH:
  this._weatherFx.updateDynamic(effCloud, effBearing, sunElevation, sunAzimuth,
    moonElevation, moonAzimuth, moonBrightness, effVis, effPI, effTS, effHI, effWC,
    effPP, effGust, effDew, effPressure, moonPhaseAngle);
  ```

### Step 3 — `src/weather-fx.js`: Canvas clipping + cloud gating migration + signature update

- [ ] **Step 3a-sig: Add `moonPhaseAngle` parameter to `start()` and `updateDynamic()`**

  In `src/weather-fx.js`, add `moonPhaseAngle = 0` as the last parameter to both `start()` (line ~559) and `updateDynamic()` (line ~521). Store it in both methods:
  ```javascript
  this._moonPhaseAngle = moonPhaseAngle; // degrees 0–360; 0=new, 90=first-quarter, 180=full, 270=last-quarter
  ```

- [ ] **Step 3a: Add canvas clipping for phase shape in moon disc render**

  In `src/weather-fx.js`, locate the moon disc render at line ~1936 (inside `if (cloudDim >= 0.35)` block). Currently:
  ```javascript
  // REPLACE the disc fill block (inside if (cloudDim >= 0.35)):
  ctx.fillStyle = discGrd;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  ```

  > **Intentional divergence from source spec:** Both source docs specify a single offset-circle formula
  > (`phaseOffset = moonR * cos(θ)`). That formula is geometrically incorrect — at 90° the shadow is
  > centred, erasing the entire disc; at 180° ~40% of the disc remains dark. The two-step algorithm
  > (semi-circle clip + terminator ellipse) is mathematically correct and replaces it without changing
  > the visible intent of the spec.

  ```javascript
  // Why two steps? The naive offset-circle formula phaseOffset = moonR * cos(θ) is geometrically
  // wrong: at new moon it leaves ~40% of disc visible; at first quarter it erases everything.
  // Correct approach: always erase the dark semicircle, then adjust with a terminator ellipse.
  // Waxing (0–180°): erases LEFT semicircle → RIGHT side lit (correct: waxing crescent lights the right)
  // Waning (180–360°): erases RIGHT semicircle → LEFT side lit (correct: waning crescent lights the left)

  // T3.3: Correct moon phase shape — two-step: semi-circle + terminator ellipse
  const θ = state._moonPhaseAngle * Math.PI / 180; // phaseAngle: 0°=new, 180°=full
  const k = (1 - Math.cos(θ)) / 2;                 // illumination: 0 at new, 1 at full
  const isWaxing = state._moonPhaseAngle <= 180;

  ctx.save();
  // Clip everything to the moon disc boundary
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.clip();

  // Fill the lit disc
  ctx.fillStyle = discGrd;
  ctx.fillRect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);

  // Step 1: erase the dark semicircle (always exactly half the disc)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  if (isWaxing) {
    // Waxing: dark side is left — erase left semicircle
    ctx.arc(moonX, moonY, moonR, Math.PI / 2, -Math.PI / 2, false);
  } else {
    // Waning: dark side is right — erase right semicircle
    ctx.arc(moonX, moonY, moonR, -Math.PI / 2, Math.PI / 2, false);
  }
  ctx.lineTo(moonX, moonY);
  ctx.fill();

  // Step 2: terminator ellipse — crescent erases more, gibbous restores
  const ellipseRx = Math.abs(moonR * Math.cos(θ)); // 0 at quarters, moonR at new/full
  if (ellipseRx > 0.5) { // skip when negligible (near quarter phase)
    ctx.beginPath();
    ctx.ellipse(moonX, moonY, ellipseRx, moonR, 0, 0, Math.PI * 2);
    if (k < 0.5) {
      ctx.fill(); // crescent: erase more from lit side (destination-out still active)
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = discGrd;
      ctx.fill(); // gibbous: restore lit area on dark side
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  ```

- [ ] **Step 3b: Migrate cloud gating from condition strings to continuous `cloudDim`**

  Locate the moon disc render entry at line ~1903:
  ```javascript
  // REPLACE the outer gate:
  if (state._moonElevCur > -2) {
    const moonHorizonFade = Math.max(0, Math.min(1, state._moonElevCur / 5));
    const skyWash = 0.9 * Math.max(0, Math.sin(state._sunElevCur * Math.PI / 180));
    const mb = state._moonBrightCur * moonHorizonFade * (1 - skyWash);
    const totalBright = mb * cloudDim;
    if (totalBright > 0 || cloudDim > 0) {
  ```

  ```javascript
  // WITH: continuous cloudDim gating (same sigmoid as sun disc)
  if (state._moonElevCur > -2) {
    const moonHorizonFade = Math.max(0, Math.min(1, state._moonElevCur / 5));
    const skyWash = 0.9 * Math.max(0, Math.sin(state._sunElevCur * Math.PI / 180));
    const mb = state._moonBrightCur * moonHorizonFade * (1 - skyWash);
    const moonAlpha = mb * cloudDim;
    if (moonAlpha < 0.01) {
      // Hidden — moon effectively invisible; skip render
    } else {
  ```

  Then inside the disc render gate, change `if (cloudDim >= 0.35)` to use the new thresholds:
  ```javascript
  // REPLACE:
  if (cloudDim >= 0.35) {
  ```
  ```javascript
  // WITH:
  if (cloudDim > 0.35) {  // clear to partly-cloudy: full disc with phase clipping
  ```

  And for diffuse glow: the glow was already always drawn when moon is up. Now gate it:
  ```javascript
  // Diffuse glow: drawn when cloudDim > 0.10 (even cloudy/fog lets some moonlight through)
  if (cloudDim > 0.10) {
    // ... existing glow render code ...
  }
  // else: cloudDim <= 0.10 → hidden (heavy rain/storm)
  ```

- [ ] **Step 4: Build**
  ```bash
  npm run build
  ```
  Expected: no errors.

- [ ] **Step 5: Verify (visual)**

  Test A — Waxing crescent: Verify `computeMoonPhaseAngle()` returns illumination ~0.15. Moon disc should show a thin crescent shape (right-side lit).

  Test B — Full moon: Illumination should be ~1.0. Disc should render as a full circle (no clipping shadow).

  Test C — Overcast condition: Set `cloud_coverage: 90`. Disc should disappear (cloudDim < 0.35), only diffuse glow visible.

  Test D — Heavy storm: Set condition to `lightning`. Glow should disappear entirely (cloudDim < 0.10).

  Test E — Console check:
  ```javascript
  document.querySelector('solar-dashboard')._engine.computeMoonPhaseAngle(new Date())
  // Should return { phaseAngle: Number, illumination: Number between 0 and 1 }
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add src/solar-engine.js src/solar-dashboard.js src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: moon phase-accurate disc via Meeus Ch.48, continuous cloud gating"
  ```

---

## Task 4: Rainbow Enhancement (T3.4)

> Source: spec §T3.4 / `docs/weather-rendering.md` §3.4

**Files:**
- Modify: `src/weather-fx.js`
  - Constructor: add `_rainbowAfterglow` property (~line 167)
  - Rainbow render block: lines ~2065–2096

**Background:** The existing rainbow at lines 2065–2096 uses `_rainbowFade` (fades in over 3s, fades out quickly at `0.05/frame` when rain stops). It disappears immediately after rain stops. This task adds a 30–60 second post-rain afterglow and a faint secondary bow.

- [ ] **Step 1: Add `_rainbowAfterglow` property to constructor**

  Locate the constructor initialisation at line ~167 in `src/weather-fx.js`:
  ```javascript
  // Near this line:
  this._rainbowFade = 0;             // reserved for Task 9
  ```

  ```javascript
  // ADD after _rainbowFade:
  this._rainbowAfterglow = 0;        // T3.4: post-rain persistence, decays ~0.000417/frame (40s at 60fps)
  ```

  Also add the reset in the `start()` method's reset block (search for `this._rainbowFade = 0` in the `start()` body, ~line 679):
  ```javascript
  // ADD alongside:
  this._rainbowAfterglow = 0;
  ```

- [ ] **Step 2: Replace rainbow render block with afterglow + secondary bow**

  Locate the rainbow render at line ~2065. The current block:
  ```javascript
  // ---- Rainbow arc — rainy/pouring daytime, sun above 5° ----
  const isRainyCond = state._weatherCondition === 'rainy' || state._weatherCondition === 'pouring';
  if (isRainyCond && !night && state._sunElevCur > 5) {
    state._rainbowFade = Math.min(1, state._rainbowFade + 1 / 180); // fade in over ~3s at 60fps
  } else {
    state._rainbowFade = Math.max(0, state._rainbowFade - 0.05);    // fade out quickly
  }
  if (state._rainbowFade > 0 && isRainyCond && !night && state._sunElevCur > 5) {
  ```

  Replace with:
  ```javascript
  // ---- Rainbow arc — rainy/pouring daytime, sun above 5° ----
  const isRainyCond = state._weatherCondition === 'rainy' || state._weatherCondition === 'pouring';
  const cloudDimRainbow = state._calcCloudDim(state._cloudCovCur, state._weatherCondition);
  if (isRainyCond && !night && state._sunElevCur > 5) {
    state._rainbowFade = Math.min(1, state._rainbowFade + 1 / 180); // fade in over ~3s at 60fps
    state._rainbowAfterglow = 1.0;                                   // T3.4: prime afterglow
  } else {
    state._rainbowFade = Math.max(0, state._rainbowFade - 0.05);    // fade out quickly when rain stops
    // T3.4: afterglow persists 30–60s after rain stops (~0.000417/frame at 60fps = ~40s)
    state._rainbowAfterglow = Math.max(0, state._rainbowAfterglow - 0.000417);
  }
  const rainbowVisible = (isRainyCond || state._rainbowAfterglow > 0) && !night && state._sunElevCur > 5;
  if (rainbowVisible) {
    const effectiveAlpha = Math.max(state._rainbowFade, state._rainbowAfterglow);
  ```

  Inside the visible block, update `baseAlpha` to use `effectiveAlpha` and `cloudDimRainbow`:
  ```javascript
  // REPLACE:
  const baseAlpha = (state._weatherCondition === 'pouring' ? 0.28 : 0.22)
    * state._rainbowFade * state._alpha;
  ```
  ```javascript
  // WITH:
  const baseAlpha = (state._weatherCondition === 'pouring' ? 0.28 : 0.22)
    * effectiveAlpha * cloudDimRainbow * state._alpha;
  ```

  After the primary bow `BANDS.forEach(...)` loop and before `ctx.globalAlpha = state._alpha;`, add the secondary bow:

  ```javascript
  // T3.4: Secondary bow — reversed colours, larger radius, 15% of primary alpha
  const secondaryAlpha = baseAlpha * 0.15;  // cloudDim already in baseAlpha — do not apply twice
  if (secondaryAlpha > 0.001) {
    const SEC_BANDS = [
      { r: 100, g:   0, b: 220, am: 0.75, dr: -2.5 }, // violet (innermost of secondary)
      { r:   0, g:  80, b: 255, am: 0.85, dr: -1.0 },
      { r:   0, g: 200, b:  60, am: 0.80, dr:  0.5 },
      { r: 255, g: 230, b:   0, am: 0.85, dr:  2.0 },
      { r: 255, g: 120, b:   0, am: 0.90, dr:  3.5 },
      { r: 255, g:  30, b:   0, am: 1.00, dr:  5.0 }, // red (outermost of secondary)
    ];
    const secRadius = arcRadius * 1.12; // secondary bow is ~12% larger radius
    ctx.lineWidth = 4;
    SEC_BANDS.forEach(band => {
      ctx.globalAlpha = secondaryAlpha * band.am;
      ctx.strokeStyle = `rgb(${band.r},${band.g},${band.b})`;
      ctx.beginPath();
      ctx.arc(arcX, arcCenterY, secRadius + band.dr * 5, Math.PI, 0, true);
      ctx.stroke();
    });
  }
  ```

  Close the `if (rainbowVisible)` block with `ctx.globalAlpha = state._alpha;`.

- [ ] **Step 3: Build**
  ```bash
  npm run build
  ```
  Expected: no errors.

- [ ] **Step 4: Verify (visual)**

  Test A — Primary bow during rain: Set condition to `rainy`, daytime, sun elevation >5°. Rainbow should appear and be modulated by cloud coverage (brighter under thinner cloud cover).

  Test B — Afterglow: Change condition from `rainy` to `cloudy` (rain stops). Rainbow should linger for approximately 30–60 seconds before fading completely.

  Test C — Secondary bow: When primary bow is at alpha >0.1 and cloud coverage is low (<30%), a faint second arc should be visible just outside (and slightly larger than) the primary. Colours reversed (violet on inner side).

  Test D — Cloud modulation: Set `cloud_coverage: 85`. Both primary and secondary should be nearly invisible (blocked by cloud cover).

- [ ] **Step 5: Commit**
  ```bash
  git add src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: rainbow post-rain afterglow and secondary bow"
  ```

---

## Task 5: Aurora Enhancement (T3.5)

> Source: spec §T3.5 / `docs/weather-rendering.md` §3.1

**Files:**
- Modify: `src/weather-fx.js`
  - Aurora spawn: ~line 1044 (aurora particle creation)
  - Aurora render loop: ~lines 1596–1660

**Background:** Current aurora renders 4 sine-wave bands with a vertical curtain gradient (transparent top → core hue → cool fringe bottom). A second harmonic is already present in y-position (`Math.sin(x * p.freq * 2.3 + t * 1.7) * 0.3`). This task adds: (1) vertical ray structure per band with per-ray alpha lerp, (2) a third wave harmonic in the rendering, (3) purple/blue nitrogen emission at band lower edges.

- [ ] **Step 1: Add per-ray state to aurora particle spawn**

  Find the aurora particle spawn at ~line 1044:
  ```javascript
  // Aurora bands — 4 sine waves across top
  const auroraCount = 4;
  for (let i = 0; i < auroraCount; i++) {
    // Extended aurora hue palette: green (dominant), cyan, blue-violet, purple, rare red
    ...
    kind: 'aurora', yBase, yBaseInitial: yBase,
  ```

  In the particle object literal, add ray state fields:
  ```javascript
  // ADD to the aurora particle object:
  _rays: Array.from({ length: 12 }, () => ({
    x: Math.random(),          // 0–1 normalised x position along band
    alphaCur: 0,               // current alpha (lerped)
    alphaTarget: Math.random() > 0.4 ? 0.6 + Math.random() * 0.4 : 0, // target brightness
    phase: Math.random() * Math.PI * 2,  // phase offset for independent flicker
  })),
  ```

- [ ] **Step 2: Add third wave harmonic + ray rendering to aurora render loop**

  Find the aurora render loop at ~line 1599:
  ```javascript
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
  ```

  Replace the y computation to add a third harmonic:
  ```javascript
  // REPLACE the y line within the pts loop:
  const y = yBase
    + Math.sin(x * p.freq + t) * p.amplitude
    + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3;
  ```
  ```javascript
  // WITH (third harmonic added):
  const y = yBase
    + Math.sin(x * p.freq + t) * p.amplitude
    + Math.sin(x * p.freq * 2.3 + t * 1.7) * p.amplitude * 0.3
    + Math.sin(x * p.freq * 0.7 + t * 0.5 + bandIndex) * p.amplitude * 0.15; // T3.5: third harmonic
  ```

  After the existing band stroke (after `ctx.stroke()` for the band path, before the next band), add vertical ray rendering:

  ```javascript
  // T3.5: Vertical curtain rays — per-ray alpha lerp for independent flicker
  if (p._rays) {
    p._rays.forEach((ray, ri) => {
      // Randomly flip target alpha to create flicker
      if (Math.random() < 0.005) {
        ray.alphaTarget = Math.random() > 0.4 ? 0.5 + Math.random() * 0.5 : 0;
      }
      ray.alphaCur += (ray.alphaTarget - ray.alphaCur) * 0.01; // 0.01/frame lerp
      if (ray.alphaCur < 0.02) return;

      const rayX = w * ray.x;
      // Find y at this x from pts (interpolate between nearest control points)
      const ptIdx = Math.min(Math.floor(ray.x * 9), 8);
      const rayY = pts[ptIdx].y;
      const rayHeight = lineWidth * (3 + Math.sin(ray.phase + t * 0.02) * 1.5);

      const rayGrad = ctx.createLinearGradient(rayX, rayY - rayHeight, rayX, rayY + lineWidth * 0.5);
      rayGrad.addColorStop(0, `hsla(${p.hue}, 80%, 70%, 0)`);
      // overlayAurDim and scale are defined in the enclosing aurora render block
      // (outer forEach scope at line ~1599) — available here without redeclaration
      rayGrad.addColorStop(0.5, `hsla(${p.hue}, 90%, 65%, ${(ray.alphaCur * scale * overlayAurDim).toFixed(3)})`);
      rayGrad.addColorStop(1, `hsla(${p.hue}, 80%, 60%, 0)`);

      ctx.fillStyle = rayGrad;
      ctx.fillRect(rayX - 1.5, rayY - rayHeight, 3, rayHeight + lineWidth * 0.5);
    });
  }

  // T3.5: Nitrogen emission — purple/blue tint at band lower edge only
  // The aurora forEach runs INSIDE ctx.save()/ctx.restore() at lines 1597/1640.
  // ctx.restore() at end of forEach undoes any composite set during the band stroke.
  // Therefore the nitrogen pass must manage its own save/restore scope explicitly.
  const nitrogenY = midY + halfW;
  const nitroGrad = ctx.createLinearGradient(0, nitrogenY, 0, nitrogenY + lineWidth);
  nitroGrad.addColorStop(0, `rgba(120, 80, 220, ${(scale * overlayAurDim * 0.3).toFixed(3)})`);
  nitroGrad.addColorStop(1, `rgba(60, 40, 180, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = nitroGrad;
  ctx.fillRect(0, nitrogenY, w, lineWidth);
  ctx.restore();
  ```

  Note: the outer `ctx.save()` at line 1597 sets `globalCompositeOperation = 'lighter'` for the aurora band strokes. The band stroke path does NOT call `ctx.save()`/`ctx.restore()` itself — `ctx.restore()` at line 1640 fires only after the entire forEach completes. Therefore the nitrogen pass is inside the outer `'lighter'` scope, but to be explicit and safe (in case the band render is ever refactored to use per-band save/restore), the nitrogen pass uses its own `ctx.save()`/`ctx.restore()` around the composite change as shown above.

- [ ] **Step 3: Build**
  ```bash
  npm run build
  ```
  Expected: no errors.

- [ ] **Step 4: Verify (visual)**

  Set condition to `clear-night` at a latitude where aurora is rendered (check that `_overlayType === 'night'` and `_overlayParticlesByType.aurora` is populated).

  Test A — Curtain rays: Individual vertical bright streaks should be visible within each aurora band, flickering independently at different rates.

  Test B — Wave complexity: The aurora band undulation should look more organic than a single clean sine wave — small ripples superimposed on the main wave.

  Test C — Nitrogen emission: At the bottom edge of each aurora band, a faint purple/blue fringe should be visible (additive blend over the dark sky).

  Test D — Cloud modulation: Increase `cloud_coverage` to 90%. Aurora should fade to near-invisible (cloudDim < 0.3 threshold).

- [ ] **Step 5: Commit**
  ```bash
  git add src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: aurora curtain rays, multi-frequency waves, nitrogen emission"
  ```

---

## Task 6: Atmospheric Perspective on Far Clouds (T3.6)

> Source: spec §T3.6 / `docs/weather-rendering.md` §3.5

**Files:**
- Modify: `src/weather-fx.js` — `_renderCloudToOffscreen(p, isNight)` at line 273

**Background:** `_renderCloudToOffscreen` already has `const isFar = p.layer === 0` and `const lowVis = (this._visibility != null && this._visibility < 10)` (both present from T2.3). The blue-shift/alpha reduction code to act on `isFar && lowVis` is the T3.6 addition. Applied once at spawn — zero per-frame cost.

- [ ] **Step 1: Add perspective effect to far-cloud offscreen render**

  In `src/weather-fx.js`, locate `_renderCloudToOffscreen` at line 273. Find the existing comment:
  ```javascript
  // T2.3 item 7: atmospheric perspective for far-layer clouds when visibility < 10 km
  const isFar = p.layer === 0;
  const lowVis = (this._visibility != null && this._visibility < 10);
  ```

  Immediately after these two lines, add the perspective computation and application:

  ```javascript
  // T3.6: Apply Rayleigh blue-shift and alpha reduction to far-layer clouds at low visibility
  let perspectiveFactor = 0;
  if (isFar && lowVis) {
    perspectiveFactor = Math.max(0, Math.min(0.6, 1 - (this._visibility / 10)));
    // perspectiveFactor: 0 at ≥10km (no effect), 0.6 at 0km (maximum haze)
  }
  ```

  Then, after the offscreen canvas is created and cleared (after `octx.clearRect(...)`), but **before** the silhouette path and gradient fill, add the blue-shift overlay that will be drawn inside the clip region later. Add a property to carry the factor into the render:

  ```javascript
  // Store on particle for use in gradient colour mixing below
  p._perspectiveFactor = perspectiveFactor;
  ```

  Next, find the vertical gradient fill inside the clip region. The gradient currently uses day/night colour arrays. After `ctx.fillRect()` (the gradient fill step), add:

  ```javascript
  // T3.6: Blue-shift overlay for far clouds at low visibility
  if (perspectiveFactor > 0.01) {
    // Still inside ctx.clip() region
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = perspectiveFactor * 0.3; // blend toward blue
    octx.fillStyle = 'rgba(140, 170, 220, 1)';  // Rayleigh blue
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalCompositeOperation = 'source-over';
    octx.globalAlpha = 1;
  }
  ```

  Also apply alpha reduction at the blit stage. Cloud particles use `p.alpha` (confirmed from code research: line 2646 `const baseAlpha = state._alpha * p.alpha`). The blit at line 2651 is `ctx.globalAlpha = baseAlpha`. Reduce the spawned cloud alpha:

  ```javascript
  // ADD at end of _renderCloudToOffscreen, before return:
  if (perspectiveFactor > 0 && isFar) {
    // Reduce blit alpha for far clouds — stored as property, read by main render loop
    p._perspectiveAlphaScale = 1 - perspectiveFactor * 0.4;
    // e.g. visibility=5km → perspectiveFactor=0.5 → alpha × 0.80
  } else {
    p._perspectiveAlphaScale = 1.0;
  }
  ```

  In the main render loop where far clouds are blitted (around line 2646–2651), apply the scale. The actual code at line 2646 is:
  ```javascript
  const baseAlpha = state._alpha * p.alpha;
  ```
  and at line 2651:
  ```javascript
  ctx.globalAlpha = baseAlpha;
  ```

  Replace line 2651:
  ```javascript
  // FIND line ~2651:
  ctx.globalAlpha = baseAlpha;
  // REPLACE with:
  ctx.globalAlpha = baseAlpha * (p._perspectiveAlphaScale ?? 1);
  ```

- [ ] **Step 2: Build**
  ```bash
  npm run build
  ```
  Expected: no errors.

- [ ] **Step 3: Verify (visual)**

  Test A — High visibility (≥10km): Far and near clouds should look identical in colour and alpha — no perspective effect.

  Test B — Low visibility (3km): Far clouds should appear distinctly hazier and blue-shifted compared to near clouds. Near clouds stay bright white/grey.

  Test C — Very low visibility (1km): Far clouds should be strongly blue-tinted and reduced alpha, giving a misty-depth appearance.

  Test D — Cloud rebuild: Change condition from `cloudy` to `partlycloudy` (forces cloud rebuild). New far clouds should immediately reflect the current visibility perspective without needing a page reload.

- [ ] **Step 4: Commit**
  ```bash
  git add src/weather-fx.js dist/solar-dashboard.js
  git commit -m "feat: atmospheric perspective on far clouds via visibility-driven Rayleigh shift"
  ```

---

## Implementation Notes

### T3.1 — Already Largely Implemented
Code research confirms the `start()` call at line 2726 and `updateDynamic()` call at line 2729 in `src/solar-dashboard.js` already pass `effWind`, `effCloud`, `effVis`, `effPI`, `effGust`, `effDew`, `effPressure`, `effUV`, `effHum`, `effTemp`, `effPP` — all derived from `_effective`. Task 1 is therefore a verification + gap-fill pass. If all values are confirmed wired, the commit may only include the dist rebuild.

### Source Doc Inconsistency (T3.4)
The source doc §3.4 formula comment states `0.005/frame (~3.3s)` for rainbow afterglow decay. The prose says "30–60 seconds." The prose is authoritative. Correct decay rate used in this plan: `~0.000417/frame` at 60fps (≈40 seconds). The plan uses 0.000417 as the midpoint of the 30–60s range.

### Source Doc Bug (T3.2)
The source doc §3.2 writes `const fogDensity = ...` then reassigns it with amplifiers. This plan correctly uses `let fogDensity` to allow reassignment.

### T3.3 Illumination Formula — Units
Source §3.3 convention: phaseAngle 0°=new moon, 180°=full moon; illumination = (1 - cos(phaseAngle × π/180)) / 2. This aligns with the canvas clipping: at new moon phaseOffset = +moonR (shadow far right → disc dark); at full moon phaseOffset = -moonR (shadow far left → disc fully lit). phaseAngle is passed in degrees — multiply by Math.PI/180 before Math.cos().

### T3.3 `_effective` Timing
`moon_illumination` is computed inside an IIFE within `_assembleEffective()`. This runs whenever `_updateWeather()` runs (every 5 minutes, or on HA state change). The computed illumination changes slowly (~0.5% per hour at quarter phases) — 5-minute refresh is sufficient resolution.

### T3.6 Blit Stage Dependency
The `_perspectiveAlphaScale` property approach requires finding the exact blit line in the main render loop that draws cloud particles. If the blit uses a different alpha path (e.g., directly from `p.alpha`), adapt accordingly — the principle is: multiply the blit alpha by `p._perspectiveAlphaScale ?? 1`.

### Build Rule
Always run `npm run build` before committing. The distributable `dist/solar-dashboard.js` must be rebuilt and committed alongside every source change. HACS auto-deploys from the dist file.

### No Force Push
Do not push to remote. Pushing is done by the project owner after review.

### Fog Hard Guard (T3.2)
Architecture §8.8 mandates blend weight = 0 for fog visibility — a hard zero, not a soft
suppression. `lerp(actual, forecast, 0) = actual`, so `_effective.visibility` IS the raw actual
value when fog is active. `this._visibility` in the fog spawn block therefore always reads raw
actual visibility. No separate `_rawVisibility` field is needed.
