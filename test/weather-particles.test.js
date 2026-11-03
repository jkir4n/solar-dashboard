import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {WeatherParticles} from '../src/scene/weather-particles.js';
import {weatherEffects} from '../src/scene/weather-effects.js';
const create=condition=>{const world=new Scene(),p=new WeatherParticles(world,{random:()=>.5});p.setWeather(weatherEffects({condition}),{condition});p.tick(0);return p;};
test('rain impacts generate short-lived splashes and reset the drop',()=>{
  const p=create('rainy');p.positions.set([0,.1,0],0);p.tick(.02);
  assert.ok(p.positions[1]>17);assert.ok(p.alpha[p.count]>0);
  for(let i=0;i<25;i++)p.tick(.02);assert.equal(p.alpha[p.count],0);p.dispose();
});
test('hail rebounds upward and loses energy on successive impacts',()=>{
  const p=create('hail');p.positions.set([0,.1,0],0);p.tick(.02);const first=p.velocity[0];
  assert.ok(first>0);const y=p.positions[1];p.tick(.02);assert.ok(p.positions[1]>y);
  for(let i=0;i<40&&p.bounces[0]<2;i++)p.tick(.02);
  assert.equal(p.bounces[0],2);assert.ok(p.velocity[0]>0&&p.velocity[0]<first);p.dispose();
});
test('sleet has distinct rain and snow particles and transitions fade before switching',()=>{
  const p=create('snowy-rainy');assert.equal(p.kinds[0],1);assert.equal(p.kinds[1],0);
  p.setWeather(weatherEffects({condition:'rainy'}),{condition:'rainy'});p.tick(.1);
  assert.equal(p.kind,'sleet');assert.ok(p.strength<1&&p.strength>0);
  for(let i=0;i<60;i++)p.tick(.05);assert.equal(p.kind,'rain');assert.ok(p.strength>0);
  p.setWeather(weatherEffects({condition:'sunny'}));for(let i=0;i<60;i++)p.tick(.05);assert.equal(p.points.visible,false);p.dispose();
});
test('reduced motion freezes particles and suppresses impacts',()=>{
  const p=create('rainy'),before=p.positions.slice();p.tick(0);assert.deepEqual(p.positions,before);assert.equal(p.splashCursor,0);p.dispose();
});
