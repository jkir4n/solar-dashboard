# Weather Effects Improvements — Design Spec
**Date:** 2026-04-13  
**File scope:** `src/weather-fx.js` only  
**Style:** Adaptive — subtle ambient default, intensity scales with weather severity  

---

## Overview

Nine targeted improvements to the canvas weather particle system. All effects are fully dynamic: they respond to time of day (day/night), active weather condition, cloud cover (via `cloudDim`), wind speed, sun/moon elevation, and moon phase brightness. No hardcoded states.

---

## 1. Lightning Screen Flash

**Trigger:** `type === 'storm'` when a bolt fires  
**Behaviour:**
- On each lightning strike, overlay the full canvas with a white flash
- Flash fades out over ~120ms using `_alpha` interpolation in the animation loop
- `lightning`: flash alpha peaks at 0.45
- `lightning-rainy`: flash alpha peaks at 0.35
- Flash is independent per-bolt — does not stack

**Dynamic:** Only fires during active bolt events. Zero visual impact between strikes.

**Implementation:** Add `_flashAlpha` and `_flashDecay` state to the WeatherFX class. In `_drawFrame`, after all particles are drawn, fill canvas with `rgba(220,230,255, _flashAlpha)` and decay `_flashAlpha -= _flashDecay` each frame. Non-stacking guard: `this._flashAlpha = Math.max(this._flashAlpha, peakAlpha)` — takes the higher value, never adds.

---

## 2. Star Colour Variance

**Trigger:** All night conditions (`_isNight === true`)  
**Behaviour:**
- Assign a spectral class at particle creation time, stored on each star particle
- Distribution: 40% white, 25% pale blue (#aad4ff), 20% pale yellow (#fff8d0), 10% pale orange (#ffd8a0), 5% red (#ffb0a0)
- Brighter stars (larger radius) weighted toward blue/white
- Apply colour to both the circle fill and the cross glyph stroke
- Twinkle alpha modulation unchanged

**Dynamic:** Colour assigned once at creation. Night/day transition handled by existing overlay system — no changes needed.

---

## 3. Solar / Lunar Halo (22° Ring)

**Trigger:** Sun: daytime, `sunElevation > 5°`. Moon: night, `moonElevation > 5°`  
**Condition gating:** Only visible when sky is clear enough. `cloudDim` is derived at draw time — not a stored property:
- Sun halo: `const cloudDim = SUN_CLOUD_DIM[this._weatherCondition] ?? 0`
- Moon halo: `const cloudDim = MOON_CLOUD_DIM[this._weatherCondition] ?? 0`
- `haloStrength = Math.max(0, cloudDim - 0.45) / 0.55` — evaluates to 0 for `cloudy`/`fog`/`rainy`, up to 1.0 for `sunny`/`clear-night`. No condition enumeration needed — the formula gates correctly for all conditions via the existing dim tables.

**Sun halo:**
- Radial gradient ring centred on sun disc position
- Ring radius = `sunR * 2.8` (approximates 22° in screen space at typical elevations)
- Ring width = 12px soft gradient (inner transparent → peak → outer transparent)
- Peak alpha = `haloStrength * 0.30`
- Colour: warm white with slight rainbow fringe (inner edge slightly red, outer slightly blue-violet)

**Moon halo:**
- Same geometry, centred on moon disc position
- Peak alpha = `haloStrength * moonBrightness * 0.25`
- Colour: cool silver-white

**Dynamic:** Fades in/out smoothly as `cloudDim` changes. Scales with `moonBrightness` at night. Disappears when sun/moon below horizon.

---

## 4. Rainbow Arc

**Trigger:** `condition === 'rainy' || condition === 'pouring'`, AND `!_isNight`, AND `_sunElevation > 5°`  
**Behaviour:**
- Arc centred at the antisolar point: `antisolarAz = (_sunAzimuth + 180) % 360`
- Canvas x: `antisolarX = canvasW * (antisolarAz / 360)`
- Arc geometry derived from sun elevation:
  - `arcRadius = canvasH * 0.55` (fixed — 42° projected arc approximation)
  - `arcCenterY = canvasH * (0.62 + (sunElevation / 90) * 0.35)` — at low elevation the antisolar point is near horizon (centre pushed down), at higher elevation it rises. Arc centre is always below the visible canvas horizon, so only the top portion of the arc is visible.
- 6 spectral bands (R→V), each 5px wide, rendered as `ctx.arc` strokes
- Total arc alpha: `rainbowAlpha = 0.22` for `rainy`, `0.28` for `pouring`
- Rainbow fades in over 3s after condition starts (use `_rainbowFade` 0→1 over ~180 frames)
- Fades out immediately when condition changes

**Dynamic:** Position tracks live sun azimuth. Invisible at night. Invisible when sun below 5°. Intensity differs between rain/pouring.

**Colour bands (inner→outer):**
| Band | Colour | Alpha multiplier |
|------|--------|-----------------|
| Red | rgba(255,30,0) | 1.0 |
| Orange | rgba(255,120,0) | 0.9 |
| Yellow | rgba(255,230,0) | 0.85 |
| Green | rgba(0,200,60) | 0.8 |
| Blue | rgba(0,80,255) | 0.85 |
| Violet | rgba(100,0,220) | 0.75 |

---

## 5. Hexagonal Snowflakes

**Trigger:** `type === 'snowy'` and `type === 'sleet'`  
**Replaces:** `ctx.arc` circle fill for `flake` particles  
**Geometry:**
- 6 main arms from centre at 60° intervals, length = particle radius
- 2 branch pairs per arm at 45% and 65% of arm length, branch length = arm × 0.28
- Branches perpendicular to arm (±90°)
- Simple arms only (no branches) when `r < 3.5`
- Rotate each flake by `particle.angle` (incremented each frame by 0.008 rad)

**Dynamic:** Wind-drift and sway dynamics unchanged — only the draw call changes. Rotation direction matches sway direction.

---

## 6. Improved Fog

**Trigger:** `type === 'fog'`  
**Replaces:** Current 12 flat ellipse blobs  
**New system — 4 stratified layers:**
| Layer | yBase (% height) | Speed | Blob count | Alpha range |
|-------|-----------------|-------|------------|-------------|
| 0 (ground) | 75% | 0.15 | 5 | 0.18–0.24 |
| 1 | 55% | 0.22 | 4 | 0.12–0.18 |
| 2 | 38% | 0.30 | 4 | 0.08–0.12 |
| 3 (high) | 22% | 0.40 | 3 | 0.04–0.08 |

Each blob y-position has turbulence: `y = yBase + sin(x * 0.04 + t * 0.025 + blobIndex) * layerAmplitude`  
Amplitude decreases with height (ground layer ±18px, high layer ±8px).  
Blobs are wider than current (width 90–160px, height 24–40px).  
**Dynamic:** Wind speed shifts all layer drift speeds by `windFactor * 0.3`.

---

## 7. Bokeh Aperture Blades

**Trigger:** `type === 'bokeh'` (snowy foreground particles)  
**Addition:** After the existing radial glow, draw 6 faint lines radiating from centre  
**Geometry:**
- 6 lines at 0°, 60°, 120°, 180°, 240°, 300°
- Line length: particle radius × 0.8
- Line width: 0.7px
- Alpha: `particle.o * 0.35` (very faint — 35% of glow opacity)
- Colour: same warm white as glow

**Dynamic:** Rotates slightly with existing `particle.angle` if present. No new particles — pure additional draw on existing bokeh.

---

## 8. Smoother Aurora + Vertical Oscillation

**Trigger:** Night overlay (`_overlayType === 'night'`)  
**Replaces:** Per-pixel `lineTo` loop in aurora rendering  
**New rendering:**
- 10 control points per band, spaced evenly across canvas width
- Each point: `y = band.yBase + sin(x * 0.025 + t * 0.04 + band.phase) * 18 + sin(x * 0.04 - t * 0.025) * 10`
- Connect with `quadraticCurveTo` using midpoints between control points
- Add vertical band oscillation using a bounded formula (no mutation, no drift): `yBase = band.yBaseInitial + Math.sin(t * 0.015 + bandIndex * 0.8) * 12` — oscillates ±12px around fixed initial position
- Line width: `6 + 4 * sin(t * 0.03 + bandIndex)` (breathes)

**Dynamic:** Moon brightness dims aurora: `auroraAlpha *= (1 - moonBrightness * 0.65)`. Same as existing behaviour, just new render path.

---

## 9. Performance Fixes

### 9a. Lightning Bolt Caching
- Add `_boltCache` array to store last generated bolt segment list
- Regenerate only when `lp.timer === 0` (new strike), not every frame
- Reuse cached path for flicker phase

### 9b. Particle Pre-filtering
- At particle creation (`_spawnParticles`), store particles in typed buckets: `_particlesByType = { drop: [], flake: [], bolt: [], ... }`
- Draw loops iterate their own bucket — no `.filter()` calls per frame
- On condition change (full respawn), buckets are cleared and rebuilt
- **Also update `stop()` and `resize()`**: both methods reset `this._particles = []` — add `this._particlesByType = {}` alongside every such reset to keep buckets in sync

### 9c. Aurora Loop (resolved by fix #8)
- Quadratic curve approach inherently eliminates the per-pixel loop

---

## Sequencing

All 9 changes are in `src/weather-fx.js`. Implement in this order to minimise merge conflicts:

1. Perf: particle buckets (9b) — affects all subsequent work
2. Star colours (2) — isolated, touches only star particle creation + draw
3. Aurora smoothing (8) + perf fix (9c)
4. Snowflake geometry (5)
5. Fog layers (6)
6. Bokeh blades (7)
7. Lightning flash + bolt cache (1 + 9a)
8. Solar/lunar halo (3)
9. Rainbow arc (4)

---

## Non-Goals

- No changes to `solar-dashboard.js`, `ha-bridge.js`, `solar-engine.js`, `charts.js`, or `styles.js`
- No new particle types beyond what is described above
- No audio
- No user-configurable parameters (all driven by live HA state)
