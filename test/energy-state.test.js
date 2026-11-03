import test from 'node:test';
import assert from 'node:assert/strict';
import { HABridge } from '../src/ha-bridge.js';
import { createHassFixture } from '../dev/fixtures.js';

async function read(name, change = () => {}) {
  const { readEnergyState } = await import('../src/energy-state.js');
  const hass = createHassFixture(name); change(hass);
  const bridge = new HABridge(); bridge.update(hass);
  return readEnergyState(bridge);
}
for (const [name, expected] of Object.entries({ charging: [2840, 1680, 1160, 0], discharging: [0, -640, 640, 0], bypass: [420, 420, 1240, 1240] })) {
  test(`${name} retains measured watts and derives aggregate load`, async () => {
    const s = await read(name);
    assert.deepEqual([s.solarW, s.batteryW, s.homeW, s.gridW], expected);
    assert.equal(s.provenance.homeW.kind, 'derived');
  });
}
test('missing sensors stay unknown rather than becoming zero', async () => {
  const s = await read('missing');
  assert.deepEqual([s.solarW, s.batteryW, s.homeW, s.gridW, s.socPct], [null, null, null, null, null]);
});
test('kW converts to watts and negative grid values cannot create exports', async () => {
  const s = await read('charging', hass => {
    hass.states['sensor.inverter_pv_power'].state = '2.84';
    hass.states['sensor.inverter_pv_power'].attributes.unit_of_measurement = 'kW';
    hass.states['sensor.inverter_grid_power'].state = '-100';
  });
  assert.equal(s.solarW, 2840); assert.equal(s.gridW, 0);
});
test('battery charge power is not mislabeled as measured PV', async () => {
  const s = await read('charging', hass => { delete hass.states['sensor.inverter_pv_power']; });
  assert.equal(s.solarW, null); assert.equal(s.homeW, null);
});
test('all existing locales retain their labels', async () => {
  const { t, L } = await import('../src/i18n.js');
  assert.equal(Object.keys(L).length, 20);
  for (const lang of Object.keys(L)) assert.ok(t(lang, 'battery') && t(lang, 'ctrlCharging'));
  assert.equal(t('de-DE', 'battery'), 'Batterie');
});
