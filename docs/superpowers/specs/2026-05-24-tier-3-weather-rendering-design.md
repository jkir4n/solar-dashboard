# Tier 3 Weather Rendering — Design Spec

**Date:** 2026-05-24
**Source docs:** `docs/weather-architecture.md`, `docs/weather-rendering.md`
**Constraint:** No deviations from source docs. All formulas, thresholds, and field names are taken verbatim from source unless a documented inconsistency is noted.

---

## Scope

All 7 Tier 3 enhancements from `weather-rendering.md`, individually deployable (6 commits — §3.2 and §3.2a are bundled). Source doc numbering preserved throughout.

**Deployments:**

| # | Phase | Source § | Group |
|---|-------|----------|-------|
| T3.1 | Forecast-Aware Rendering | §3.6 | Foundation |
| T3.2 | Fog Density Gradient + Noise Placement | §3.2 + §3.2a | Core Visuals |
| T3.3 | Moon Phase-Accurate Disc | §3.3 | Core Visuals |
| T3.4 | Rainbow Enhancement | §3.4 | Core Visuals |
| T3.5 | Aurora Enhancement | §3.1 | Polish |
| T3.6 | Atmospheric Perspective on Clouds | §3.5 | Polish |

**Total frame budget cost:** +0.9ms (well within ~10ms headroom documented in `weather-rendering.md` §5).

---

## Structure: Three Groups

```
GROUP 1 — Foundation
  T3.1  §3.6  Forecast-Aware Rendering          (solar-dashboard.js, weather-fx.js)

GROUP 2 — Core Visuals
  T3.2  §3.2+3.2a  Fog Gradient + Noise         (weather-fx.js)
  T3.3  §3.3  Moon Phase-Accurate Disc           (solar-engine.js, weather-fx.js, solar-dashboard.js)
  T3.4  §3.4  Rainbow Enhancement                (weather-fx.js)

GROUP 3 — Polish
  T3.5  §3.1  Aurora Enhancement                 (weather-fx.js)
  T3.6  §3.5  Atmospheric Perspective on Clouds  (weather-fx.js)
```

**Ordering rationale:**
- T3.1 wires `_effective.*` into all render consumers. Every subsequent phase reads forecast-blended values automatically.
- T3.2 redesigns both the visibility gate and blob placement in one pass — no intermediate broken fog state.
- T3.3 touches `solar-engine.js` independently; no dependency on fog or rainbow.
- T3.4 is additive on top of the existing rainbow system.
- T3.5 and T3.6 are purely additive visual polish; failing either changes nothing structurally.

Each phase ships as a single `feat:` commit. No phase modifies another phase's code — all changes are additive or isolated substitutions.

---

## Phase T3.1 — Forecast-Aware Rendering (§3.6)

**What it is:** The `_effective` object already exists and `_applyWeatherBackdrop()` already reads from it. The gap is that `WeatherFX.start()` / `updateDynamic()` calls in `solar-dashboard.js` still pass raw attribute values for some parameters — so `this._cloudCoverage`, `this._precipIntensity`, `this._visibility` etc. inside `weather-fx.js` are raw, not forecast-blended.

**Files touched:**
- `solar-dashboard.js` — `_updateWeather()`: switch `WeatherFX.start()` / `updateDynamic()` call sites to pass `_effective.*` values for all blendable attributes
- `weather-fx.js` — planets, ISS, Milky Way: verify `cloudDim` is computed from `this._cloudCoverage` (which will now carry the blended value); one-line change per celestial object per architecture §7.12

**What does NOT change:**
- `this._weatherCondition` stays raw — still needed for condition-gated rendering and `_calcCloudDim` condition argument
- `moonBrightness` stays raw — Meeus Ch.48 is deferred to T3.3
- No new lerp machinery — the existing `_effective` lerp in `solar-dashboard.js` handles everything
- No `weather-fx.js` render logic changes — only the values flowing into existing instance fields change

**Verification:** After this phase, a rising `_effective.cloud_coverage` (from forecast blend) dims stars, planets, ISS, and Milky Way before the condition string changes. No new visual effects — only forecast-responsiveness of existing ones.

**Estimated cost:** ~0ms/frame (data pipeline only — source: `weather-rendering.md` §5)

**Commit:** `feat: wire _effective blended attributes into WeatherFX render consumers`

---

## Phase T3.2 — Fog Density Gradient + Noise Placement (§3.2 + §3.2a)

**Files touched:** `weather-fx.js` only.

### Change 1 — Visibility gate replaces condition gate (§3.2)

```javascript
// Primary gate — visibility (NOT condition string 'fog'):
if (this._visibility >= 5) return;  // No fog above 5km visibility

// Density inverse of visibility:
const fogDensity = clamp(1 - (this._visibility / 5), 0, 1);
// < 0.5km → 40+ dense blobs, density = 0.9
// 1-3km   → 20 moderate blobs, density = 0.4-0.8
// 3-5km   → 8 light blobs, density = 0.0-0.4

// Temperature-dew_point spread amplifier:
const spread = this._temperature - this._dewPoint;
const persistenceBoost = spread < 2 ? 1.3 : spread > 8 ? 0.5 : 1.0;
fogDensity = clamp(fogDensity * persistenceBoost, 0, 1);

// Cloud coverage secondary amplifier:
fogDensity *= (0.7 + this._cloudCoverage / 300);
```

**Hard guard (architecture §8.8):** Fog blend weight always 0 — only actual `this._visibility` drives fog, never forecast. Forecast fog with actual 16km visibility = no fog. Real fog with forecast clearing = fog persists.

### Change 2 — Vertical density gradient in `_render()` (§3.2)

```javascript
// 3-stop gradient behind fog blobs:
const grad = ctx.createLinearGradient(0, height * 0.4, 0, height);
grad.addColorStop(0,   `rgba(200, 210, 220, 0)`);
grad.addColorStop(0.5, `rgba(200, 210, 220, ${fogDensity * 0.15})`);
grad.addColorStop(1,   `rgba(200, 210, 220, ${fogDensity * 0.35})`);
// fogDensity lerps at 0.02/frame

// Warm vs cold fog colour:
const fogWarmth = Math.max(0, Math.sin(sunElevation * Math.PI / 180));
const effectiveWarmth = fogWarmth * cloudDim * (this._temperature > 25 ? 1.2 : 1.0);
// Interpolates between warm (240, 220, 180) and cold (180, 190, 200)
// overcast fog stays cold even during daytime; tropical warmth gets 1.2× boost
```

### Change 3 — Noise-driven x-placement (§3.2a)

`snFBM()` already imported from `src/noise.js` (used by cloud system since T2.2).

```javascript
const noiseSeed = Math.random() * 1000;
FOG_LAYERS.forEach((layer, li) => {
  for (let bi = 0; bi < layer.count; bi++) {
    const noiseVal = snFBM(noiseSeed + bi * 0.3, li * 2.0, 3); // 3 octaves, 1D
    const x = ((bi / layer.count) + noiseVal * 0.15) * w;      // clustered placement
    const rx = 90 + 70 * (0.5 + noiseVal * 0.5);               // size from noise
    const alpha = layer.alphaMin + (layer.alphaMax - layer.alphaMin) * (0.5 + noiseVal * 0.5);
    // ... spawn particle
  }
});
// Zero per-frame cost — noise evaluated once at spawn
```

**What does NOT change:** Fog blob physics (Y-bob, wind drift), ellipse render shape, layer structure.

**Verification:** Fog appears under any hazy/misty condition when visibility drops below 5km. Blobs cluster naturally into banks. Canvas bottom visibly denser. Fog colour warms at sunrise/sunset.

**Estimated cost:** +0.15ms/frame (§3.2 +0.1ms + §3.2a +0.05ms spawn-only — source: `weather-rendering.md` §5)

**Commit:** `feat: fog visibility-gate, noise-driven placement, density gradient`

---

## Phase T3.3 — Moon Phase-Accurate Disc (§3.3)

**What it is:** Replace HA 8-state `sensor.moon_phase` discrete lookup with continuous Meeus Ch.48 local computation. Moon disc gets canvas-clipped crescent/gibbous shape. Cloud gating migrates from condition strings to continuous `cloudDim`.

**Files touched:**
- `solar-engine.js` — add `computeMoonPhaseAngle(jde)`: returns `{ phaseAngle, illumination }`
- `solar-dashboard.js` — replace `MOON_PHASE_BRIGHTNESS` lookup; add `moon_illumination` to `_effective`
- `weather-fx.js` — canvas clipping for phase shape; cloud gating migration

### solar-engine.js addition

```javascript
// Meeus Ch.48 — continuous moon phase
computeMoonPhaseAngle(jde) {
  // returns { phaseAngle: 0–360°, illumination: 0–1 }
  // illumination = (1 - Math.cos(phaseAngle * Math.PI / 180)) / 2
}
```

### Canvas clipping (weather-fx.js)

```javascript
const phaseOffset = moonR * Math.cos(phaseAngle * Math.PI / 180);
ctx.save();
ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.clip();
ctx.beginPath(); ctx.arc(moonX + phaseOffset, moonY, moonR, 0, Math.PI * 2);
ctx.fillStyle = moonColor; ctx.fill();
ctx.restore();
// phaseOffset changes smoothly every frame — no step changes
```

### Cloud gating migration (weather-fx.js) — architecture §7.11.3

```javascript
// Current: condition string gating
// New: continuous cloudDim (same sigmoid as sun disc)
if (this._moonElevation <= 0) return;
const cloudDim = _calcCloudDim(this._cloudCoverage, condition);
const moonAlpha = this._moonIllumination * cloudDim * (1 - skyWash);
if (moonAlpha < 0.01) return;
if (cloudDim > 0.35) renderDiscWithClipping(phaseAngle);   // clear to partly-cloudy
else if (cloudDim > 0.10) renderDiffuseGlowOnly();          // cloudy to fog
// else hidden — heavy rain/storm
```

**Moon wash effects:** Stars, planets, ISS, Milky Way, aurora, shooting stars, lunar halo — all already implemented and consume `moonBrightCur`. After this phase, `moonBrightCur` reads from `_effective.moon_illumination` (continuous) instead of the discrete HA sensor. Terrestrial night lighting (clouds, fog, rain backlit by moon) is **out of scope** per architecture §7.11.2.

**What does NOT change:** Moon wash formulas, existing celestial gating chain, lunar halo threshold.

**Estimated cost:** +0.2ms/frame (source: `weather-rendering.md` §5)

**Commit:** `feat: moon phase-accurate disc via Meeus Ch.48, continuous cloud gating`

---

## Phase T3.4 — Rainbow Enhancement (§3.4)

**What it is:** Two additive changes to the existing rainbow render block. Rainbow geometry (6 spectral bands, antisolar azimuth) is unchanged.

**Files touched:** `weather-fx.js` only — rainbow render block.

### Change 1 — Post-rain persistence

```javascript
// New property: _rainbowAfterglow
// Set to 1.0 when rain stops.
// Decay rate: ~0.000278–0.000556/frame → 30–60 seconds at 60fps
// (Source doc §3.4 prose: "persists for 30–60 seconds after rain stops")
// Note: source doc formula comment stated 0.005/frame (~3.3s) — this is an
// internal inconsistency in the source. Prose description (30–60s) is authoritative.

// Render gate:
if ((raining || this._rainbowAfterglow > 0) && sunElevation > 5) {
  const rainbowAlpha = baseAlpha * Math.max(rainAlpha, this._rainbowAfterglow) * cloudDim;
  // Post-rain afterglow also modulated by cloudDim —
  // clouds closing in after rain causes rainbow to fade faster
}
```

### Change 2 — Secondary bow

```javascript
const secondaryAlpha = primaryAlpha * 0.15 * cloudDim;
// Colour order reversed (violet→red instead of red→violet)
// Positioned at larger radius than primary
// Often invisible under moderate cloud cover
```

**What does NOT change:** Rainbow geometry, 6 spectral bands, antisolar azimuth calculation, existing fade-in/out pattern.

**Estimated cost:** +0.15ms/frame (source: `weather-rendering.md` §5)

**Commit:** `feat: rainbow post-rain afterglow and secondary bow`

---

## Phase T3.5 — Aurora Enhancement (§3.1)

**What it is:** Additive visual improvement to the existing aurora render block in `_render()`.

**Files touched:** `weather-fx.js` only — aurora render block.

### Changes

1. **Vertical curtain rays** — each band gains ray structure; each ray has its own alpha lerp at `0.01/frame`
2. **Multi-frequency wave distortion** — 2–3 harmonics instead of single sine; continuous, no transition needed
3. **Purple/blue nitrogen emission** — additive colour at band lower edges only

### Gating (unchanged from existing system)

```javascript
auroraAlpha = baseAlpha * cloudDim * (1 - moonBrightness * 0.65);
// Only visible when cloudDim > 0.3
// At cloudDim < 0.15 (heavy overcast) — effectively invisible
// Existing _overlayAlphaCur lerp handles fade-in/fade-out — no new mechanism
```

**What does NOT change:** Aurora spawn logic, existing band structure, existing cloud/moon gating formulas, existing overlay alpha lerp.

**Estimated cost:** +0.3ms/frame (source: `weather-rendering.md` §5)

**Commit:** `feat: aurora vertical curtains, multi-frequency waves, nitrogen edge colour`

---

## Phase T3.6 — Atmospheric Perspective on Clouds (§3.5)

**What it is:** Single change to `_renderCloudToOffscreen()` — far-layer clouds get reduced alpha and blue tint driven by `this._visibility`. Applied at spawn only (offscreen canvas is cached).

**Files touched:** `weather-fx.js` only — `_renderCloudToOffscreen()`.

### The change

```javascript
// visibility < 10km → far clouds get blue-shifted colour + reduced alpha (Rayleigh)
// Near clouds sharpen naturally by contrast — no change needed
const perspectiveFactor = clamp(1 - (this._visibility / 10), 0, 0.6);
farCloudAlpha *= (1 - perspectiveFactor * 0.4);   // reduced alpha
farCloudBlueShift = perspectiveFactor * 0.3;        // blend toward blue

// Example values:
// visibility >= 10km → perspectiveFactor = 0 → no change (crisp far clouds)
// visibility =  5km → perspectiveFactor = 0.5 → alpha ×0.80, blueShift 0.15
// visibility =  0km → perspectiveFactor = 0.6 (clamped) → alpha ×0.76, blueShift 0.18
```

**Transition mechanism:** Applied at spawn only. When clouds rebuild on archetype change, new far clouds get correct perspective immediately. Old clouds fade out via existing alpha lerp from §2.3. No per-frame cost.

**Dependency on T3.1:** After T3.1, `this._visibility` carries forecast-blended `_effective.visibility`. Without T3.1, reads raw visibility. Formula works either way — T3.1 adds forecast-responsiveness.

**What does NOT change:** Cloud geometry, morphing system, near-layer cloud rendering.

**Estimated cost:** +0.1ms/frame, one-time at spawn (source: `weather-rendering.md` §5)

**Commit:** `feat: atmospheric perspective on far clouds via visibility-driven Rayleigh shift`

---

## Performance Budget

| Phase | Enhancement | Cost |
|-------|-------------|------|
| T3.1 | Forecast-Aware Rendering | ~0ms |
| T3.2 | Fog Gradient + Noise Placement | +0.15ms |
| T3.3 | Moon Phase-Accurate Disc | +0.2ms |
| T3.4 | Rainbow Enhancement | +0.15ms |
| T3.5 | Aurora Enhancement | +0.3ms |
| T3.6 | Atmospheric Perspective | +0.1ms |
| **Total** | | **+0.9ms** |

**Headroom:** ~10ms available (6.5ms current of 16.67ms budget). All T1+T2 enhancements add ~2.05ms. Full T3 adds 0.9ms further. Total ~3ms of additions — ~7ms headroom remains.

---

## Source Doc References

| Item | Source |
|------|--------|
| T3.1 gate/pipeline | `weather-rendering.md` §3.6; `weather-architecture.md` §7.12 |
| T3.2 visibility gate, density formula, amplifiers | `weather-rendering.md` §3.2; `weather-architecture.md` §7.6 |
| T3.2 gradient 3-stop formula | `weather-rendering.md` §3.2 transition mechanism |
| T3.2 effectiveWarmth formula | `weather-rendering.md` §3.2 transition mechanism |
| T3.2a noise formula | `weather-rendering.md` §3.2a |
| T3.3 Meeus Ch.48 | `weather-rendering.md` §3.3; `weather-architecture.md` §7.11 |
| T3.3 canvas clipping | `weather-rendering.md` §3.3 transition mechanism |
| T3.3 cloud gating thresholds | `weather-architecture.md` §7.11.3 |
| T3.4 afterglow duration (prose) | `weather-rendering.md` §3.4 — 30–60s prose is authoritative over erroneous 0.005/frame formula comment |
| T3.4 secondary bow | `weather-rendering.md` §3.4 transition mechanism |
| T3.5 gating formulas | `weather-rendering.md` §3.1 |
| T3.6 perspectiveFactor formula | `weather-rendering.md` §3.5; `weather-architecture.md` §7.2 |
| Performance costs | `weather-rendering.md` §5 performance budget table |
