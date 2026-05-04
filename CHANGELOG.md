# Changelog

All notable changes to this project will be documented in this file.

## v0.37.9 (2026-05-04)

### Bug Fixes
- ISS API exponential backoff with circuit breaker


## v0.37.8 (2026-05-04)

### Bug Fixes
- Wrap update pipeline rAF callback in try/catch


## v0.37.7 (2026-05-04)

### Bug Fixes
- Add WebSocket disconnection detection with connection lost banner


## v0.37.6 (2026-05-04)

### Bug Fixes
- Add null guards for _updateUI, WeatherFX render, and chart canvas dimensions


## v0.37.5 (2026-05-04)

### Bug Fixes
- Add .catch() guards to toggle callService calls


## v0.37.4 (2026-05-04)

### Bug Fixes
- Clear Promise.race timeout IDs to prevent unhandled promise rejections


## v0.37.3 (2026-05-04)

### Bug Fixes
- Add .catch() to _loadChartRange calls in set hass() and tab handlers


## v0.37.2 (2026-05-04)

### Bug Fixes
- Add .catch() to all fire-and-forget async calls to prevent unhandled promise rejections


## v0.37.1 (2026-05-04)

### Bug Fixes
- Resolve WeatherFX state reference error and uncaught promise rejections


## v0.37.0 (2026-05-04)

### Features
- Add I2 error boundary for init failures and I4 device-based BMS entity discovery


## v0.36.0 (2026-05-04)

### Features
- Expand I12 localization to 20 languages with full template i18n and dynamic language change detection


## v0.35.2 (2026-05-04)

### Bug Fixes
- I12 regression - declare lang in _loadChartRange


## v0.35.1 (2026-05-04)

### Bug Fixes
- I12 regression - declare lang in _updateUI, _updateCellBalance, _applyBal, _refreshAllUI


## v0.35.0 (2026-05-04)

### Features
- Add 500px breakpoint with tighter spacing and font sizes for phone screens (I8)


## v0.34.0 (2026-05-04)

### Features
- Add localization support for dynamic UI labels via hass.language (I12)


## v0.33.0 (2026-05-04)

### Features
- Derive charging/discharging idle threshold from battery capacity (I15)


## v0.32.0 (2026-05-04)

### Features
- Filter nighttime zeros from 30D solar chart 7-day rolling average (I14)


## v0.31.23 (2026-05-04)

### Bug Fixes
- Skip cell balance re-render when voltage array unchanged (P15)


## v0.31.22 (2026-05-04)

### Bug Fixes
- Use lerped _moonBrightCur for star overlay dimming instead of raw _moonBrightness (NI18)


## v0.31.21 (2026-05-04)

### Bug Fixes
- Reset _newParticlesCreated flag in stop() for cleanliness (NI17)


## v0.31.20 (2026-05-04)

### Bug Fixes
- Cancel _updateRafId on disconnect to prevent callback on detached shadowRoot (NI12)


## v0.31.19 (2026-05-04)

### Bug Fixes
- Reset _cardsRevealed on disconnect to re-animate entrance sequence (NI11)


## v0.31.18 (2026-05-04)

### Bug Fixes
- Show distinct 'Fetch error' vs 'No data available' on chart canvases (NI10)


## v0.31.17 (2026-05-04)

### Bug Fixes
- Replace ctx.save/restore with manual globalAlpha save for cloud blit (P28)


## v0.31.16 (2026-05-04)

### Bug Fixes
- Change console.log to console.debug for helper creation messages (NI7)


## v0.31.15 (2026-05-04)

### Bug Fixes
- Remove redundant _updateWeather() call on visibility resume (NI16)


## v0.31.14 (2026-05-04)

### Bug Fixes
- Remove unused _cloudCanvasPool Map (NI13)


## v0.31.13 (2026-05-04)

### Bug Fixes
- Add 15s timeout to HA WebSocket history/stats fetch calls (NI14)


## v0.31.12 (2026-05-04)

### Bug Fixes
- Show error placeholder on chart canvases when fetch fails (NI9)


## v0.31.11 (2026-05-04)

### Bug Fixes
- Skip solar estimate at night, deduplicate POWER fetches, centralized animation loop
- P7: Single centralized animation loop — replaces 30+ independent rAF chains with one loop iterating all active animations per frame
- NI3: Deduplicate POWER entity fetches — when CHG_POWER and DISCHG_POWER both missing, fetch E.POWER once instead of twice
- NI1: Skip solar estimate at night — early return when sun elevation <= 0, avoiding ~144 wasted calcSolarOutput/getDegradationInfo calls per night
- Ignore .superpowers, .tmp, and MEMORY.md in .gitignore


## v0.31.9 (2026-05-04)

### Bug Fixes
- Remove double-applied wind on fog blobs (C10)


## v0.31.8 (2026-05-04)

### Bug Fixes
- Include cloud cover and ambient temp in forecast cache key (C8)


## v0.31.7 (2026-05-04)

### Bug Fixes
- Add canvas context loss/restore handling (C5)


## v0.31.6 (2026-05-04)

### Bug Fixes
- Wrap weather-fx rAF loop in try/catch for error recovery (C4)


## v0.31.5 (2026-05-04)

### Bug Fixes
- Cloud archetype threshold now triggers on coverage changes (C7)


## v0.31.4 (2026-05-04)

### Bug Fixes
- Guard NaN moon brightness to prevent corrupted moon rendering (C9)


## v0.31.3 (2026-05-04)

### Bug Fixes
- Clamp windFactor lower bound to prevent negative wind reversing particles (C3)


## v0.31.2 (2026-05-04)

### Bug Fixes
- 6 partially-addressed items from analysis.md Pass 9


## v0.31.1 (2026-05-04)

### Bug Fixes
- _updateSunMoonPosition dead code (C1) and NaN wind bearing (C2)


## v0.31.0 (2026-05-03)

### Features
- Integrate HA theme CSS custom properties (I9)


## v0.30.3 (2026-05-03)

### Bug Fixes
- FetchHistoryRange error handling (NB6) and animation listener cleanup (B21)


## v0.30.2 (2026-05-03)

### Bug Fixes
- ISS fetch timeout (NB1), SOC ring stroke reset (NB5), innerHTML comparison (NB3)
- Remove docs/ from tracking (gitignored)


## v0.30.1 (2026-05-03)

### Bug Fixes
- Weather particle fade loop (B23) and mesh lerp convergence (NB2)


## v0.30.0 (2026-04-20)

### Features
- Add 5-minute periodic weather refresh interval
- Overlapping fade transition eliminates blank-frame gap on weather change
- Regenerate cloud particles when coverage crosses archetype thresholds
- Snowflakes react to live wind changes in render loop
- Fog blobs react to live wind changes in render loop
- Add wind lerp for smooth acceleration/deceleration in weather particles
- Detect weather attribute changes via last_changed in getChangedEntities


## v0.29.5 (2026-04-20)

### Bug Fixes
- Rebuild dist after ts->now fix
- Replace undefined ts with now in _render() halo shimmer code


## v0.29.4 (2026-04-20)

### Bug Fixes
- Animate solar halo with lerped strength and shimmer
- Weather-fx.js
- Weather-fx.js
- Weather-fx.js


## v0.29.3 (2026-04-20)

### Bug Fixes
- Cache wind vars once per weather update; deduplicate getVal calls in _updateUI
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Weather-fx.js
- Weather-fx.js
- Weather-fx.js
- Weather-fx.js
- Weather-fx.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js
- Solar-dashboard.js


## v0.29.2 (2026-04-19)

### Bug Fixes
- Round throughput kWh to nearest integer
- Solar-dashboard.js


## v0.29.1 (2026-04-19)

### Bug Fixes
- Cache weather params in _applyWeatherBackdrop; fix dawn backdrop bug; tighten sun/moon update to 10s


## v0.29.0 (2026-04-19)

### Features
- Add planets, Milky Way, and ISS to night sky


## v0.28.4 (2026-04-19)

### Bug Fixes
- Physics-based moon sky-wash using sin(sunElevation)


## v0.28.3 (2026-04-19)

### Bug Fixes
- Natural moon daytime visibility via sky-wash factor


## v0.28.2 (2026-04-19)

### Bug Fixes
- Hide moon disc when sun is above 5deg elevation


## v0.28.1 (2026-04-19)

### Bug Fixes
- Guard _updateSunMoonPosition against undefined hass


## v0.28.0 (2026-04-19)

### Features
- Continuous smooth transitions for all weather/day-night animations


## v0.27.0 (2026-04-19)

### Features
- Smooth sun/moon position interpolation with 60s update interval


## v0.26.0 (2026-04-19)

### Features
- Add setConfig and getStubConfig for HA card compatibility


## v0.25.6 (2026-04-19)

### Bug Fixes
- Cache DOM lookups and entity scans; move BATT_SPEC to instance; guard chart load errors


## v0.25.5 (2026-04-19)

### Bug Fixes
- Soften halo inner edge with transparent gradient stop


## v0.25.4 (2026-04-18)

### Bug Fixes
- Apply B9/B11/B21 bug fixes; revert false-positive B2


## v0.25.3 (2026-04-18)

### Bug Fixes
- Resolve all remaining non-deferred bugs (B2, B11, B14, B16, B21, B23, B24)


## v0.25.2 (2026-04-18)

### Bug Fixes
- Cache hot paths and fix graceful degradation across all modules


## v0.25.1 (2026-04-18)

### Bug Fixes
- Sun shafts radiate away from sun toward canvas center


## v0.25.0 (2026-04-18)

### Features
- Realistic directional sun shaft animation


## v0.24.1 (2026-04-18)

### Bug Fixes
- Apply quick-win bug fixes and performance improvements
- Update rain particle system documentation


## v0.24.0 (2026-04-17)

### Features
- Rebuild dist for rain intensity & wind reactivity
- Wire rain render blocks to _renderDrops
- Add _renderDrops gradient stroke helper
- Unify drop spawn with severity-driven formula
- Add RAIN_SEVERITY constant map


## v0.23.3 (2026-04-17)

### Bug Fixes
- Arc canvas height + energized flow line glow scaling with power


## v0.23.2 (2026-04-17)

### Bug Fixes
- Battery arc color updates correctly when charge/discharge state changes


## v0.23.1 (2026-04-17)

### Bug Fixes
- Arc canvas sizing to match wrap dimensions so arcs render on flow line


## v0.23.0 (2026-04-17)

### Features
- Electric arc effect on flow lines, continuous power-responsive scaling


## v0.22.1 (2026-04-17)

### Bug Fixes
- Randomise flow dot initial positions to prevent clustering


## v0.22.0 (2026-04-17)

### Features
- Expand flow particles to 20 dots with continuous 2→20 scaling


## v0.21.0 (2026-04-17)

### Features
- Continuous flow particle scaling + throughput in kWh (Ah)


## v0.20.2 (2026-04-14)

### Bug Fixes
- Screen composite halo + linear-gradient rays for professional atmospheric look


## v0.20.1 (2026-04-14)

### Bug Fixes
- Radial-gradient halo ring with inner darkening for solar and lunar halos


## v0.20.0 (2026-04-14)

### Features
- Use CHG_POWER/DISCHG_POWER sensors for Today In/Out, fall back to signed current


## v0.19.6 (2026-04-14)

### Bug Fixes
- RAF debounce chart mousemove to cap redraws at 60fps


## v0.19.5 (2026-04-14)

### Bug Fixes
- Atmospheric halo strokes, 360-degree rays, crepuscular elevation fade


## v0.19.4 (2026-04-14)

### Bug Fixes
- Cloud offscreen bounds, sun disc gradient, bloom ring, glow alpha


## v0.19.3 (2026-04-14)

### Bug Fixes
- Live charts, today totals, cloud/sun/halo visuals, sun ray origin


## v0.19.2 (2026-04-14)

### Bug Fixes
- Recognise perf commits as patch bumps, opt into Node 24 actions
- Perf/fix: pause animations on hide, debounce hass, cache chart snapshots, fix tz calc


## v0.19.1 (2026-04-13)

### Bug Fixes
- Show 0 kWh expected generation after sunset until sunrise


## v0.19.0 (2026-04-13)

### Features
- Cloud archetypes, procedural lobes, per-lobe shading, wind reactivity, y-bob
- Exclude docs folder from git tracking


## v0.18.1 (2026-04-13)

### Bug Fixes
- Correct night cloud rendering and star occlusion by clouds
- Remove implemented plans and specs
- Cloud system redesign spec
- Update README features list for weather effects improvements


## v0.18.0 (2026-04-13)

### Features
- Wind bearing drives actual particle direction
- Continuous cloud-coverage dimming via sigmoid formula
- Volumetric multi-lobe cloud rendering
- Volumetric multi-lobe cloud rendering
- Rainbow arc for rainy/pouring daytime conditions
- Solar and lunar 22-degree halo ring
- Apply decayMult to child bolt branch alpha in _drawBolt
- Branching lightning bolts with 120ms screen flash
- Bokeh hexagonal aperture blade lines
- Stratified fog layers with sine turbulence
- Hexagonal snowflake geometry with rotating arms
- Reset aurora shadowBlur inside forEach to prevent canvas state leak
- Aurora moon brightness dimming factor 0.3 → 0.65
- Smooth aurora with quadratic curves and vertical oscillation
- Star colour variance by spectral class
- Expand plan with 3 new tasks and enhancements to tasks 1/3/7
- Particle type buckets eliminate per-frame filter calls
- Add weather effects improvements implementation plan
- Add weather effects improvements design spec [skip ci]
- Add missing features and fix helpers table in README


## v0.17.6 (2026-04-13)

### Bug Fixes
- Raise diffuse sun glow alpha to show through mesh gradient backdrop


## v0.17.5 (2026-04-13)

### Bug Fixes
- Brighter diffuse sun glow for overcast conditions, wider scatter radius


## v0.17.4 (2026-04-13)

### Bug Fixes
- Use CHANGELOG entry as release body, strip commit prefixes from changelog


## v0.17.3 (2026-04-13)

### Bug Fixes
- fix: improve sun/moon glow visibility through overcast and precipitation conditions


## v0.17.2 (2026-04-09)

### Bug Fixes
- fix: compact 4-col info-row on mobile, smaller inf fonts


## v0.17.1 (2026-04-09)

### Bug Fixes
- fix: 2-col mobile layout for stat-grid and info-row at 700px


## v0.17.0 (2026-04-09)

### Features
- feat: increase sun and moon disc sizes


## v0.16.0 (2026-04-08)

### Features
- feat: add medium breakpoint (768px) with 2-column grid layout for tablets
- chore: sync hacs.json version with package.json via npm version lifecycle hook
- docs: remove hardcoded sensor.moon_phase reference, note auto-discovery
- refactor: auto-discover moon phase entity instead of hardcoding sensor.moon_phase
- docs: update README with sun/moon discs, wind-reactive particles, Moon integration


## v0.15.0 (2026-04-08)

### Features
- feat: add sun/moon discs with real positions, wind-reactive particles, moon phase
- chore: add CLAUDE.md and .claude/ to gitignore


## v0.14.0 (2026-04-07)

### Features
- feat: add priority-based weather discovery with Google preference and staleness detection


## v0.13.1 (2026-04-07)

### Bug Fixes
- fix: DST midnight calc, chemistry cell bounds, WeatherFX rAF, crosshair cleanup, entity warning


## v0.13.0 (2026-04-06)

### Features
- feat(weather): daytime backdrop boost, source indicator, dynamic opacity


## v0.12.1 (2026-04-06)

### Bug Fixes
- fix(weather): fix fog backdrop mismap and increase cloudy particle opacity
- docs: update README to reflect auto weather entity selection


## v0.12.0 (2026-04-06)

### Features
- feat(weather): auto-select freshest weather entity by last_changed


## v0.11.4 (2026-04-06)

### Bug Fixes
- fix(bugs): fix chart NaN crash on empty data and weather fade zombie RAF


## v0.11.3 (2026-04-06)

### Bug Fixes
- fix(weather): Fix backdrop and overlay consistency for day/night conditions


## v0.11.2 (2026-04-06)

### Bug Fixes
- fix(styles): Fix weather backdrop mesh gradient not rendering


## v0.11.1 (2026-04-05)

### Bug Fixes
- fix(battery): show cycle rate as per-day average from 7-day rolling window


## v0.11.0 (2026-04-05)

### Features
- feat(battery): show 7-day rolling cycle rate inline with cycle count


## v0.10.2 (2026-04-05)

### Bug Fixes
- fix(mobile): correct cell number decimal, x-axis time labels, and y-axis duplicate labels


## v0.10.1 (2026-04-05)

### Bug Fixes
- fix(charts): exclude partial current day from 30D/7D and replace flat solar estimate with 7d rolling avg


## v0.10.0 (2026-04-05)

### Features
- feat: add day/night variants for all weather conditions and overlays


## v0.9.0 (2026-04-05)

### Features
- feat: add sleet particles, windy/snowy-rainy conditions, and night overlay


## v0.8.2 (2026-04-05)

### Bug Fixes
- fix: align night backdrop gradient with particle behavior


## v0.8.1 (2026-04-05)

### Bug Fixes
- fix: resolve 6 bugs — weather particles, listener leak, card reveal, time display, chart edge cases


## v0.8.0 (2026-04-05)

### Features
- feat: add staggered arrow animation to balancing indicator text


## v0.7.0 (2026-04-05)

### Features
- feat: replace canvas balancing animation with cell bar level animation


## v0.6.2 (2026-04-04)

### Bug Fixes
- fix: use total_runtime_formatted keyword for human-readable runtime display


## v0.6.1 (2026-04-04)

### Bug Fixes
- fix: move balancing canvas to cover cells grid instead of status bar


## v0.6.0 (2026-04-04)

### Features
- feat: add canvas-based balancing energy flow animation between highest and lowest cells


## v0.5.2 (2026-04-04)

### Bug Fixes
- fix: widen LFP voltage detection range to 3.65V to avoid false NMC detection at full charge


## v0.5.1 (2026-04-04)

### Bug Fixes
- fix: remove debug logging and fix hasKeyEntities boolean check
- docs: update README with battery chemistry detection and new entity roles


## v0.5.0 (2026-04-04)

### Features
- feat: add dynamic battery chemistry detection from BMS entity with voltage-based fallback


## v0.4.11 (2026-04-04)

### Bug Fixes
- fix: handle signed POWER fallback correctly — power chart uses negative values, solar chart uses positive values


## v0.4.10 (2026-04-04)

### Bug Fixes
- fix: allow solar chart to load without SOC entity; make SOC fetch optional in loadRange
- debug: add logging to trace entity discovery and chart loading


## v0.4.9 (2026-04-04)

### Bug Fixes
- fix: re-run entity discovery until key entities (POWER, SOC) are found


## v0.4.8 (2026-04-04)

### Bug Fixes
- fix: retry chart loading after entity discovery completes


## v0.4.7 (2026-04-04)

### Bug Fixes
- fix: add entity validation guards to prevent chart errors when discovery is incomplete


## v0.4.6 (2026-04-04)

### Bug Fixes
- fix: align solar chart estimated line units with actual data for 7D/30D views


## v0.4.5 (2026-04-03)

### Bug Fixes
- fix: use statistics API for Yesterday chart to show regular intervals instead of state-change-only history


## v0.4.4 (2026-04-03)

### Bug Fixes
- fix: use > 0 instead of != null for power value fallbacks to skip zero readings


## v0.4.3 (2026-04-03)

### Bug Fixes
- fix: animateValue early return blocked zero-value power display; add CHG_POWER/DISCHG_POWER to fallback map


## v0.4.2 (2026-04-03)

### Bug Fixes
- fix: restore charging_power/discharging_power to POWER_EXCLUDE; fix power chart filter for positive-only values
- docs: add missing changelog entries for v0.1.14 and v0.1.15
- docs: fill missing changelog entries for v0.2.0 through v0.4.1
- ci: auto-update CHANGELOG.md in release workflow


## v0.4.1 (2026-04-04)

### Bug Fixes
- use explicit null checks instead of ?? for power values that can be zero

## v0.4.0 (2026-04-04)

### Features
- merge system card into battery card, use CHG_POWER/DISCHG_POWER entities, show absolute power/current

## v0.3.1 (2026-04-04)

### Bug Fixes
- exclude overly-specific power/current keyword matches in BMS discovery

## v0.3.0 (2026-04-04)

### Features
- replace hardcoded BMS entities with keyword auto-discovery and dynamic prefix fallback

### Documentation
- update README for BMS auto-discovery and multi-integration support

## v0.2.1 (2026-04-04)

### Bug Fixes
- calculate daily kWh estimate for 7D/30D solar chart instead of flat noon snapshot

## v0.2.0 (2026-04-04)

### Features
- real-time chart value updates for Live view, averages for historical views

## v0.1.15 (2026-04-03)

### Bug Fixes
- align chart estimated solar line with hero weather-adjusted estimate

## v0.1.14 (2026-04-03)

### Bug Fixes
- correct chart tooltip Y positioning and fix 30D estimated solar line

## v0.1.13 (2026-04-03)

### CI/CD
- use conventional commit-based version bumping in release workflow

## v0.1.12 (2026-04-03)

### Refactoring
- make dashboard the single source of truth for weather palettes

## v0.1.11 (2026-04-03)

### Bug Fixes
- remove duplicate altitude unit conversion (meters→km was applied twice)

## v0.1.10 (2026-04-03)

### Bug Fixes
- correct elevation property name and add weather-fx destroy method

## v0.1.9 (2026-04-03)

### Features
- make panel model, type, dimensions, and install date dynamic via helpers

## v0.1.8 (2026-04-03)

### Bug Fixes
- display SOC value as whole number in analytics

## v0.1.7 (2026-04-03)

### Bug Fixes
- remove decimal points from SOC chart labels

## v0.1.6 (2026-04-03)

### Build
- update dist with 1-decimal temperature precision

## v0.1.5 (2026-04-03)

### Bug Fixes
- display temperatures with 1 decimal precision

## v0.1.4 (2026-04-02)

### Bug Fixes
- light mode contrast, chart tooltips, estimated solar line

## v0.1.3 (2026-04-02)

### Bug Fixes
- strip Userda prefix from BMS model; display today in/out as kWh

## v0.1.2 (2026-04-02)

### Bug Fixes
- resolve multiple display bugs in solar dashboard

## v0.1.1 (2026-04-02)

### Bug Fixes
- map HA history/stats API responses to {t,v} format for charts; fix weather canvas initial size

## v0.1.0 (2026-04-02)

### Features
- solar dashboard v10 — HACS-compatible HA custom panel

### Bug Fixes
- use weatherFx.start() instead of non-existent update() method

### Documentation
- clarify HACS vs Manual installation paths in README

### CI/CD
- add GitHub Actions workflow to build and release on version tags
- auto-bump patch version and create incremental release on every push to master
