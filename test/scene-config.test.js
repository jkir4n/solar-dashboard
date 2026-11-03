import test from 'node:test';
import assert from 'node:assert/strict';
import { createHouseCompound } from '../src/scene/house-compound.js';

test('panel dimensions and compass helpers define a stable model', async () => {
  const { normalizePanelConfig } = await import('../src/scene/house-compound.js');
  assert.deepEqual(normalizePanelConfig({ count: 6, width: 2.278, height: 1.134, tilt: 7.5, azimuth: 220 }), { count: 6, width: 2.278, height: 1.134, tilt: 7.5, azimuth: 220 });
  const invalid = normalizePanelConfig({ count: Infinity, width: -1, tilt: 200, azimuth: 370 });
  assert.ok(invalid.count >= 1 && invalid.count <= 100); assert.ok(invalid.width > 0);
  assert.equal(invalid.tilt, 90); assert.equal(invalid.azimuth, 10);
});
test('house has 16 selectable cells and configurable panel instances', async () => {
  const { createHouseCompound } = await import('../src/scene/house-compound.js');
  const h = createHouseCompound({ panelConfig: { count: 6, width: 2.278, height: 1.134, tilt: 7.5, azimuth: 220 } });
  assert.equal(h.pickables.filter(p => p.userData.cellIndex != null).length, 16);
  assert.ok(h.pickables.some(p => p.userData.zone === 'controls'));
  assert.equal(h.group.getObjectByName('solar-panels').count, 6);
  h.setCutaway(1); assert.ok(h.group.getObjectByName('roof').position.y > 0);
  h.dispose();
});
test('panel normals follow all four cardinal azimuths', async () => {
  const { Vector3 } = await import('three');
  for (const azimuth of [0,90,180,270]) {
    const house=createHouseCompound({panelConfig:{azimuth,tilt:30}});
    house.group.updateMatrixWorld(true);
    const normal=new Vector3(0,1,0).transformDirection(house.group.getObjectByName('solar-panels').matrixWorld);
    const az=azimuth*Math.PI/180;
    assert.ok(normal.distanceTo(new Vector3(Math.sin(az)*.5,Math.cos(Math.PI/6),-Math.cos(az)*.5))<1e-6);
    house.dispose();
  }
});

test('camera presets have distinct coordinates and support cubic fly-to tweens', async () => {
  const { CAMERA_PRESETS, WorldScene } = await import('../src/scene/world-scene.js');
  const zones = ['overview', 'solar', 'battery', 'cells', 'controls', 'grid', 'home', 'sky'];
  // Verify all 8 zones are defined
  for (const z of zones) {
    assert.ok(CAMERA_PRESETS[z], `preset for ${z} exists`);
  }
  // Verify distinct positions or targets across presets
  const signatures = zones.map(z => {
    const p = CAMERA_PRESETS[z];
    return `${p.pos.x},${p.pos.y},${p.pos.z}->${p.target.x},${p.target.y},${p.target.z}@${p.zoom}`;
  });
  const uniqueSignatures = new Set(signatures);
  assert.equal(uniqueSignatures.size, zones.length, 'all 8 camera presets have distinct positions/targets');

  // Verify WorldScene fly-to tween
  const doc = { addEventListener: () => {}, removeEventListener: () => {} };
  const canvas = {
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    ownerDocument: doc,
    getRootNode: () => doc,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    style: {},
  };
  const world = new WorldScene(canvas);
  world.focus('battery');
  assert.equal(world.cutawayTarget, 1, 'battery focus activates cutaway');
  assert.ok(world.cameraTween, 'camera tween created for smooth fly-to');
  assert.equal(world.cameraTween.duration, 600, '600 ms fly-to tween duration');
  assert.ok(world.cameraTween.toPos.distanceTo(CAMERA_PRESETS.battery.pos) < 1e-4);
  world.dispose();
});

test('reactive 3D cells, balancing arc, inverter LEDs and grid beacon respond to state', async () => {
  const { createHouseCompound } = await import('../src/scene/house-compound.js');
  const h = createHouseCompound({ panelConfig: { count: 6 } });

  // 1. Reactive cell states & balancing arc
  h.setCellStates({ minCell: 1, maxCell: 14, balancing: true });
  assert.equal(h.cells[14].material.color.getHexString(), 'c25c54', 'maxCell is crimson/amber');
  assert.equal(h.cells[1].material.color.getHexString(), '4b8e9e', 'minCell is cyan/blue');
  assert.equal(h.cells[5].material.color.getHexString(), '529676', 'nominal cell is emerald');
  assert.equal(h.arcMesh.visible, true, 'supercap balancing arc is visible when balancing');

  h.setCellStates({ minCell: 1, maxCell: 14, balancing: false });
  assert.equal(h.arcMesh.visible, false, 'supercap balancing arc hidden when balancing is off');

  // 2. Inverter status LEDs & Grid beacon
  // Online grid & charging
  h.setEnergy({ batteryW: 1200, gridW: 0, gridAvailable: true, socPct: 85 });
  assert.equal(h.gridBeacon.material.color.getHexString(), '48bb78', 'online grid beacon is emerald');
  assert.equal(h.inverterLeds[0].material.color.getHexString(), '48bb78', 'charging LED is lit');

  // Offline grid & discharging
  h.setEnergy({ batteryW: -950, gridW: 0, gridAvailable: false, socPct: 15 });
  assert.equal(h.gridBeacon.material.color.getHexString(), 'f56565', 'offline grid beacon is crimson');
  assert.equal(h.inverterLeds[1].material.color.getHexString(), 'f56565', 'discharging LED is lit');

  // Grid bypass
  h.setEnergy({ batteryW: 0, gridW: 1500, gridAvailable: true, socPct: 50 });
  assert.equal(h.inverterLeds[2].material.color.getHexString(), '4299e1', 'bypass LED is lit');

  // Cutaway ghostly wireframe
  h.setCutaway(1);
  assert.ok(h.group.getObjectByName('roof').position.y > 1.5, 'roof lifted on cutaway');
  h.dispose();
});
