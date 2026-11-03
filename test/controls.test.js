import test from 'node:test';
import assert from 'node:assert/strict';
import { HABridge } from '../src/ha-bridge.js';
import { createHassFixture } from '../dev/fixtures.js';
test('control payloads use discovered roles and actual step bounds', async () => {
  const { createControlHandler } = await import('../src/controls.js');
  const hass=createHassFixture();const bridge=new HABridge();bridge.update(hass);
  hass.states['number.grid_connect_soc'].attributes.step=5;
  const handler=createControlHandler(bridge);
  await handler.send('GRID_CONNECT_SOC',{delta:1});
  assert.deepEqual(hass.requests.at(-1),{domain:'number',service:'set_value',data:{entity_id:'number.grid_connect_soc',value:25}});
  await handler.send('CHG_SWITCH',{enabled:false});
  assert.equal(hass.requests.at(-1).service,'turn_off');
  hass.states[bridge.E.CHG_SWITCH].state='unavailable';
  const count=hass.requests.length;assert.equal(await handler.send('CHG_SWITCH',{enabled:true}),false);assert.equal(hass.requests.length,count);
});
test('duplicate in-flight controls cannot send twice',async()=>{
  const { createControlHandler }=await import('../src/controls.js');const hass=createHassFixture();const bridge=new HABridge();bridge.update(hass);
  let resolve;let count=0;hass.callService=()=>{count++;return new Promise(r=>resolve=r);};const handler=createControlHandler(bridge);
  const first=handler.send('CHG_SWITCH',{enabled:false});await handler.send('CHG_SWITCH',{enabled:false});assert.equal(count,1);resolve();await first;
});
