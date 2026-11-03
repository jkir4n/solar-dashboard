import test from 'node:test';
import assert from 'node:assert/strict';
test('route state rejects export and never models grid charging', async () => {
  const { energyRoutes } = await import('../src/scene/energy-conduits.js');
  const routes = energyRoutes({ solarW: 420, batteryW: 420, homeW: 1240, gridW: 1240 });
  assert.deepEqual(routes, { solar: 420, battery: 420, grid: 1240, home: 1240 });
  assert.equal(energyRoutes({ solarW: 0, batteryW: 500, homeW: 100, gridW: 600 }).battery, 0);
  assert.equal(energyRoutes({ solarW: null, batteryW: null, homeW: null, gridW: -10 }).grid, 0);
  assert.equal(energyRoutes({ solarW: 0, batteryW: -640, homeW: 640, gridW: 0 }).battery, -640);
});

test('conduit colors switch between charge/discharge and update on theme change', async () => {
  const { createEnergyConduits } = await import('../src/scene/energy-conduits.js');
  const conduits = createEnergyConduits();
  const batteryRoute = conduits.routes.find(r => r.name === 'battery');
  const homeRoute = conduits.routes.find(r => r.name === 'home');

  // Charging state (dark theme default)
  conduits.setState({ solarW: 2000, batteryW: 1000, homeW: 1000, gridW: 0 });
  assert.equal(batteryRoute.pipe.material.color.getHexString(), '8cb89a', 'battery charge is emerald in dark theme');
  assert.equal(homeRoute.pipe.material.color.getHexString(), 'd2b26e', 'home conduit is solar gold when solar is dominant');

  // Discharging state
  conduits.setState({ solarW: 0, batteryW: -1500, homeW: 1500, gridW: 0 });
  assert.equal(batteryRoute.pipe.material.color.getHexString(), 'd66860', 'battery discharge is crimson in dark theme');
  assert.equal(homeRoute.pipe.material.color.getHexString(), 'd66860', 'home conduit is battery crimson when battery is dominant');

  // Grid feeding home
  conduits.setState({ solarW: 0, batteryW: 0, homeW: 1800, gridW: 1800 });
  assert.equal(homeRoute.pipe.material.color.getHexString(), 'a8b0cf', 'home conduit is grid blue when grid is dominant');

  // Theme switch to light
  conduits.setTheme('light');
  assert.equal(homeRoute.pipe.material.color.getHexString(), '7582a2', 'home conduit switches to light grid token');
  conduits.setState({ solarW: 2000, batteryW: 800, homeW: 1200, gridW: 0 });
  assert.equal(batteryRoute.pipe.material.color.getHexString(), '548a75', 'battery charge switches to light theme emerald');

  conduits.dispose();
});
