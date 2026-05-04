// BMS entity keyword definitions — covers JK, JBD, Daly, BatMON integrations
const SENSOR_KEYWORDS = {
  SOC:          ['capacity_remaining'],
  VOLTAGE:      ['total_voltage'],
  CURRENT:      ['current'],
  POWER:        ['power'],
  CHG_POWER:    ['charging_power'],
  DISCHG_POWER: ['discharging_power'],
  REMAINING:    ['capacity_remaining_derived', 'remaining_capacity'],
  CYCLES:       ['charging_cycles'],
  RUNTIME:      ['total_runtime_formatted'],
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
  BATTERY_TYPE: ['battery_type'],
};

// Keywords to exclude from POWER matching (too specific entities that contain "power")
const POWER_EXCLUDE = ['charging_power', 'discharging_power', 'power_tube', 'power_protection', 'power_recovery', 'power_balance'];
// Keywords to exclude from CURRENT matching (too specific entities that contain "current")
const CURRENT_EXCLUDE = ['overcurrent', 'current_calibration'];

const BINARY_SENSOR_KEYWORDS = {
  BALANCING:    ['balancing'],
  BAL_SWITCH:   ['balancing_switch'],
};

const SWITCH_KEYWORDS = {
  CHG_SWITCH:   ['charging'],
  DISCHG_SWITCH:['discharging'],
};

// Dynamic battery specs — updated from BMS entities (v9 line 748)
// BATT_SPEC moved to HABridge instance property (_battSpec) to support multiple cards

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
    this._cachedWeatherEntityId = null;
    this._cellVoltageIds = null;
    this._cachedMoonEntityId = null;
    this._battSpec = { fullAh: 215, strings: 16, nomV: 51.2, voltsPerCell: 3.2, chemistry: 'LiFePO₄' };
    this._lastChemInput = null;
  }

  get E() { return this._entities || {}; }
  get battSpec() { return this._battSpec; }

  // Called on every set hass(hass) from the main component
  update(hass) {
    this._hass = hass;
    if (!this._helpersChecked) {
      this._ensureHelpers();
      this._helpersChecked = true;
    }
    // Dynamic re-discovery: re-run until key entities are found
    const hasKeyEntities = !!(this._entities && this._entities.POWER && this._entities.SOC);
    const currentPrefix = this.getStrVal('input_text.bms_entity_prefix');
    if (!hasKeyEntities || this._discoveryRun === 0 || (currentPrefix && currentPrefix !== this._prefixBeforeChange)) {
      this._entities = this._discoverEntities(hass);
      this._cellVoltageIds = null;
      this._discoveryRun++;
      this._prefixBeforeChange = currentPrefix;
      // Warn once after first discovery if critical sensors are absent
      if (this._discoveryRun === 1) {
        const missing = ['POWER', 'SOC', 'VOLTAGE'].filter(k => {
          const id = this._entities[k];
          return !id || !this.getState(id);
        });
        if (missing.length) {
          console.warn(`[Solar] Critical entities not found: ${missing.join(', ')}. ` +
            'Check BMS integration or set input_text.bms_entity_prefix manually.');
        }
      }
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
    // Resolve battery chemistry only when relevant inputs change
    const _ci = `${this.getStrVal(this.E.BATTERY_TYPE)}|${this.getVal(this.E.VOLTAGE)}|${this.getVal(this.E.STRINGS)}`;
    if (_ci !== this._lastChemInput) { this._lastChemInput = _ci; this._resolveChemistry(); }
  }

  _resolveChemistry() {
    // Primary: battery_type entity
    const batteryType = this.getStrVal(this.E.BATTERY_TYPE);
    if (batteryType) {
      const bt = batteryType.toLowerCase();
      if (bt.includes('iron phosphate') || bt.includes('lifepo4') || bt.includes('lfp')) {
        this._battSpec.voltsPerCell = 3.2; this._battSpec.chemistry = 'LiFePO₄'; return;
      }
      if (bt.includes('nmc') || bt.includes('li-ion') || bt.includes('lithium') || bt.includes('ternary')) {
        this._battSpec.voltsPerCell = 3.7; this._battSpec.chemistry = 'NMC'; return;
      }
      if (bt.includes('titanate') || bt.includes('lto')) {
        this._battSpec.voltsPerCell = 2.3; this._battSpec.chemistry = 'LTO'; return;
      }
    }
    // Fallback: voltage-based detection
    const totalV = this.getVal(this.E.VOLTAGE);
    const strings = this.getVal(this.E.STRINGS);
    if (totalV > 0 && strings > 0) {
      const vpc = totalV / strings;
      // LFP can reach 3.5-3.55V at full charge, so range extends to 3.65V
      if (vpc >= 2.5 && vpc <= 3.65) { this._battSpec.voltsPerCell = 3.2; this._battSpec.chemistry = 'LiFePO₄'; return; }
      if (vpc > 3.65) { this._battSpec.voltsPerCell = 3.7; this._battSpec.chemistry = 'NMC'; return; }
      if (vpc >= 2.1 && vpc < 2.5) { this._battSpec.voltsPerCell = 2.3; this._battSpec.chemistry = 'LTO'; return; }
    }
    // Default
    this._battSpec.voltsPerCell = 3.2; this._battSpec.chemistry = 'LiFePO₄';
  }

  _buildFallbacks(prefix) {
    return {
      SOC:          `sensor.${prefix}_capacity_remaining`,
      VOLTAGE:      `sensor.${prefix}_total_voltage`,
      CURRENT:      `sensor.${prefix}_current`,
      POWER:        `sensor.${prefix}_power`,
      CHG_POWER:    `sensor.${prefix}_charging_power`,
      DISCHG_POWER: `sensor.${prefix}_discharging_power`,
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
      BATTERY_TYPE: `sensor.${prefix}_battery_type`,
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
            // Exclude overly generic POWER matches
            if (role === 'POWER' && POWER_EXCLUDE.some(ex => searchable.includes(ex))) continue;
            // Exclude overly generic CURRENT matches
            if (role === 'CURRENT' && CURRENT_EXCLUDE.some(ex => searchable.includes(ex))) continue;
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
    // Also track cell voltages (dynamic entity IDs), weather, and moon sensors
    // Weather entity is cached after first discovery to avoid scanning all states every call
    if (this._cachedWeatherEntityId && this._hass.states[this._cachedWeatherEntityId]) {
      tracked.push(this._cachedWeatherEntityId);
    } else {
      this._cachedWeatherEntityId = null;
    }
    // Build dynamic entity caches on first call or after discovery reset — avoids scanning all states every update
    if (!this._cellVoltageIds) {
      this._cellVoltageIds = [];
      for (const eid of Object.keys(this._hass.states)) {
        if (eid.includes('cell_voltage_')) this._cellVoltageIds.push(eid);
        if (!this._cachedWeatherEntityId && eid.startsWith('weather.')) this._cachedWeatherEntityId = eid;
        if (!this._cachedMoonEntityId && eid.startsWith('sensor.') && eid.includes('moon')) this._cachedMoonEntityId = eid;
      }
    }
    tracked.push(...this._cellVoltageIds);
    if (this._cachedMoonEntityId) tracked.push(this._cachedMoonEntityId);
    for (const eid of tracked) {
      const s = this._hass.states[eid];
      const prev = this._prevStates[eid];
      if (s && (!prev || prev.state !== s.state || prev.last_updated !== s.last_updated || prev.last_changed !== s.last_changed)) {
        changed.push(eid);
        this._prevStates[eid] = { state: s.state, last_updated: s.last_updated, last_changed: s.last_changed };
      }
    }
    return changed;
  }

  // History fetching — replaces v9 direct HTTP calls
  // significantOnly: pass true for calcTodayInOut (reduces data volume, matches v9 line 1309)
  async fetchHistoryRange(entityId, startDate, endDate, significantOnly = false) {
    if (!this._hass) return [];
    try {
      const msg = {
        type: 'history/history_during_period',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
      };
      if (significantOnly) msg.significant_changes_only = true;
      // NI14: Race against 15s timeout to prevent hung WebSocket calls
      const result = await Promise.race([
        this._hass.callWS(msg),
        new Promise((_, reject) => setTimeout(() => reject(new Error('History fetch timeout (15s)')), 15000)),
      ]);
      return (result?.[entityId] || []).map(d => {
        const state = d.s ?? d.state;
        const ts = d.lu ?? d.last_changed ?? d.last_updated;
        const t = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
        return { t, v: isNaN(parseFloat(state)) ? null : parseFloat(state) };
      });
    } catch (e) {
      console.warn('[Solar] History fetch failed:', e);
      return null;
    }
  }

  // Statistics fetching — replaces v9 raw WebSocket
  async fetchStatsRange(entityId, days, startTime, endTime) {
    if (!this._hass) return [];
    try {
      const now = endTime || new Date();
      const start = startTime || new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      // NI14: Race against 15s timeout to prevent hung WebSocket calls
      const result = await Promise.race([
        this._hass.callWS({
          type: 'recorder/statistics_during_period',
          start_time: start.toISOString(),
          end_time: now.toISOString(),
          statistic_ids: [entityId],
          period: days <= 1 ? '5minute' : days <= 7 ? 'hour' : 'day',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stats fetch timeout (15s)')), 15000)),
      ]);
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
          const haYear = parseInt((this._hass.config.version || '0').split('.')[0]);
          if (haYear >= 2025) {
            console.warn('[solar-dashboard] Helper creation failed on HA 2025+. Please create helpers manually or via HA UI.');
          } else {
            console.warn(`[Solar] Failed to create helper ${def.id}:`, e);
          }
        }
      }
    }
  }
}
