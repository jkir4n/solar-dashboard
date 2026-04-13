# Solar Dashboard for Home Assistant

A real-time solar monitoring dashboard for Home Assistant, built as a HACS-compatible custom panel. Displays battery status (JK BMS, JBD, Daly, and more), solar generation forecasts (NOAA-based), weather-reactive backgrounds, and historical charts -- all in a single full-page panel.

## Features

- Auto-discovering BMS monitoring — works with JK, JBD, Daly, BatMON and other integrations (no hardcoded entity IDs)
- NOAA/Meeus solar position and irradiance calculations
- Weather-adjusted solar generation forecasts
- Procedural weather particle effects (rain, snow, stars, clouds, lightning, fog) with adaptive intensity
- Hexagonal snowflakes with rotating 6-arm crystal geometry and depth-scaled branching
- Volumetric multi-lobe clouds with 3-pass compositing (lighter/multiply/screen) and Z-depth layering
- Branching lightning bolts (30% child probability) with 120ms blue-white screen flash per strike
- Stratified fog with 4 depth layers, per-layer speed, and sine-wave turbulence
- Rainbow arc at antisolar point during rainy/pouring daytime conditions (3s fade-in)
- Real-time sun disc with elevation-based colour shift (orange at horizon → white at zenith), cloud occlusion, and 22° solar halo ring
- Real-time moon disc with Meeus lunar position, phase brightness, cloud occlusion, and 22° lunar halo ring
- Day overlay: sun rays rendered behind all daytime conditions, alpha scaled by cloud cover
- Night overlay: stars with spectral colour variance (O/B/F/G/K/M classes) and smooth aurora curtain with vertical gradient and red lower fringe, dimmed by moon brightness
- Wind and bearing-reactive particles — rain streaks, snow drift, fog, and sleet all track live `wind_speed` and `wind_bearing` from weather entity
- Continuous cloud dimming via sigmoid formula on live `cloud_coverage` % (replaces discrete lookup tables)
- Custom canvas charts with crosshair/tooltip (Live, Yesterday, 7D, 30D ranges)
- Power flow animation between solar, battery, and load
- Animated number transitions
- Dark and light themes with glassmorphism styling
- Responsive layout
- Auto-created HA helpers for panel and BMS configuration
- Native HA integration via `hass` object (no tokens or manual WebSocket)

## Prerequisites

- **Home Assistant 2025.1.0+**
- **BMS integration** — JK BMS (ESPHome), JBD, Daly, BatMON, or any integration providing BMS sensor data
- **Weather integration** — Any HA weather integration (Google Weather, PirateWeather, Met.no, etc.) for cloud cover, conditions, and wind speed. The dashboard auto-selects the freshest available source.
- **Moon integration** (optional) — Built-in HA integration for moon phase brightness. Enable via Settings → Devices & Services → Add Integration → "Moon". The dashboard auto-discovers the moon phase entity — no configuration needed.
- **HACS** (optional) — for automated installation and updates

## Installation

### Via HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three-dot menu (top right) -> **Custom repositories**
3. Add the repository URL, select category **Lovelace**
4. Click **Download** on the Solar Dashboard card
5. Add the panel configuration (see below)
6. Restart Home Assistant

### Manual Installation

1. Download `solar-dashboard.js` from the [latest release](../../releases/latest)
2. Copy it to `/config/www/solar-dashboard/solar-dashboard.js` on your HA instance
3. Add the panel configuration (see below)
4. Restart Home Assistant

## Configuration

Add this to your `configuration.yaml`.

**If you installed via HACS (Recommended):**
```yaml
panel_custom:
  - name: solar-dashboard
    url_path: solar
    sidebar_title: Solar
    sidebar_icon: mdi:solar-power
    module_url: /local/community/solar-dashboard/solar-dashboard.js
```

**If you installed manually:**
```yaml
panel_custom:
  - name: solar-dashboard
    url_path: solar
    sidebar_title: Solar
    sidebar_icon: mdi:solar-power
    module_url: /local/solar-dashboard/solar-dashboard.js
```

Restart Home Assistant after adding the configuration.

## Solar Panel Configuration

The dashboard auto-creates the following HA helpers on first load (requires admin user). Adjust them via **Settings -> Helpers**:

| Helper | Default | Range | Unit | Description |
|--------|---------|-------|------|-------------|
| `input_number.solar_panel_count` | 6 | 1–100 | panels | Number of solar panels |
| `input_number.solar_panel_rated_watts` | 585 | 50–1000 | W | Rated wattage per panel |
| `input_number.solar_panel_efficiency` | 22.6 | 5–30 | % | Panel efficiency |
| `input_number.solar_panel_tilt` | 7.5 | 0–90 | ° | Panel tilt angle |
| `input_number.solar_panel_azimuth` | 220 | 0–360 | ° | Panel azimuth (south=180) |
| `input_number.solar_panel_width` | 2.278 | 0.5–3 | m | Panel width (for area calculation) |
| `input_number.solar_panel_height` | 1.134 | 0.5–2 | m | Panel height (for area calculation) |
| `input_text.solar_panel_model` | NOVA585TG144 | — | — | Panel model name (display only) |
| `input_text.solar_panel_type` | TOPCon | — | — | Panel technology type (display only) |

If you are not an admin user, helpers cannot be auto-created. The dashboard will use hardcoded defaults and log a warning. An admin can create the helpers manually via Settings -> Helpers.

## BMS Entity Discovery

The dashboard automatically discovers BMS entities through keyword matching — no manual configuration required. It scans all `hass.states` entities and matches them against known BMS naming patterns across multiple integrations:

### Supported BMS Integrations

| Integration | Example Entity ID Pattern |
|-------------|--------------------------|
| JK BMS (ESPHome) | `sensor.jk_bms_jk_bms_capacity_remaining` |
| JBD / Xiaoxiang | `sensor.jbd_bms_state_of_charge` |
| Daly BMS | `sensor.daly_bms_total_voltage` |
| BatMON Add-on | `sensor.battery1_capacity_remaining` |

### Discovery Tiers

1. **Keyword Auto-Discovery** (primary) — Scans all entities, matches by keyword in entity_id and friendly_name. Works with any BMS integration using standard naming conventions.

2. **BMS Prefix Helper** (fallback, lazy) — If keyword discovery finds fewer than 5 entities, the dashboard auto-creates `input_text.bms_entity_prefix` (default: `jk_bms_jk_bms`) to construct entity IDs. You can change this helper to match your BMS naming convention.

### Dynamic Re-Discovery

The dashboard re-discovers entities when `input_text.bms_entity_prefix` changes, allowing you to switch BMS configurations without restarting.

### Discovered Entity Roles

| Role | Entity Type | Keyword Match |
|------|-------------|---------------|
| SOC | sensor | `capacity_remaining` |
| Voltage | sensor | `total_voltage` |
| Current | sensor | `current` |
| Power | sensor | `power` |
| Remaining Ah | sensor | `capacity_remaining_derived` |
| Cycles | sensor | `charging_cycles` |
| Runtime | sensor | `total_runtime` |
| Throughput | sensor | `total_charging_cycle_capacity` |
| Min/Max Cell Voltage | sensor | `min_cell_voltage`, `max_cell_voltage` |
| Min/Max Voltage Cell | sensor | `min_voltage_cell`, `max_voltage_cell` |
| Firmware | sensor | `software_version` |
| Temperature 1/2 | sensor | `temperature_sensor_1`, `temperature_2` |
| MOSFET Temperature | sensor | `power_tube_temperature` |
| Battery Strings | sensor | `battery_strings`, `cell_count` |
| Manufacturer | sensor | `manufacturer` |
| Battery Type | sensor | `battery_type` |
| Cell Voltages (1–N) | sensor | `cell_voltage_1` through `cell_voltage_N` |
| Balancing | binary_sensor | `balancing` |
| Balancing Switch | binary_sensor | `balancing_switch` |
| Charging Switch | switch | `charging` |
| Discharging Switch | switch | `discharging` |
| Charging Power | sensor | `charging_power` |
| Discharging Power | sensor | `discharging_power` |

### Battery Chemistry Detection

The dashboard automatically detects battery chemistry using two methods:

1. **Primary**: `battery_type` entity from the BMS (available on JK BMS)
2. **Fallback**: Voltage-per-cell calculation (`total_voltage / strings`)

| Detected Chemistry | Volts/Cell | Example (16S) |
|-------------------|------------|---------------|
| LiFePO₄ | 3.2V | 51.2V |
| NMC / Li-ion | 3.7V | 59.2V |
| LTO | 2.3V | 36.8V |

The detected chemistry is displayed in the battery card and used to calculate the correct nominal voltage.

## Required Entities

The dashboard reads from these entity groups:

- **BMS entities** — Auto-discovered via keyword matching (see table above). No hardcoded entity IDs required.
- **`weather.*`** — Cloud cover, weather condition, and wind speed (for solar forecast adjustment, weather effects, and wind-reactive particles). The dashboard automatically selects the most recently updated `weather.*` entity, skipping unavailable ones — no manual configuration needed.
- **Moon phase sensor** (optional) — Moon phase for disc brightness. Provided by the built-in Moon integration. Auto-discovered by state value — no hardcoded entity ID.
- **`input_number.solar_*`** — Panel configuration helpers (auto-created)
- **`zone.home`** — Location for solar position calculations (uses `hass.config` lat/lon as primary)

## Troubleshooting

**Dashboard doesn't appear in sidebar:**
- Verify the `panel_custom` entry in `configuration.yaml` is correctly formatted
- Ensure you restarted HA after adding the config
- Check the file path matches where you placed the JS file

**"Not admin" warning / helpers not created:**
- Log in as an admin user for the first load to trigger helper auto-creation
- Alternatively, create the helpers manually via Settings -> Helpers

**No battery data showing:**
- Verify a BMS integration is installed (JK BMS, JBD, Daly, BatMON, etc.)
- Check that BMS entities are available in Developer Tools -> States
- If using a non-standard BMS integration, set `input_text.bms_entity_prefix` to match your entity naming pattern

**Weather effects not showing:**
- Ensure at least one weather integration is configured and has a non-unavailable `weather.*` entity
- Check Developer Tools -> States for any `weather.*` entity — the dashboard picks the freshest one automatically
- If all weather entities show `unavailable`, check the integration's API key or connectivity

**Console errors:**
- Open browser Developer Tools (F12) -> Console tab
- Check for JavaScript errors and report them as issues

## Development

Build from source:

```bash
# Install dependencies
npm install

# Build the bundle
npm run build

# Output: dist/solar-dashboard.js
```

The project uses Rollup to bundle the ES modules in `src/` into a single distributable file.

### Source Structure

```
src/
  ha-bridge.js        # HA state access, helper management, history fetching
  solar-engine.js     # NOAA/Meeus solar + lunar position and irradiance calculations
  weather-fx.js       # Canvas particle systems, weather backdrops, sun/moon discs
  charts.js           # Custom canvas charting with crosshair/tooltip
  styles.js           # All CSS (dark/light themes, glassmorphism)
  solar-dashboard.js  # Main Web Component, DOM, UI updates
```

## License

MIT
