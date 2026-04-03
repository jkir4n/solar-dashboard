# Changelog

All notable changes to this project will be documented in this file.

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
