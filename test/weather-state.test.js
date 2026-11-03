import test from 'node:test';
import assert from 'node:assert/strict';
import { HABridge } from '../src/ha-bridge.js';
import { createHassFixture } from '../dev/fixtures.js';
test('weather units normalize and wind wraps over north',async()=>{
  const {normalizeWeather,blendBearing}=await import('../src/weather-state.js');
  const a=normalizeWeather({temperature:68,temperature_unit:'°F',wind_speed:36,wind_speed_unit:'km/h',visibility:10,visibility_unit:'km',pressure:1013,pressure_unit:'hPa'});
  assert.equal(a.temperature,20);assert.equal(a.wind_speed,10);assert.equal(a.visibility,10000);assert.equal(a.pressure,1013);
  assert.equal(blendBearing(359,1,.5),0);assert.equal(normalizeWeather({}).temperature,null);
});
test('disconnected weather expires but steady connected weather remains current',async()=>{
  const {WeatherState}=await import('../src/weather-state.js');let now=1000000;
  const hass=createHassFixture();const bridge=new HABridge();bridge.update(hass);const wx=new WeatherState(bridge,{now:()=>now});
  wx.update();now+=3600000;wx.update();assert.equal(wx.snapshot().quality,'current');
  hass.connection.connected=false;now+=900001;wx.update();assert.equal(wx.snapshot().quality,'stale');wx.dispose();
});
test('current rain vetoes an optimistic forecast and unavailable weather stays unknown',async()=>{
  const {WeatherState}=await import('../src/weather-state.js');let now=Date.now();const hass=createHassFixture('charging',{condition:'rainy',now});const bridge=new HABridge();bridge.update(hass);
  const wx=new WeatherState(bridge,{now:()=>now});wx.update();
  for(let i=0;i<3;i++)await wx.refreshForecast();
  assert.equal(wx.snapshot().condition,'rainy');
  hass.states['weather.home'].state='unavailable';wx.update();assert.equal(wx.snapshot().quality,'unknown');wx.dispose();
});
test('disposing a pending forecast clears its deadline and cannot publish a response',async()=>{
  const {WeatherState}=await import('../src/weather-state.js');const hass=createHassFixture(),bridge=new HABridge();bridge.update(hass);let publish=0;
  hass.callWS=()=>new Promise(()=>{});
  const wx=new WeatherState(bridge,{onChange:()=>publish++});wx.update();const pending=wx.refreshForecast();wx.dispose();await pending;
  assert.equal(publish,1);assert.equal(wx.inFlight,false);assert.equal(wx.timer,null);
});
