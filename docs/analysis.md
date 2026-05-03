# Solar Dashboard — Code Analysis (2026-04-21, Pass 6)

## Document Conventions

**Purpose:** Living bug/improvement tracker for this project. Only open, actionable items belong here. Fixed items are removed — no archive section.

**Context:** This is an always-on HA dashboard running 24/7 on a dedicated tablet/screen. Every item must be evaluated through this lens.

---

### Structure
1. `## Open Bugs` — Things that are broken or produce incorrect behavior
2. `## Open Improvements` — Feature requests and UX enhancements
3. `## Open Performance Issues` — Runtime efficiency concerns
4. `## Deferred Items` — Valid items intentionally postponed (table format)
5. `## Recommended Implementation Order` — Prioritized action list with impact/effort

---

### Item Format (every entry must have these fields)

```
### [ID]. [Short title]
**File:** `filename.js:line` (omit if multi-file or not applicable)
**Severity:** [emoji] [level]
**Reasoning:** [1-3 sentences explaining WHY this matters, specifically for an always-on HA dashboard running 24/7 on a dedicated tablet/screen]
**Fix:** [1 sentence describing the fix approach]
**Status:** ⏳ Deferred — [reason]  (only for deferred items; omit otherwise)
```

---

### Severity Levels

| Level | Emoji | Criteria |
|-------|-------|----------|
| High | 🔴 | Active CPU/resource waste that compounds over 24/7 runtime, OR misleading critical visual state on an always-on display |
| High | 🟡 | Incorrect data display, fragile code prone to breakage, or common HA user complaint |
| Medium | 🟢 | Robustness issue, unnecessary API calls, wasted CPU during idle hours — noticeable but not critical |
| Low | ⚪ | Cosmetic, edge case, feature enhancement, or negligible performance impact |

---

### Status Tags

- **(no tag)** = Open, ready to implement
- **⏳ Deferred** = Valid but intentionally postponed — MUST appear in the Deferred Items table with reasoning
- **⚠️ Mitigated** = Partially addressed; reduced severity but not fully resolved
- **⚠️ Partially valid** = Some aspects addressed, others remain

---

### Validation Methodology (how to verify items)

When reviewing or adding items, follow this process:

1. **Read the actual source code** — Never guess line numbers, function names, or behavior. Open the file and read the relevant section.
2. **Check if the item still exists** — Code changes over time. An item marked "valid" in a previous pass may have been fixed incidentally.
3. **Evaluate against always-on context** — Ask: "Does this matter for a dashboard that never closes, runs 24/7, on a dedicated screen?" If the answer is no, defer or remove.
4. **Quantify impact where possible** — Use concrete numbers: "~5M queries/day", "144 wasted calculations/night", "30+ rAF chains per update", "80-240 gradients/frame". Vague descriptions like "improves performance" are not acceptable.
5. **Cross-reference related items** — If fixing item A also resolves item B, note the dependency and remove B.

---

### Reasoning Requirements (exact reasoning for every open item)

Every open item MUST include a `**Reasoning:**` field that answers these questions:

1. **What happens?** — Describe the actual behavior (not the symptom).
2. **Why does it matter for an always-on dashboard?** — Connect the behavior to the 24/7 dedicated display context. Examples:
   - "Over 24 hours: ~5 million unnecessary frames" (quantifies perpetual waste)
   - "Users glance from across the room — a red ring with `--%` looks like an emergency" (explains UX impact on always-on display)
   - "A new hung promise is created every 10 seconds during an outage" (shows compounding effect over uptime)
3. **What is the real-world consequence?** — Not just "it's inefficient" but "this causes X over Y time period on a device that never restarts."

**Bad reasoning:** "This wastes CPU."
**Good reasoning:** "The rAF loop runs at 60fps indefinitely after colors converge. On an always-on dashboard: ~5 million unnecessary frames per day, burning CPU continuously for the device's entire lifetime."

---

### Deferring Rules

An item should be deferred (not removed) when:

1. **It is valid but depends on another feature** — e.g., "panel config support" depends on "solar PV sensor" — defer both together with a note to implement in a single update.
2. **It is valid but low priority for this use case** — e.g., "mobile responsive improvements" for a dedicated 10" tablet display — defer with reasoning that the primary use case doesn't trigger it.
3. **It is already adequately handled** — e.g., "cache cycle rate" when it's already fetched hourly and cached — defer with reasoning that further caching would stale the data.
4. **It is semantically correct as-is** — e.g., "Math.abs vs Math.max(0,...)" when the difference is intentional based on physics — defer with reasoning explaining why the current behavior is correct.

**Deferred items go in the table** at the bottom of the document:

```
## Deferred Items

| Item | Reason for Deferral |
|------|-------------------|
| **B4 + I3 + I6** (solar PV sensor + config) | Must be implemented together — config without sensor is premature, sensor without config is incomplete. |
| **NI4** (cache cycle rate per day) | Already fetched hourly and cached. Per-day caching would make rate 24h stale — worse UX for live dashboard. |
```

Each row must explain WHY deferral is the right call, not just "low priority."

---

### Maintenance Rules

1. **Remove fixed items immediately** — When code is verified to fix an item, DELETE it from this doc. Do not mark as "Fixed" or move to an archive section. The git history is the archive.
2. **Verify against source code before any status change** — Read the actual file. Don't trust previous analysis passes. Line numbers shift, code changes.
3. **Include concrete metrics** — Quantify impact: frames/day, queries/hour, API calls, memory growth over time.
4. **Keep it lean** — If an item doesn't affect the always-on dashboard experience, defer it with reasoning or remove it.
5. **One file reference per item** — Use `filename.js:line` format. For multi-file items, reference the primary file.
6. **Update implementation order** — When items are added, removed, or fixed, re-sort the Recommended Implementation Order table.
7. **No duplicate items** — If two items describe the same root cause, merge them into one.

All items verified against current source code. Context: always-on HA dashboard running 24/7 on a dedicated tablet/screen.

---

## Open Bugs

### B4. Solar "actual" power shows grid charging as solar
**File:** `solar-dashboard.js:835`
**Severity:** 🟡 High
**Reasoning:** On an always-on display, users glance at the dashboard to check real-time energy flow. When the grid charges the battery, the "Solar Actual" card shows that power as solar production, creating a false impression that panels are generating when they may not be (e.g., at night or on cloudy days). This misleads energy monitoring decisions.
**Status:** ⏳ Deferred — Requires a dedicated solar PV sensor. Will be implemented together with I3 (panel config) and I6 (solar PV support) in a single update.

### NB1. `_fetchISSPosition` has no fetch timeout
**File:** `solar-dashboard.js:1543-1577`
**Severity:** 🟢 Medium
**Reasoning:** The ISS fetch calls a third-party API (`wheretheiss.at`) outside the user's network. On an always-on dashboard, if this API becomes unreachable (DNS failure, network partition, server downtime), the pending `fetch()` promise hangs indefinitely. Over days/weeks of uptime, accumulated hung promises consume memory and may block the event loop. The 10-second polling interval means a new hung promise is created every 10 seconds during an outage.
**Fix:** Add `AbortController` with 8-second timeout.

### NB3. `_renderPack` uses fragile `innerHTML` comparison
**File:** `solar-dashboard.js:1686`
**Severity:** ⚪ Low
**Reasoning:** `idEl.innerHTML !== newId` compares serialized HTML strings containing `<span>` tags. Browser normalization (whitespace, attribute ordering, self-closing tags) can cause false mismatches, triggering unnecessary DOM writes on every cell balance update. On an always-on dashboard, this means redundant DOM mutations every 30-60 seconds. Not a crash risk, but causes unnecessary repaints and wears on the display's rendering pipeline over time.
**Fix:** Compare `idEl.textContent` for the cell index, use a `data-*` attribute for high/low state.

### NB5. Unavailable SOC retains red stroke color
**File:** `solar-dashboard.js:897-906`
**Severity:** 🟡 High
**Reasoning:** When the SOC entity becomes temporarily unavailable (HA restart, BMS disconnect, network glitch), the else branch shows `'--%'` and clears the ring — but `ring.style.stroke` is never reset. If SOC was previously below 20% (red stroke), the ring stays red. On an always-on display that users glance at from across the room, a red ring with `--%` looks like a critical battery emergency when the real issue is simply data unavailability. This causes unnecessary alarm.
**Fix:** Reset stroke color in the else branch: `ring.style.stroke = 'var(--secondary-text)'`.

### NB6. `fetchHistoryRange` error indistinguishable from no data
**File:** `ha-bridge.js:360-368`
**Severity:** 🟢 Medium
**Reasoning:** Both a successful fetch with no data and a failed fetch (network error, HA unavailable, auth failure) return `[]`. On an always-on dashboard, if HA is temporarily unreachable, charts silently show "No data available" — the same message shown when an entity genuinely has no history. Users cannot tell whether a blank chart means "no data yet" or "something is broken." This makes troubleshooting difficult, especially after HA restarts or network blips.
**Fix:** Return `null` on error. Caller checks `if (data === null)` for error state vs `if (data.length === 0)` for no data.

### B21. `_animateValue` animation-end listener not cleaned up on cancel
**File:** `solar-dashboard.js:789-791`
**Severity:** ⚪ Low
**Reasoning:** When an animation is cancelled via `cancelAnimationFrame`, the `animationend` listener is not removed. The `{ once: true }` option prevents it from firing multiple times, but if the element is removed from DOM before the animation ends, the listener is never cleaned up. On an always-on dashboard running for weeks, accumulated orphaned listeners consume memory. The impact is small but grows over time.
**Fix:** Store listener references and remove in `disconnectedCallback` or when cancelling.

### B22. `resize()` creates new cloud particles on every resize event
**File:** `weather-fx.js:309-322`
**Severity:** ⚪ Low (mitigated)
**Reasoning:** The resize handler is debounced at 300ms, so rapid window dragging no longer triggers particle regeneration on every event. However, cloud lobe shapes are still regenerated on each resize (not preserved). For a dedicated tablet display that rarely changes resolution, this is rarely triggered. Only relevant if the dashboard is viewed on a device with dynamic orientation changes.
**Status:** Mitigated by debounce. No further action needed for fixed-display use case.

---

## Open Improvements

### I1. Accessibility (WCAG) for HA dashboard
**Severity:** 🟢 Medium
**Reasoning:** Zero ARIA attributes in the entire template. Screen readers cannot interpret toggles, chart tabs, cell bars, SOC ring, or status dots. For a personal always-on dashboard this is low priority, but if the dashboard is used by anyone with accessibility needs, it is completely unusable with assistive technology.
**Fix:** Add `role`, `aria-label`, `aria-live`, and `aria-valuenow` attributes to interactive and data-display elements.

### I2. Error boundary for init failures
**Severity:** 🟢 Medium
**Reasoning:** No try/catch around `_init()`. If initialization throws (missing entity, malformed config, HA API failure), the shadow DOM stays completely blank with no feedback. On an always-on display, a blank screen gives no indication of what went wrong — user must open browser dev tools to diagnose. A visible error message would enable self-troubleshooting.
**Fix:** Wrap `_init()` in try/catch, render an error message into the shadow DOM on failure.

### I4. HA entity discovery could use device-based lookup
**Severity:** 🟡 High
**Reasoning:** Entity discovery uses keyword scanning across ALL entity IDs (e.g., `sensor.power`, `sensor.voltage`). This is fragile — `sensor.power_consumption` (a grid sensor) could match the BMS power keyword. On an always-on dashboard with incorrect entity mapping, all displayed values are wrong and the user may not notice immediately. Device-based lookup (find the BMS device, then get its entities) is more reliable and is the HA-recommended approach.
**Fix:** Use `ha_get_device()` to find the BMS device by manufacturer/model, then enumerate its entities.

### I5. Support `weather` entity configuration
**Severity:** ⚪ Low
**Reasoning:** Weather entity is auto-discovered only. If the user has multiple weather integrations (e.g., Met.no + OpenWeatherMap), the wrong one may be selected. On an always-on display, incorrect weather data means wrong backdrop colors and particle effects running 24/7.
**Fix:** Allow weather entity override via `setConfig(config)`.

### I6. Support separate solar PV sensor
**Severity:** 🟡 High
**Reasoning:** Solar "actual" power is derived from BMS charging power, which includes grid charging. This is connected to B4. On an always-on display, users rely on this value to understand real solar production vs. grid consumption. Without a dedicated solar PV sensor, the dashboard cannot accurately report solar generation.
**Fix:** Accept `solar_entity` in `setConfig()`, fall back to BMS derivation if not provided.

### I7. HA `more-info` popups on entity taps
**Severity:** 🟢 Medium
**Reasoning:** No click handlers for `hass-more-info` events. On a touchscreen tablet (the primary use case for HA dashboards), users expect to tap a value and see its history, attributes, and controls. The lack of this interaction breaks the expected HA UX pattern.
**Fix:** Add `click` handlers that dispatch `hass-more-info` events with the relevant entity ID.

### I8. Mobile/responsive improvements
**Severity:** ⚪ Low
**Reasoning:** Breakpoint at 700px stacks to single column. Works functionally but lacks polish — chart tab padding, flow diagram spacing, and font sizes are not optimized for small screens. For a dedicated tablet display (typically 10"+), this is rarely triggered. Only relevant if viewed on a phone.
**Fix:** Tighten spacing, reduce font sizes, and adjust chart tab padding below 700px.

### I9. HA theme integration
**Severity:** ⚪ Low
**Reasoning:** Only checks `hass.themes.darkMode` and `prefers-color-scheme`, ignores HA CSS custom properties. If the user has a custom HA theme with specific colors, the dashboard does not adopt them. On an always-on display that matches the room's decor, theme mismatch is visually jarring.
**Fix:** Read HA CSS custom properties (`--primary-color`, `--card-background-color`, etc.) and apply them.

### I10. Expose card configuration via HA visual editor
**Severity:** ⚪ Low
**Reasoning:** No `getConfigElement()` method. Users must edit YAML manually to configure the card. For a personal dashboard this is acceptable, but limits adoption by non-technical HA users.
**Fix:** Implement `getConfigElement()` returning a LitElement-based config form.

### I11. Support HA energy dashboard integration
**Severity:** ⚪ Low
**Reasoning:** Not implemented. The dashboard shows real-time power flow but does not contribute data to HA's energy dashboard. Users who rely on HA's energy tracking for solar/battery statistics cannot use this card as a data source.
**Fix:** Expose entities with `state_class: total_increasing` for energy consumption/production.

### I12. Localization through HA's `hass.language`
**Severity:** ⚪ Low
**Reasoning:** All labels hardcoded in English ("Charging", "Discharging", "Solar Est.", "Cell Balance", etc.). For non-English-speaking households with an always-on display, the dashboard is partially incomprehensible.
**Fix:** Use `hass.localize()` or a translation map keyed by `hass.language`.

### I14. Improve 30D solar chart trend line
**File:** `solar-dashboard.js:1868-1871`
**Severity:** ⚪ Low
**Reasoning:** The 30D overlay uses a 7-day rolling average that includes nighttime zeros. This drags the average line down significantly, making the "7d avg" label misleading. On an always-on display where users check long-term solar trends, an inaccurate average undermines trust in the data.
**Fix:** Filter to non-zero values before averaging: `const window = actualPts.slice(...).filter(v => v > 0)`.

### I15. Make charging/discharging threshold configurable
**File:** `solar-dashboard.js:891`
**Severity:** ⚪ Low
**Reasoning:** The 0.5A threshold for detecting charging/discharging is hardcoded. For small batteries (e.g., 50Ah), 0.5A is 1% of capacity — significant. For large batteries (e.g., 300Ah), 0.5A is 0.17% — may miss trickle charging. On an always-on display, incorrect charge state detection means the status text shows "Idle" when the battery is actually trickle charging.
**Fix:** Derive threshold from battery capacity: `0.005 * battSpec.fullAh` (0.5% of capacity).

### I18. Make `BATT_SPEC` configurable via HA helpers
**File:** `ha-bridge.js:71`
**Severity:** ⚪ Low
**Reasoning:** Battery specifications (chemistry, cell count, capacity) are hardcoded. Users with non-standard battery configurations (e.g., LiFePO4 with 8 cells instead of 16) cannot customize without editing source code. On an always-on dashboard, incorrect specs lead to wrong SOC calculations and cell balance rendering.
**Fix:** Create HA helpers for battery spec overrides with auto-detection as fallback.

### NI1. Skip solar estimate at night
**File:** `solar-dashboard.js:1579-1608`
**Severity:** 🟢 Medium
**Reasoning:** `_updateSolarEstimate()` runs every 5 minutes even at night. `calcSolarOutput()` and `getDegradationInfo()` execute the full solar math pipeline (elevation, azimuth, air mass, clear-sky irradiance) regardless of sun elevation. At night, the result is always 0 watts. On an always-on dashboard, this wastes CPU cycles every 5 minutes for ~12 hours each night — ~144 unnecessary calculations per night.
**Fix:** Add early return when `sunPos.elevation <= 0`. Animate display to 0 and return.

### NI2. Cache `.dashboard-root` query
**File:** `solar-dashboard.js:1423`
**Severity:** 🟢 Medium
**Reasoning:** `this.shadowRoot.querySelector('.dashboard-root')` runs every time `_applyWeatherBackdrop()` is called (every 5 minutes) AND every frame in `_startMeshLerp()` (60fps). The element reference never changes after initialization. On an always-on dashboard, the mesh lerp alone performs ~5 million unnecessary DOM queries per day.
**Fix:** Lazy-cache in `_init()`: `this._els.dashRoot = root.querySelector('.dashboard-root')`.

### NI3. Deduplicate redundant POWER entity fetches
**File:** `solar-dashboard.js:1854-1864`
**Severity:** 🟢 Medium
**Reasoning:** When neither `CHG_POWER` nor `DISCHG_POWER` exist (fallback mode), both `loadRange` calls fetch the same `E.POWER` entity via two separate HA API calls. The data is identical but the API is hit twice. On an always-on dashboard that loads charts on init and on every tab switch, this doubles the API load unnecessarily.
**Fix:** Detect when both charts use the same entity and share the fetch result.

### NI5. Weather palette colors not configurable
**File:** `styles.js`
**Severity:** ⚪ Low
**Reasoning:** `WEATHER_PALETTES` is a hardcoded `const` with no override path. Users cannot customize mesh gradient colors without editing source code. On an always-on display that serves as room decor, users may want weather colors that match their interior design.
**Fix:** Accept `weather_colors` in `setConfig()` or expose HA `input_text` helpers for palette overrides.

---

## Open Performance Issues

### P4. Cache shadow DOM element references
**Impact:** 🟡 High — eliminates ~15+ DOM queries per update cycle
**Reasoning:** `_setIconGlow()` calls `getElementById` 3x per invocation (every power flow update). `_updateWeather()` does 5x `getElementById` per call (every 5 minutes). `_updateBattery()` uses `getElementById` for `sysFirmware`, `sysBmsModel`, `battMosfetTemp`. `_renderPack()` and `_applyBal()` use uncached `querySelectorAll` and `getElementById`. On an always-on dashboard with updates every 30-60 seconds, these redundant DOM queries accumulate to thousands per hour. Each `getElementById` triggers a DOM lookup; caching eliminates this entirely.
**Fix:** Add all remaining element IDs to the `_els` cache in `_init()`.

### P7. Single centralized animation loop
**Impact:** 🟢 Medium — reduces rAF callbacks per frame from N to 1
**Reasoning:** `_animateValue()` creates an independent `requestAnimationFrame` chain per animated value. A typical battery update triggers 13+ concurrent rAF chains (SOC, voltage, current, power, remaining, energy, cycles, throughput, min/max cell, temps, etc.). Cell balance adds 16 more (one per cell). On an always-on dashboard, this means 30+ independent rAF callbacks firing every frame during updates. While each is tracked and cancelled properly, the browser scheduler handles them separately — a single centralized loop would reduce overhead.
**Fix:** Centralized rAF loop that iterates a list of active animations in one frame. Modest impact since updates are every 30-60s, not 60fps.

### P15. Avoid re-rendering cell rows when voltage list hasn't changed
**Impact:** ⚪ Low
**Reasoning:** DOM structure is preserved when cell count is unchanged, but per-cell value updates (bar widths, class names, `_animateValue` calls) still run every time `_updateCellBalance()` is called. There is no guard comparing the new voltage array to the previous one. On an always-on dashboard, cell voltages change slowly (millivolt-level drift), so most updates produce visually identical results. Skipping unchanged arrays would eliminate unnecessary DOM writes and animations.
**Fix:** Add cached voltage snapshot comparison: `const key = voltages.join(','); if (key === this._lastCellVoltages) return;`

### P19. `WeatherFX._render` creates gradient objects every frame
**Impact:** ⚪ Low-Medium
**Reasoning:** Cloud highlight creates 7 radial gradients per frame (one per cloud particle). Rain drops create 80-240 linear gradients per frame (one per drop). Sun/moon discs create 4-6 gradients per frame. At 60fps, cloud highlights alone produce 420 gradient creations per second. Gradient objects are relatively cheap but not free — on a low-power tablet CPU, this contributes to thermal load over 24/7 operation.
**Fix:** Bake cloud highlight into offscreen canvas at spawn time (already done for cloud body). Consider simplifying rain drop gradients to solid-color strokes.

### P22. Throttle chart fetch to prevent API spam
**Impact:** 🟢 Medium
**Reasoning:** Live chart auto-refresh IS throttled to 60 seconds. However, tab clicks and visibility resume have no throttle guard — rapid tab switching or visibility toggling could trigger multiple HA API fetches in quick succession. `ChartManager._throttleMs` field exists (set to 5000) but is never checked in `loadRange()`. On an always-on dashboard, a user interacting with the tablet could inadvertently spam the HA REST API.
**Fix:** Add 2-second debounce to `_loadChartRange()`. Use or remove the unused `_throttleMs` field in `ChartManager`.

---

## Deferred Items

| Item | Reason for Deferral |
|------|-------------------|
| **B4 + I3 + I6** (solar PV sensor + config) | Must be implemented together — config support without solar sensor is premature, solar sensor without config is incomplete. Planned for a single future update. |
| **I16** (split `_updateUI()`) | Already dispatches to focused methods (`_updateBattery`, `_updatePowerFlow`, etc.). Further splitting would be cosmetic refactoring with no functional benefit. |
| **I17** (null checks in `_updatePowerFlow()`) | Defensive programming improvement. Dashboard works correctly with properly configured entities. Low priority for a personal dashboard where entity IDs are known. |
| **NI4** (cache cycle rate per day) | Already fetched hourly and cached in `this._cycleRatePerDay`. Per-day caching would make the displayed rate up to 24 hours stale — worse UX for a live dashboard. |
| **NI6** (unify chart value code paths) | Live (instant snapshot) and Historical (averaged data) are fundamentally different data sources. Unifying would add unnecessary indirection or defeat the purpose of historical averages. |
| **N3** (refreshAllUI dispatch redundancy) | Already uses dedicated methods for primary updates. Remaining `_updateUI(systemEntities)` call includes some entities already handled by `_updateBattery(snap)`. Minor cleanup only. |
| **P17** (weather discovery cache) | Runs every 5 minutes, scans 1-3 weather entities. O(N) where N is typically 1-3. Negligible cost. |
| **P23** (sunrise/sunset scan optimization) | Day-level cache exists. 1440-iteration scan runs once per day, ~5-10ms. Not a runtime concern. |
| **P33** (`_bucketize` on transitions) | Runs only on weather transitions (rare), O(N) with N<300. Negligible cost. |
| **NB4** (Math.abs vs Math.max for power/solar) | Semantically correct as-is. Power uses `Math.abs` because direction is shown separately (Charging/Discharging text). Solar uses `Math.max(0, ...)` because solar production should never be negative. |

---

## Recommended Implementation Order

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | **NB5** — Reset SOC ring stroke on unavailable | 🟡 High (fixes misleading visual on 24/7 display) | Trivial |
| 2 | **P4** — Cache remaining DOM element refs | 🟡 High (eliminates ~15+ queries per update) | Low |
| 3 | **NI1** — Skip solar estimate at night | 🟢 Medium (eliminates 144 wasted calculations/night) | Trivial |
| 4 | **NI2** — Cache `.dashboard-root` query | 🟢 Medium (eliminates 5M queries/day) | Trivial |
| 5 | **NB1** — Add fetch timeout to ISS position | 🟢 Medium (prevents hung promises) | Low |
| 6 | **NB6** — Distinguish error from no data | 🟢 Medium (enables troubleshooting) | Low |
| 7 | **P22** — Throttle `_loadChartRange()` | 🟢 Medium (prevents API spam) | Trivial |
| 8 | **NI3** — Deduplicate POWER entity fetches | 🟢 Medium (halves redundant API calls) | Low |
| 9 | **P7** — Centralized animation loop | 🟢 Medium (reduces scheduler overhead) | Medium |
