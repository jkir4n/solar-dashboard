import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherEffects,cloudArchetypes} from '../src/scene/weather-effects.js';
import {conditions} from '../dev/fixtures.js';
test('all HA conditions have cloud profiles and no unsupported celestial events',()=>{
  assert.equal(cloudArchetypes.length,7);
  for(const condition of conditions){const fx=weatherEffects({condition});assert.ok(fx.known,condition);assert.ok(!fx.aurora&&!fx.halo&&!fx.meteor);}
  const unknown=weatherEffects({});assert.ok(!unknown.rain&&!unknown.snow&&!unknown.rainbow&&!unknown.lightning);
});
test('wind moves away from meteorological bearing and sleet has rain and snow',()=>{
  const wind=weatherEffects({wind_bearing:90,wind_speed:10}).wind;
  assert.ok(wind[0]<-9.999);assert.ok(Math.abs(wind[2])<1e-6);
  assert.ok(weatherEffects({condition:'snowy-rainy'}).snow&&weatherEffects({condition:'snowy-rainy'}).rain);
});
test('rainbows require rain, visible sunlight, and atmospheric support',()=>{
  const wet={condition:'rainy',visibility:15000,cloud_coverage:60};
  assert.ok(weatherEffects(wet,20).rainbow);
  for(const altitude of [-10,0,45])assert.equal(weatherEffects(wet,altitude).rainbow,false);
  assert.equal(weatherEffects({...wet,condition:'sunny'},20).rainbow,false);
  assert.equal(weatherEffects({...wet,visibility:1000},20).rainbow,false);
});
