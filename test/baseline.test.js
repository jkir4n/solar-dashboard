import test from 'node:test';
import assert from 'node:assert/strict';
import { HABridge } from '../src/ha-bridge.js';
import { SolarEngine } from '../src/solar-engine.js';

test('fixtures discover BMS, PV and grid without using live services', async () => {
  const { createHassFixture } = await import('../dev/fixtures.js');
  const hass = createHassFixture('charging');
  const bridge = new HABridge();
  bridge.update(hass);
  assert.equal(bridge.getVal(bridge.E.SOC), 76);
  assert.equal(bridge.getVal(bridge.E.CURRENT), 1680 / 52.8);
  assert.equal(bridge.getGridSnap().pvPower, 2840);
  assert.equal(bridge.getGridSnap().gridPower, 0);
  await hass.callService('switch', 'turn_off', { entity_id: bridge.E.CHG_SWITCH });
  assert.equal(hass.requests.at(-1).service, 'turn_off');
});

test('solar baseline is deterministic and location sensitive', () => {
  const engine = new SolarEngine(11, 76.9, 400, new Date('2026-03-01T00:00:00Z'));
  const date = new Date('2026-10-31T07:00:00Z');
  const a = engine.getPosition(date);
  assert.deepEqual(a, engine.getPosition(date));
  assert.ok(a.elevation > 50 && a.elevation < 80);
  // JPL Horizons, 2026-10-31 07:00 UTC, 11N 76.9E 400m, airless azimuth.
  assert.ok(Math.abs(a.azimuth - 193.444810) < .05);
  assert.ok(engine.getPosition(new Date('2026-10-31T18:00:00Z')).elevation < 0);
});
