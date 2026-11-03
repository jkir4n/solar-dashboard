import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,DirectionalLight,HemisphereLight,Vector3} from 'three';
import {SkyEnvironment} from '../src/scene/sky-environment.js';
import {computeSky} from '../src/scene/sky-state.js';
test('disc and sunlight use one direction, daylight stars are transparent, and buffers are reused',()=>{
  const world=new Scene(),light=new DirectionalLight(),ambient=new HemisphereLight(),sky=new SkyEnvironment(world,light,ambient);
  const location={latitudeDeg:11,longitudeDeg:76.9,elevationM:400};
  const state=computeSky(new Date('2026-10-31T07:00:00Z'),location,{weather:{condition:'sunny',cloud_coverage:0,visibility:20000}});
  sky.setState(state);
  assert.ok(sky.sun.position.clone().normalize().distanceTo(light.position.clone().normalize())<1e-6);
  assert.ok(sky.sun.position.clone().normalize().distanceTo(new Vector3(...state.sun.direction))<1e-6);
  const attribute=sky.stars.geometry.attributes.position;sky.setState(state);assert.equal(sky.stars.geometry.attributes.position,attribute);
  assert.ok(state.stars.every(star=>star.visibility===0));
  sky.setState(computeSky(new Date('2026-10-31T18:00:00Z'),location,{weather:{condition:'clear-night',cloud_coverage:0}}));
  assert.equal(light.intensity,0);assert.equal(sky.sun.visible,false);sky.dispose();assert.equal(world.children.length,0);
});

test('WeatherParticles integrates in SkyEnvironment with roof and plinth height collision',()=>{
  const world=new Scene(),light=new DirectionalLight(),ambient=new HemisphereLight(),sky=new SkyEnvironment(world,light,ambient);
  assert.ok(sky.particles, 'WeatherParticles exists');
  // Check roof and plinth surfaceHeight collision callback
  assert.equal(sky.surfaceHeight(5, -2), 0, 'plinth surface height');
  assert.equal(sky.surfaceHeight(-0.5, -0.8), 3.36, 'main roof surface height');
  assert.equal(sky.surfaceHeight(2.35, 2.25), 2.7, 'battery annex roof surface height');

  const location={latitudeDeg:11,longitudeDeg:76.9,elevationM:400};
  const rainState=computeSky(new Date('2026-10-31T07:00:00Z'),location,{weather:{condition:'rainy',cloud_coverage:80,visibility:10000}});
  sky.setState(rainState);
  assert.equal(sky.particles.kind, 'rain');
  sky.tick(0.02);
  assert.ok(sky.particles.time > 0);

  sky.dispose();
  assert.equal(world.children.length, 0, 'full disposal leaves zero world children');
});

test('4-way setTheme updates correctly across dark/light and day/night',()=>{
  const world=new Scene(),light=new DirectionalLight(),ambient=new HemisphereLight(),sky=new SkyEnvironment(world,light,ambient);
  const location={latitudeDeg:11,longitudeDeg:76.9,elevationM:400};
  const dayState=computeSky(new Date('2026-10-31T07:00:00Z'),location,{weather:{condition:'sunny',cloud_coverage:0,visibility:20000}});
  const nightState=computeSky(new Date('2026-10-31T18:00:00Z'),location,{weather:{condition:'clear-night',cloud_coverage:0,visibility:20000}});

  // 1. Dark + Day
  sky.setTheme('dark');
  sky.setState(dayState);
  assert.equal(sky.uniforms.theme.value, 0);
  assert.ok(ambient.intensity > 1.5, 'dark day ambient');

  // 2. Light + Day
  sky.setTheme('light');
  assert.equal(sky.uniforms.theme.value, 1);
  assert.equal(ambient.color.getHexString(), 'eaf2f8');

  // 3. Dark + Night
  sky.setTheme('dark');
  sky.setState(nightState);
  assert.equal(sky.uniforms.theme.value, 0);
  assert.equal(ambient.color.getHexString(), '1a2436');
  assert.equal(ambient.intensity, 0.28);

  // 4. Light + Night (cohesive twilight-slate/indigo, not pitch-black)
  sky.setTheme('light');
  assert.equal(sky.uniforms.theme.value, 1);
  assert.equal(ambient.color.getHexString(), '3a4f6e');
  assert.equal(ambient.intensity, 0.52);

  sky.dispose();
});

test('Moon terminator uniforms and moonlight illumination are accurately passed',()=>{
  const world=new Scene(),light=new DirectionalLight(),ambient=new HemisphereLight(),sky=new SkyEnvironment(world,light,ambient);
  const location={latitudeDeg:11,longitudeDeg:76.9,elevationM:400};
  // October 31, 2026 ~23:00 UTC (moon is visible at night)
  const nightMoon=computeSky(new Date('2026-10-31T23:00:00Z'),location,{weather:{condition:'clear-night',cloud_coverage:10,visibility:20000}});
  sky.setState(nightMoon);

  assert.ok(sky.moon.material.uniforms.lamp.value.length() > 0, 'moon lamp uniform is non-zero vector');
  assert.ok(Number.isFinite(sky.moon.material.uniforms.phaseAngle.value), 'phaseAngle uniform set');
  if (nightMoon.moon.elevationDeg > 0) {
    assert.ok(sky.moonLight.intensity > 0, 'moonlight shines when moon above horizon at night');
  }
  sky.dispose();
});

test('rainbow generates 40-second post-rain afterglow when rain clears under low sun',()=>{
  const world=new Scene(),light=new DirectionalLight(),ambient=new HemisphereLight(),sky=new SkyEnvironment(world,light,ambient);
  const location={latitudeDeg:11,longitudeDeg:76.9,elevationM:400};
  // Sun at ~25° elevation
  const rainState=computeSky(new Date('2026-10-31T03:00:00Z'),location,{weather:{condition:'rainy',cloud_coverage:60,visibility:15000}});
  sky.setState(rainState);
  assert.ok(sky.uniforms.rainbow.value > 0, 'rainbow active during rain with sun');

  // Rain clears to sunny under same sun elevation
  const clearState=computeSky(new Date('2026-10-31T03:00:00Z'),location,{weather:{condition:'sunny',cloud_coverage:20,visibility:20000}});
  sky.setState(clearState);
  assert.ok(sky.uniforms.rainbow.value > 0, 'rainbow afterglow immediately after rain clears');
  assert.equal(sky.rainbowAfterglow, 40, 'afterglow timer set to 40 seconds');

  // Advance 20 seconds
  sky.tick(20);
  assert.ok(sky.uniforms.rainbow.value > 0, 'rainbow still visible at 20s');
  assert.ok(Math.abs(sky.rainbowAfterglow - 20) < 0.1);

  // Advance another 21 seconds (total 41s > 40s)
  sky.tick(21);
  assert.equal(sky.rainbowAfterglow, 0, 'afterglow expired');
  assert.equal(sky.uniforms.rainbow.value, 0, 'rainbow faded completely');

  sky.dispose();
});
