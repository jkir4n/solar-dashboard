# Solar Dashboard for Home Assistant

A real-time solar monitoring dashboard for Home Assistant, built as a HACS-compatible custom panel. Displays battery status (JK BMS), solar generation forecasts (NOAA-based), weather-reactive backgrounds, and historical charts -- all in a single full-page panel.

## Features

- Real-time battery monitoring (SOC, voltage, current, power, temperature, cell balance)
- NOAA/Meeus solar position and irradiance calculations
- Weather-adjusted solar generation forecasts
- Procedural weather particle effects (rain, snow, stars, clouds, lightning)
- Custom canvas charts with crosshair/tooltip (Live, Yesterday, 7D, 30D ranges)
- Power flow animation between solar, battery, and load
- Animated number transitions
- Dark and light themes with glassmorphism styling
- Responsive layout
- Auto-created HA helpers for panel configuration
- Native HA integration via `hass` object (no tokens or manual WebSocket)

## Prerequisites

- **Home Assistant 2025.1.0+**
- **JK BMS integration** -- provides `sensor.jk_bms_*` entities for battery data
- **Weather integration** -- PirateWeather (preferred) or Met.no for cloud cover and conditions
- **HACS** (optional) -- for automated installation and updates

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

Add this to your `configuration.yaml`:

```yaml
panel_custom:
  - name: solar-dashboard
    url_path: solar
    sidebar_title: Solar
    sidebar_icon: mdi:solar-power
    module_url: /local/solar-dashboard/solar-dashboard.js
```

> **Note:** If installed via HACS, use this path instead:
> `module_url: /local/community/solar-dashboard/solar-dashboard.js`

Restart Home Assistant after adding the configuration.

## Solar Panel Configuration

The dashboard auto-creates the following HA helpers on first load (requires admin user). Adjust them via **Settings -> Helpers**:

| Helper | Default | Range | Unit | Description |
|--------|---------|-------|------|-------------|
| `input_number.solar_panel_count` | 6 | 1-100 | panels | Number of solar panels |
| `input_number.solar_panel_rated_watts` | 585 | 50-1000 | W | Rated wattage per panel |
| `input_number.solar_panel_efficiency` | 22.6 | 5-30 | % | Panel efficiency |
| `input_number.solar_panel_tilt` | 7.5 | 0-90 | degrees | Panel tilt angle |
| `input_number.solar_panel_azimuth` | 220 | 0-360 | degrees | Panel azimuth (south=180) |

If you are not an admin user, helpers cannot be auto-created. The dashboard will use hardcoded defaults and log a warning. An admin can create the helpers manually via Settings -> Helpers.

## Required Entities

The dashboard reads from these entity groups:

- **`sensor.jk_bms_*`** -- Battery SOC, voltage, current, power, temperatures, cell voltages
- **`weather.*`** -- Cloud cover and weather condition (for solar forecast adjustment and weather effects)
- **`input_number.solar_*`** -- Panel configuration helpers (auto-created)
- **`zone.home`** -- Location for solar position calculations (uses `hass.config` lat/lon as primary)

## Troubleshooting

**Dashboard doesn't appear in sidebar:**
- Verify the `panel_custom` entry in `configuration.yaml` is correctly formatted
- Ensure you restarted HA after adding the config
- Check the file path matches where you placed the JS file

**"Not admin" warning / helpers not created:**
- Log in as an admin user for the first load to trigger helper auto-creation
- Alternatively, create the helpers manually via Settings -> Helpers

**No battery data showing:**
- Verify the JK BMS integration is installed and providing `sensor.jk_bms_*` entities
- Check that entities are available in Developer Tools -> States

**Weather effects not showing:**
- Ensure a weather integration is configured (PirateWeather or Met.no)
- Check that a `weather.*` entity exists in Developer Tools -> States

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
  solar-engine.js     # NOAA solar position and irradiance calculations
  weather-fx.js       # Canvas particle systems and weather backdrops
  charts.js           # Custom canvas charting with crosshair/tooltip
  styles.js           # All CSS (dark/light themes, glassmorphism)
  solar-dashboard.js  # Main Web Component, DOM, UI updates
```

## License

MIT
