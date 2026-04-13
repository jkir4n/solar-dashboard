# Cloud System Redesign — Design Spec

**Date:** 2026-04-13  
**File:** `src/weather-fx.js`  
**Status:** Approved

---

## Goals

1. Procedurally unique cloud shapes per spawn (no two clouds identical)
2. Meteorologically accurate cloud archetypes inferred from HA data
3. True top-lit volumetric depth shading per cloud
4. More distinct parallax layers (far vs near)
5. Wind-reactive drift — correct direction (bearing) and speed

---

## 1. Archetype System

Six archetypes inferred from `condition` + `cloud_coverage` at spawn time:

| Archetype | Condition | Coverage | Real type |
|---|---|---|---|
| `cumulus` | partlycloudy / windy | < 40% | Fair-weather cumulus — tall, puffy, separated |
| `altocumulus` | partlycloudy / cloudy | 40–65% | Mid-level puffs — flatter, grouped |
| `stratocumulus` | cloudy | 65–85% | Low lumpy overcast — merged, textured |
| `stratus` | cloudy | > 85% | Featureless grey sheet — very flat |
| `nimbostratus` | rainy / pouring / snowy | any | Dark, thick, rain-bearing — flat blobs |
| `cumulonimbus` | lightning / hail | any | Towering dark storm masses |

Archetype is determined once per `_createParticles('cloudy')` call and stored on each particle. Cirrus omitted — too wispy to render meaningfully at canvas scale.

**Important:** `_createParticles` receives the particle type string (`'cloudy'`), not the original HA condition. Archetype inference must read `this._weatherCondition` directly to distinguish `windy`/`windy-variant` from `partlycloudy` from `cloudy`, etc.

---

## 2. Procedural Lobe Generation

Each cloud particle stores its own `lobes` array, generated at spawn. No recomputation per frame.

### Archetype constraints

| Archetype | Lobe count | Horiz spread | Vert reach (up) | rs range |
|---|---|---|---|---|
| cumulus | 5–8 | ±0.80r | −0.70r | 0.55–0.90 |
| altocumulus | 5–9 | ±1.00r | −0.30r | 0.45–0.75 |
| stratocumulus | 7–11 | ±1.30r | −0.20r | 0.40–0.70 |
| stratus | 8–14 | ±1.80r | −0.10r | 0.35–0.60 |
| nimbostratus | 7–12 | ±1.50r | −0.15r | 0.40–0.65 |
| cumulonimbus | 6–10 | ±0.90r | −1.00r | 0.55–0.85 |

### Lobe placement algorithm

1. **Center lobe** — always at `(dx=0, dy=0, rs=1.0)`
2. **Crown anchors** — 1–2 lobes placed near top of archetype's vertical reach with `rs` 0.7–0.9
3. **Fill lobes** — remaining lobes placed randomly within `spreadX` × `spreadY` bounds, with slight clustering bias toward crown anchors
4. Each lobe stores `phase: Math.random() * Math.PI * 2` for independent breathing pulse

### Per-lobe shade value

Computed at spawn from lobe vertical positions:

```
shade = (maxDy === minDy) ? 0.5 : 1.0 - (lobe.dy - minDy) / (maxDy - minDy)
```

`shade = 1.0` at topmost lobe, `0.0` at bottommost. Fallback `0.5` when all lobes share the same `dy` (e.g. very flat stratus where vertical spread is near zero). Used by shading passes each frame.

---

## 3. Depth Shading

### Day clouds (3 passes per cloud)

**Pass 1 — Fill (`lighter`):**  
Radial gradient per lobe. Center color interpolates between:
- Top lobes (shade→1.0): `rgba(255,255,255, baseAlpha×0.55)`
- Bottom lobes (shade→0.0): `rgba(140,160,190, baseAlpha×0.35)`  
Edge fades to transparent at lobe boundary.

**Pass 2 — Shadow interior (`multiply`):**  
Per-lobe radial gradient at 70% lobe radius. Alpha `0.18`, color `rgba(80,100,130)`. Darkens overlapping lobe interiors to create volume.

**Pass 3 — Crown highlight (`screen`):**  
Single radial gradient at cloud top. `rgba(255,255,240, alpha×0.12)`. Not per-lobe.

### Night clouds (2 passes per cloud)

**Pass 1 — Fill (`source-over`):**  
Radial gradient per lobe. Center color interpolates between:
- Top lobes (shade→1.0): `rgba(70,80,105, baseAlpha×0.85)` — dark blue-grey with city-glow hint
- Bottom lobes (shade→0.0): `rgba(22,28,45, baseAlpha×0.60)` — very dark blue-black  

No `lighter` blend — avoids unnatural white glow on dark background.

**Pass 2 — Moon scatter (`screen`):**  
Single faint glow at cloud top. `rgba(255,255,240, alpha×0.04)`.

---

## 4. Layer Distinction

Two depth layers, more aggressively differentiated than current:

| Property | Layer 0 (far) | Layer 1 (near) |
|---|---|---|
| Base radius | 40–80 px | 110–200 px |
| Alpha | 0.35–0.50 | 0.70–0.90 |
| Y range | 3–30% canvas height | 15–55% canvas height |
| Base drift speed | 0.07–0.13 px/frame | 0.20–0.35 px/frame |
| Wind multiplier | 0.10 | 0.25 |
| Cloud count | 3 | 4 |

Near-layer clouds are 2–3× larger, ~2× more opaque, and faster — creates clear parallax depth.

---

## 5. Wind Reactivity

Clouds drift in the true downwind direction. Computed per frame in the render loop:

```javascript
const windFactor   = Math.min((state._windSpeed || 0) / 54, 1.0);
const downwindRad  = ((state._windBearing + 180) % 360) * Math.PI / 180;
const windDx       = Math.sin(downwindRad);        // +1 = rightward
const windDy       = -Math.cos(downwindRad);       // +1 = downward (canvas y-inverted)
```

Per-cloud velocity applied each frame:

```javascript
// baseSpeed is always rightward (+x), independent of wind direction
// Wind adds the true directional component on top
p.vx += baseSpeed;                                      // minimum rightward drift
p.vx += windFactor * layerMult * windDx;               // wind horizontal
p.yBase += windFactor * layerMult * windDy * 0.15;     // wind vertical (via yBase, see §6)
```

`baseSpeed` is a per-spawn scalar (layer 0: 0.07–0.13, layer 1: 0.20–0.35) sampled once at spawn and stored on the particle. It represents the cloud's own momentum independent of wind — at calm wind the cloud still drifts rightward.

`layerMult`: layer 0 = `0.10`, layer 1 = `0.25`.

**Edge wrapping — all four edges:**

```javascript
if (p.x  > w + p.r * 2)  { p.x = -p.r * 2;  p.yBase = Math.random() * h; }
if (p.x  < -p.r * 2)     { p.x = w + p.r * 2; p.yBase = Math.random() * h; }
if (p.yBase > h + p.r)   { p.yBase = -p.r;   p.x = Math.random() * w; }
if (p.yBase < -p.r)      { p.yBase = h + p.r; p.x = Math.random() * w; }
```

---

## 6. Per-Cloud Y-Bob

Each cloud gets a gentle independent vertical oscillation stored at spawn:

```javascript
p.yBase     = p.y;
p.phase     = Math.random() * Math.PI * 2;
p.bobSpeed  = 0.0003 + Math.random() * 0.0002;
p.bobAmp    = 3 + Math.random() * 5;   // px
```

Applied each frame:

```javascript
// Wind vertical drift advances yBase (not p.y directly) so bob reference stays in sync
// p.yBase += windDrift  ← handled in §5 wind block
p.y = p.yBase + Math.sin(now * p.bobSpeed + p.phase) * p.bobAmp;
```

`p.y` is never mutated directly — only `p.yBase` advances (via wind) and `p.y` is always derived from it. This prevents accumulated vertical error when `windDy` is non-zero.

Makes parallax depth feel alive rather than mechanical.

---

## 7. Star Overlay Fix (already coded, not yet deployed)

Night star overlay alpha now scales by `_calcCloudDim(cloudCoverage, condition)` so stars are occluded by cloud coverage. At 99% coverage, effective star alpha drops from 0.30 → ~0.04.

---

## Implementation Scope

All changes confined to `src/weather-fx.js`:
- `_createParticles('cloudy')` — new archetype inference + procedural lobe generation
- Cloud render block in the main animation loop — new shading passes
- Wind computation in render loop — add `windDy`, apply to cloud `vx`/`vy`
- `_renderOverlay` — star alpha fix (already done in src)

`dist/solar-dashboard.js` must be rebuilt after changes.
