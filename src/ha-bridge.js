// BMS entity keyword definitions — covers JK, JBD, Daly, BatMON integrations
const SENSOR_KEYWORDS = {
  SOC:          ['capacity_remaining'],
  VOLTAGE:      ['total_voltage'],
  CURRENT:      ['current'],
  POWER:        ['power'],
  REMAINING:    ['capacity_remaining_derived', 'remaining_capacity'],
  CYCLES:       ['charging_cycles'],
  RUNTIME:      ['total_runtime'],
  THROUGHPUT:   ['total_charging_cycle_capacity'],
  MIN_CELL_V:   ['min_cell_voltage'],
  MAX_CELL_V:   ['max_cell_voltage'],
  MIN_V_CELL:   ['min_voltage_cell'],
  MAX_V_CELL:   ['max_voltage_cell'],
  FIRMWARE:     ['software_version'],
  TEMP1:        ['temperature_sensor_1', 'temperature_1'],
  TEMP2:        ['temperature_sensor_2', 'temperature_2'],
  MOSFET_TEMP:  ['power_tube_temperature', 'mosfet_temp'],
  STRINGS:      ['battery_strings', 'cell_count'],
  MANUFACTURER: ['manufacturer'],
};

const BINARY_SENSOR_KEYWORDS = {
  BALANCING:    ['balancing'],
  BAL_SWITCH:   ['balancing_switch'],
};

const SWITCH_KEYWORDS = {
  CHG_SWITCH:   ['charging'],
  DISCHG_SWITCH:['discharging'],
};

// Dynamic battery specs — updated from BMS entities (v9 line 748)
const BATT_SPEC = { fullAh: 215, strings: 16, nomV: 51.2 };

// Helper definitions for auto-creation
const HELPER_DEFS = [
  { type: 'input_number', name: 'Solar Panel Count', id: 'input_number.solar_panel_count', min: 1, max: 100, step: 1, initial: 6, unit_of_measurement: 'panels', icon: 'mdi:solar-panel', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Rated Watts', id: 'input_number.solar_panel_rated_watts', min: 50, max: 1000, step: 5, initial: 585, unit_of_measurement: 'W', icon: 'mdi:flash', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Efficiency', id: 'input_number.solar_panel_efficiency', min: 5, max: 30, step: 0.1, initial: 22.6, unit_of_measurement: '%', icon: 'mdi:percent', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Tilt', id: 'input_number.solar_panel_tilt', min: 0, max: 90, step: 0.5, initial: 7.5, unit_of_measurement: '°', icon: 'mdi:angle-acute', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Azimuth', id: 'input_number.solar_panel_azimuth', min: 0, max: 360, step: 1, initial: 220, unit_of_measurement: '°', icon: 'mdi:compass', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Width', id: 'input_number.solar_panel_width', min: 0.5, max: 3, step: 0.001, initial: 2.278, unit_of_measurement: 'm', icon: 'mdi:arrow-left-right', mode: 'box' },
  { type: 'input_number', name: 'Solar Panel Height', id: 'input_number.solar_panel_height', min: 0.5, max: 2, step: 0.001, initial: 1.134, unit_of_measurement: 'm', icon: 'mdi:arrow-up-down', mode: 'box' },
  { type: 'input_text', name: 'Solar Panel Model', id: 'input_text.solar_panel_model', initial: 'NOVA585TG144', mode: 'text' },
  { type: 'input_text', name: 'Solar Panel Type', id: 'input_text.solar_panel_type', initial: 'TOPCon', mode: 'text' },
  { type: 'input_datetime', name: 'Solar Install Date', id: 'input_datetime.solar_install_date', has_date: true, has_time: false, initial: '2026-03-01' },
  { type: 'input_text', name: 'BMS Entity Prefix', id: 'input_text.bms_entity_prefix', initial: 'jk_bms_jk_bms', mode: 'text' },
];

export class HABridge {
  constructor() {
    this._hass = null;
    this._prevStates = {};
    this._helpersChecked = false;
    this._entities = {};
    this._discoveryRun = 0;
    this._helperCreated = false;
    this._prefixBeforeChange = null;
  }

  get E() { return this._entities || {}; }
  get battSpec() { return BATT_SPEC; }

  // Called on every set hass(hass) from the main component
  update(hass) {
    this._hass = hass;
    if (!this._helpersChecked) {
      this._ensureHelpers();
      this._helpersChecked = true;
    }
    // Dynamic re-discovery: detect prefix change or first run
    const currentPrefix = this.getStrVal('input_text.bms_entity_prefix');
    if (this._discoveryRun === 0 || (currentPrefix && currentPrefix !== this._prefixBeforeChange)) {
      this._entities = this._discoverEntities(hass);
      this._discoveryRun++;
      this._prefixBeforeChange = currentPrefix;
      // Lazy helper creation: only if discovery found too few entities
      const found = Object.keys(this._entities).filter(k => {
        const v = this._entities[k];
        return v && this.getState(v);
      }).length;
      if (found < 5 && !this._helperCreated) {
        this._createBmsPrefixHelper();
        this._helperCreated = true;
      }
    }
  }

  _buildFallbacks(prefix) {
    return {
      SOC:          `sensor.${prefix}_capacity_remaining`,
      VOLTAGE:      `sensor.${prefix}_total_voltage`,
      CURRENT:      `sensor.${prefix}_current`,
      POWER:        `sensor.${prefix}_power`,
      REMAINING:    `sensor.${prefix}_capacity_remaining_derived`,
      CYCLES:       `sensor.${prefix}_charging_cycles`,
      RUNTIME:      `sensor.${prefix}_total_runtime`,
      THROUGHPUT:   `sensor.${prefix}_total_charging_cycle_capacity`,
      MIN_CELL_V:   `sensor.${prefix}_min_cell_voltage`,
      MAX_CELL_V:   `sensor.${prefix}_max_cell_voltage`,
      MIN_V_CELL:   `sensor.${prefix}_min_voltage_cell`,
      MAX_V_CELL:   `sensor.${prefix}_max_voltage_cell`,
      FIRMWARE:     `sensor.${prefix}_software_version`,
      TEMP1:        `sensor.${prefix}_temperature_sensor_1`,
      TEMP2:        `sensor.${prefix}_temperature_sensor_2`,
      MOSFET_TEMP:  `sensor.${prefix}_power_tube_temperature`,
      STRINGS:      `sensor.${prefix}_battery_strings`,
      MANUFACTURER: `sensor.${prefix}_manufacturer`,
      BALANCING:    `binary_sensor.${prefix}_balancing`,
      BAL_SWITCH:   `binary_sensor.${prefix}_balancing_switch`,
      CHG_SWITCH:   `switch.${prefix}_charging`,
      DISCHG_SWITCH:`switch.${prefix}_discharging`,
    };
  }

  _discoverEntities(hass) {
    const discovered = {};
    const states = hass.states;

    for (const [entityId, state] of Object.entries(states)) {
      const domain = entityId.split('.')[0];
      const searchable = `${entityId} ${(state.attributes?.friendly_name || '').toLowerCase()}`;

      if (domain === 'sensor') {
        for (const [role, keywords] of Object.entries(SENSOR_KEYWORDS)) {
          if (!discovered[role] && keywords.some(kw => searchable.includes(kw))) {
            discovered[role] = entityId;
          }
        }
      }
      if (domain === 'binary_sensor') {
        for (const [role, keywords] of Object.entries(BINARY_SENSOR_KEYWORDS)) {
          if (!discovered[role] && keywords.some(kw => searchable.includes(kw))) {
            discovered[role] = entityId;
          }
        }
      }
      if (domain === 'switch') {
        for (const [role, keywords] of Object.entries(SWITCH_KEYWORDS)) {
          if (!discovered[role] && keywords.some(kw => searchable.includes(kw))) {
            discovered[role] = entityId;
          }
        }
      }
    }

    // Discover cell voltages via regex (only valid states)
    for (const entityId of Object.keys(states)) {
      const m = entityId.match(/cell_voltage_(\d+)/i);
      if (m) {
        const state = states[entityId];
        if (state && state.state !== 'unknown' && state.state !== 'unavailable') {
          discovered['CELL' + m[1]] = entityId;
        }
      }
    }

    // Fill gaps with prefix-based fallback
    const prefix = this.getStrVal('input_text.bms_entity_prefix') || 'jk_bms_jk_bms';
    const fallbacks = this._buildFallbacks(prefix);
    for (const [role, fallbackId] of Object.entries(fallbacks)) {
      if (!discovered[role]) discovered[role] = fallbackId;
    }

    return discovered;
  }

  async _createBmsPrefixHelper() {
    if (!this._hass?.user?.is_admin) return;
    const def = { type: 'input_text', name: 'BMS Entity Prefix', id: 'input_text.bms_entity_prefix', initial: 'jk_bms_jk_bms', mode: 'text' };
    if (!(def.id in this._hass.states)) {
      try {
        await this._hass.callWS({
          type: `${def.type}/create`,
          name: def.name,
          initial: def.initial,
          mode: def.mode,
        });
        console.log('[Solar] Created BMS prefix helper');
      } catch (e) {
        console.warn('[Solar] Failed to create BMS prefix helper:', e);
      }
    }
  }

  // Returns the full state object for an entity
  getState(entityId) {
    if (!this._hass) return null;
    return this._hass.states[entityId] || null;
  }

  // Returns the numeric value of an entity's state (replaces v9 getVal + parseFloat)
  getVal(entityId) {
    const s = this.getState(entityId);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    const n = parseFloat(s.state);
    return isNaN(n) ? null : n;
  }

  // Returns string state value
  getStrVal(entityId) {
    const s = this.getState(entityId);
    if (!s || s.state === 'unavailable' || s.state === 'unknown') return null;
    return s.state;
  }

  // Location from hass.config
  get latitude() { return this._hass?.config?.latitude ?? null; }
  get longitude() { return this._hass?.config?.longitude ?? null; }
  get elevation() { return this._hass?.config?.elevation ?? 0; }
  get timezone() { return this._hass?.config?.time_zone ?? 'UTC'; }

  // Helper values — read from entity state, fall back to defaults
  get panelCount() { return this.getVal('input_number.solar_panel_count') ?? 6; }
  get panelRatedWatts() { return this.getVal('input_number.solar_panel_rated_watts') ?? 585; }
  get panelEfficiency() { return (this.getVal('input_number.solar_panel_efficiency') ?? 22.6) / 100; }
  get panelTilt() { return this.getVal('input_number.solar_panel_tilt') ?? 7.5; }
  get panelAzimuth() { return this.getVal('input_number.solar_panel_azimuth') ?? 220; }
  get panelWidth() { return this.getVal('input_number.solar_panel_width') ?? 2.278; }
  get panelHeight() { return this.getVal('input_number.solar_panel_height') ?? 1.134; }
  get panelAreaEach() { return this.panelWidth * this.panelHeight; }
  get panelModel() { return this.getStrVal('input_text.solar_panel_model') ?? 'NOVA585TG144'; }
  get panelType() { return this.getStrVal('input_text.solar_panel_type') ?? 'TOPCon'; }
  get installDate() {
    const s = this.getState('input_datetime.solar_install_date');
    if (s && s.attributes?.has_date) {
      const d = s.state || s.attributes?.timestamp;
      if (d && typeof d === 'string' && d.includes('-')) {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day);
      }
      if (typeof d === 'number') return new Date(d * 1000);
    }
    return new Date(2026, 2, 1);
  }

  // Check which tracked entities changed since last update
  getChangedEntities() {
    if (!this._hass) return [];
    const changed = [];
    const tracked = [
      ...Object.values(this._entities || {}),
      'input_number.solar_panel_count', 'input_number.solar_panel_rated_watts',
      'input_number.solar_panel_efficiency', 'input_number.solar_panel_tilt',
      'input_number.solar_panel_azimuth', 'input_number.solar_panel_width',
      'input_number.solar_panel_height', 'input_text.solar_panel_model',
      'input_text.solar_panel_type', 'input_datetime.solar_install_date',
      'input_text.bms_entity_prefix',
    ];
    // Also track cell voltages (dynamic entity IDs) and weather
    for (const eid of Object.keys(this._hass.states)) {
      if (eid.includes('cell_voltage_')) tracked.push(eid);
      if (eid.startsWith('weather.')) tracked.push(eid);
    }
    for (const eid of tracked) {
      const s = this._hass.states[eid];
      const prev = this._prevStates[eid];
      if (s && (!prev || prev.state !== s.state || prev.last_updated !== s.last_updated)) {
        changed.push(eid);
        this._prevStates[eid] = { state: s.state, last_updated: s.last_updated };
      }
    }
    return changed;
  }

  // History fetching — replaces v9 direct HTTP calls
  // significantOnly: pass true for calcTodayInOut (reduces data volume, matches v9 line 1309)
  async fetchHistoryRange(entityId, startDate, endDate, significantOnly = false) {
    if (!this._hass) return [];
    try {
      let path = `history/period/${startDate.toISOString()}?filter_entity_id=${entityId}&end_time=${endDate.toISOString()}&minimal_response&no_attributes`;
      if (significantOnly) path += '&significant_changes_only';
      const result = await this._hass.callApi('GET', path);
      return (result?.[0] || []).map(d => ({ t: new Date(d.last_changed || d.last_updated), v: isNaN(parseFloat(d.state)) ? null : parseFloat(d.state) }));
    } catch (e) {
      console.warn('[Solar] History fetch failed:', e);
      return [];
    }
  }

  // Statistics fetching — replaces v9 raw WebSocket
  async fetchStatsRange(entityId, days) {
    if (!this._hass) return [];
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      const result = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: now.toISOString(),
        statistic_ids: [entityId],
        period: days <= 1 ? '5minute' : days <= 7 ? 'hour' : 'day',
      });
      return (result?.[entityId] || []).map(d => ({ t: new Date(d.start), v: d.mean ?? d.sum ?? 0 }));
    } catch (e) {
      console.warn('[Solar] Stats fetch failed:', e);
      return [];
    }
  }

  // Auto-create helpers if missing (admin only)
  async _ensureHelpers() {
    if (!this._hass) return;
    if (!this._hass.user?.is_admin) {
      console.warn('[Solar] Non-admin user — cannot create helpers. Using defaults.');
      return;
    }
    for (const def of HELPER_DEFS) {
      if (!(def.id in this._hass.states)) {
        try {
          const params = {
            type: `${def.type}/create`,
            name: def.name,
          };
          if (def.type === 'input_number') {
            params.min = def.min;
            params.max = def.max;
            params.step = def.step;
            params.initial = def.initial;
            params.unit_of_measurement = def.unit_of_measurement;
            params.icon = def.icon;
            params.mode = def.mode;
          } else if (def.type === 'input_text') {
            params.initial = def.initial;
            params.mode = def.mode;
          } else if (def.type === 'input_datetime') {
            params.has_date = def.has_date;
            params.has_time = def.has_time;
            params.initial = def.initial;
          }
          await this._hass.callWS(params);
          console.log(`[Solar] Created helper: ${def.id}`);
        } catch (e) {
          console.warn(`[Solar] Failed to create helper ${def.id}:`, e);
        }
      }
    }
  }
}
