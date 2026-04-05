# Changelog

All notable changes to this project will be documented in this file.

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
