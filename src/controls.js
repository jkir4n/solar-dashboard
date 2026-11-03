const switches = new Set(['CHG_SWITCH', 'DISCHG_SWITCH', 'GRID_SWITCH', 'ABSORPTION_SWITCH']);
const numbers = new Set(['GRID_CONNECT_SOC', 'GRID_DISCONNECT_SOC']);

export function refreshControlAvailability(root,bridge,pending=new Set()) {
  for(const [prefix,role] of [['chgToggle','CHG_SWITCH'],['dischgToggle','DISCHG_SWITCH'],['gridToggle','GRID_SWITCH'],['absorptionToggle','ABSORPTION_SWITCH'],['gridConnect','GRID_CONNECT_SOC'],['gridDisconnect','GRID_DISCONNECT_SOC']]){
    const state=bridge.getState(bridge.E[role]);
    const disabled=bridge.hass?.connection?.connected===false||!state||['unavailable','unknown'].includes(state.state)||pending.has(role);
    for(const id of numbers.has(role)?[prefix+'Minus',prefix+'Plus']:[prefix]){
      const element=root.getElementById(id);if(element)element.disabled=disabled;
    }
  }
}

export function createControlHandler(bridge) {
  const pending = new Set();
  return {
    pending,
    async send(role, { enabled, delta } = {}) {
      if (pending.has(role) || (!switches.has(role) && !numbers.has(role))) return false;
      const id = bridge.E[role], state = bridge.getState(id), hass = bridge.hass;
      if (!hass || hass.connection?.connected === false || !state || ['unknown','unavailable'].includes(state.state)) return false;
      let domain, service, data;
      if (switches.has(role)) {
        if (typeof enabled !== 'boolean' || !id.startsWith('switch.')) return false;
        domain='switch';service=enabled?'turn_on':'turn_off';data={entity_id:id};
      } else {
        const value=Number(state.state), min=Number(state.attributes.min??0), max=Number(state.attributes.max??100), step=Number(state.attributes.step??1);
        if (![value,min,max,step,delta].every(Number.isFinite) || step<=0 || min>max || !id.startsWith('number.')) return false;
        domain='number';service='set_value';data={entity_id:id,value:Math.round(Math.max(min,Math.min(max,value+Math.sign(delta)*step))*1e6)/1e6};
      }
      pending.add(role);
      try { await hass.callService(domain,service,data); return true; }
      finally { pending.delete(role); }
    },
  };
}
