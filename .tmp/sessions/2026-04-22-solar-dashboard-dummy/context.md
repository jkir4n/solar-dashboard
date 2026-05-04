# Task Context: Solar Dashboard Dummy Replica

Session ID: 2026-04-22-solar-dashboard-dummy
Created: 2026-04-22T21:00:00Z
Status: in_progress

## Current Request
Replicate the solar-dashboard project in a different folder outside of the current folder and populate it with dummy values. Include live-updating dummy values, all chart ranges with synthetic history data, and a standalone HTML bootstrap so it runs without Home Assistant.

## Context Files (Standards to Follow)
- No internal context files discovered
- Project docs: CLAUDE.md, README.md

## Reference Files (Source Material to Look At)
- package.json
- rollup.config.js
- hacs.json
- src/solar-dashboard.js (main component)
- src/ha-bridge.js (HA bridge — primary substitution target)
- src/solar-engine.js (pure math, no changes needed)
- src/weather-fx.js (pure canvas, no changes needed)
- src/charts.js (pure canvas, no changes needed)
- src/styles.js (pure CSS, no changes needed)

## External Docs Fetched
None — self-contained vanilla JS project.

## Components
1. **Project scaffolding** — copy package.json, rollup.config.js, hacs.json, build scripts
2. **Mock HA Bridge** — synthetic entity states, change detection, history/statistics mock
3. **Bootstrap HTML** — standalone page that injects mock bridge into custom element
4. **Dummy data generators** — battery cycling, weather rotation, solar curves, chart data
5. **Adapted entry point** — solar-dashboard.js modified to accept mock bridge

## Constraints
- Must run standalone in a browser without Home Assistant
- Should look and behave like the real dashboard
- Dummy values should be realistic and slowly varying
- All 4 chart ranges must work (Live, Yesterday, 7 Days, 30 Days)

## Exit Criteria
- [ ] Replica folder created outside current repo
- [ ] npm install works in replica
- [ ] npm run build produces dist/solar-dashboard.js
- [ ] index.html opens and renders dashboard with dummy data
- [ ] Weather effects animate (particles, sun/moon)
- [ ] Charts load synthetic data for all ranges
- [ ] Battery values slowly update over time
