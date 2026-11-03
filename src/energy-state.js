// Positive battery power charges the pack. Negative battery power supplies the home.
// A missing PV meter is not replaced by the battery charging sensor.
export function powerUnitScale(bridge,id) { return bridge.getState(id)?.attributes?.unit_of_measurement?.toLowerCase()==='kw'?1000:1; }
export function readEnergyState(bridge) {
  const E = bridge.E;
  const grid = bridge.gridEntities;
  const provenance = {};
  const power = (id) => {
    const value = bridge.getVal(id);
    if (!Number.isFinite(value)) return null;
    return value * powerUnitScale(bridge,id);
  };
  const measured = (name, id) => {
    const value = power(id);
    provenance[name] = { kind: value == null ? 'unavailable' : 'measured', entityId: id || null };
    return value;
  };
  const solarW = measured('solarW', grid.PV_POWER?.entityId);
  const rawGridW = measured('gridW', grid.GRID_POWER?.entityId);
  const gridW = rawGridW == null ? null : Math.max(0, rawGridW);
  const current = bridge.getVal(E.CURRENT);
  const charge = power(E.CHG_POWER), discharge = power(E.DISCHG_POWER);
  let batteryW = measured('batteryW', E.POWER);
  if (batteryW != null && Number.isFinite(current)) batteryW = Math.abs(batteryW) * Math.sign(current);
  else if (charge != null && discharge != null) {
    batteryW = charge - discharge;
    provenance.batteryW = { kind: 'derived', entityId: null };
  } else if (batteryW != null) {
    // A generic unsigned power sensor alone cannot establish flow direction.
    batteryW = null;
    provenance.batteryW = { kind: 'unavailable', entityId: E.POWER || null };
  }
  let homeW = measured('homeW', grid.HOME_POWER?.entityId || E.HOME_POWER);
  if (homeW == null && solarW != null && gridW != null && batteryW != null) {
    const balance = solarW + gridW - batteryW;
    homeW = balance >= 0 ? balance : null;
    provenance.homeW = { kind: homeW == null ? 'unavailable' : 'derived', entityId: null };
  }
  const status = bridge.getStrVal(grid.GRID_STATUS?.entityId);
  const gridAvailable = status == null ? (gridW == null ? null : true) : ['1', 'on', 'connected', 'online'].includes(status.toLowerCase());
  return { solarW, batteryW, homeW, gridW, socPct: bridge.getVal(E.SOC), gridAvailable, provenance };
}
