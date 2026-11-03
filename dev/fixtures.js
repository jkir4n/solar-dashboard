// Synthetic HA data. No fixture method can connect to or control a real installation.
export const scenarios = ['charging', 'discharging', 'bypass', 'missing', 'disconnected', 'imbalance'];
export const conditions = ['sunny', 'clear-night', 'partlycloudy', 'cloudy', 'rainy', 'pouring', 'lightning', 'lightning-rainy', 'snowy', 'snowy-rainy', 'hail', 'fog', 'windy', 'windy-variant', 'exceptional'];

export function createHassFixture(name = 'charging', options = {}) {
  if (!scenarios.includes(name)) throw new Error(`Unknown fixture: ${name}`);
  const now = options.now || Date.now();
  const states = {}, requests = [];
  const put = (id, value, unit, attributes = {}) => {
    states[id] = { entity_id: id, state: String(value), attributes: { friendly_name: id.split('.').at(-1), ...(unit ? { unit_of_measurement: unit } : {}), ...attributes }, last_changed: new Date(now).toISOString(), last_updated: new Date(now).toISOString() };
  };
  const power = name === 'discharging' ? -640 : name === 'bypass' ? 420 : 1680;
  const sensors = {
    capacity_remaining: [76, '%'], total_voltage: [52.8, 'V'], current: [power / 52.8, 'A'], power: [power, 'W'],
    charging_power: [Math.max(0, power), 'W'], discharging_power: [Math.max(0, -power), 'W'],
    capacity_remaining_derived: [163.4, 'Ah'], charging_cycles: [82, ''], total_charging_cycle_capacity: [17630, 'Ah'],
    total_runtime_formatted: ['129d 12h', ''], min_cell_voltage: [3.296, 'V'], max_cell_voltage: [3.304, 'V'],
    min_voltage_cell: [3, ''], max_voltage_cell: [11, ''], software_version: ['15.10', ''], manufacturer: ['JK', ''],
    temperature_sensor_1: [28.4, '°C'], temperature_sensor_2: [29.1, '°C'], power_tube_temperature: [31.2, '°C'], battery_strings: [16, ''], battery_type: ['LiFePO4', ''],
  };
  for (const [suffix, [value, unit]] of Object.entries(sensors)) put(`sensor.jk_bms_jk_bms_${suffix}`, value, unit);
  for (let i = 1; i <= 16; i++) put(`sensor.jk_bms_jk_bms_cell_voltage_${i}`, name === 'imbalance' && i === 11 ? 3.45 : 3.296 + (i % 5) * .002, 'V');
  for (const suffix of ['charging', 'discharging', 'absorption_mode']) put(`switch.jk_bms_jk_bms_${suffix}`, suffix === 'absorption_mode' ? 'off' : 'on');
  put('switch.grid_input_grid_input', name === 'bypass' ? 'on' : 'off');
  put('binary_sensor.jk_bms_jk_bms_balancing', name === 'imbalance' ? 'on' : 'off');
  put('binary_sensor.jk_bms_jk_bms_balancing_switch', 'on');
  put('number.grid_connect_soc', 20, '%', { min: 0, max: 100, step: 1 });
  put('number.grid_disconnect_soc', 40, '%', { min: 0, max: 100, step: 1 });
  put('sensor.inverter_pv_power', name === 'discharging' ? 0 : name === 'bypass' ? 420 : 2840, 'W');
  put('sensor.inverter_grid_power', name === 'bypass' ? 1240 : 0, 'W');
  put('sensor.inverter_grid_voltage', 231.4, 'V'); put('sensor.inverter_grid_frequency', 50, 'Hz');
  put('sensor.inverter_grid_status', 1); put('sensor.inverter_absorption_status', 'Not armed');
  put('sensor.grid_input_grid_energy_consumed_cost', 80, 'INR');
  const helpers = { count: 6, rated_watts: 585, efficiency: 22.6, tilt: 7.5, azimuth: 220, width: 2.278, height: 1.134 };
  for (const [key, value] of Object.entries(helpers)) put(`input_number.solar_panel_${key}`, value);
  put('input_text.solar_panel_model', 'NOVA585TG144'); put('input_text.solar_panel_type', 'TOPCon');
  put('input_text.bms_entity_prefix', 'jk_bms_jk_bms');
  put('input_datetime.solar_install_date', '2026-03-01', null, { has_date: true, has_time: false });
  put('weather.home', options.condition || 'sunny', null, { temperature: 29, temperature_unit: '°C', cloud_coverage: 15, humidity: 64, wind_speed: 8, wind_speed_unit: 'km/h', wind_bearing: 220, visibility: 12, visibility_unit: 'km', pressure: 1012, pressure_unit: 'hPa', uv_index: 5 });
  put('sun.sun', 'above_horizon');
  if (name === 'missing') for (const [id, state] of Object.entries(states)) if (id.startsWith('sensor.')) state.state = 'unavailable';
  const history = id => Array.from({ length: 97 }, (_, i) => ({ entity_id: id, state: String(id.includes('capacity_remaining') ? 55 + 20 * i / 96 : Math.max(0, 1200 + 900 * Math.sin(i / 12))), last_changed: new Date(now - (96 - i) * 900000).toISOString(), last_updated: new Date(now - (96 - i) * 900000).toISOString(), attributes: states[id]?.attributes || {} }));
  return {
    states, requests, language: options.language || 'en', themes: { darkMode: options.dark ?? false }, user: { is_admin: true },
    config: { latitude: 11, longitude: 76.9, elevation: 400, time_zone: 'Asia/Kolkata', version: '2026.10.0', unit_system: { temperature: '°C', length: 'km' } },
    connection: { connected: name !== 'disconnected' },
    async callService(domain, service, data) { requests.push({ domain, service, data }); return {}; },
    async callApi(method, path) {
      requests.push({ method, path });
      const id = new URL(`http://fixture/${path}`).searchParams.get('filter_entity_id');
      return id ? [history(id)] : [];
    },
    async callWS(message) {
      requests.push(message);
      if (message.type === 'history/history_during_period') return Object.fromEntries(message.entity_ids.map(id => [id, history(id)]));
      if (message.type === 'call_service' && message.service === 'get_forecasts') return { response: { 'weather.home': { forecast: Array.from({ length: 24 }, (_, i) => ({ datetime: new Date(now + (i + 1) * 3600000).toISOString(), condition: options.condition || 'sunny', temperature: 29, cloud_coverage: 15 })) } } };
      if (message.statistic_ids) return Object.fromEntries(message.statistic_ids.map(id => [id, history(id).map((entry, i) => ({ start: new Date(entry.last_changed).getTime(), mean: Number(entry.state), max: Number(entry.state), min: Number(entry.state), sum: i * .15, state: Number(entry.state) }))]));
      return {};
    },
  };
}
