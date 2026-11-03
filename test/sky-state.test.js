import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSky, direction, visibility } from '../src/scene/sky-state.js';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/astronomy.json',import.meta.url)));
for(const reference of fixtures.cases.filter(c=>c.source.name==='NASA/JPL Horizons'))test(`independent astronomy: ${reference.id}`,()=>{
  const sky=computeSky(new Date(reference.utcInstant),reference.site,{refraction:false});
  for(const name of ['sun','moon','planet']){
    const expected=reference[name];if(!expected)continue;
    const actual=name==='planet'?sky.planets.find(p=>p.name===expected.name):sky[name];
    const vector=direction(expected.azimuthDeg,expected.elevationDeg),dot=vector.reduce((s,v,i)=>s+v*actual.direction[i],0);
    const error=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
    assert.ok(error<(name==='sun'?.5:1),`${name} separation ${error}°`);
    if(expected.illuminationFraction!=null)assert.ok(Math.abs(expected.illuminationFraction-actual.illumination)<.02,`${name} illumination`);
  }
});
test('missing weather cannot promise stars, and moonlight reduces their visibility',()=>{
  assert.equal(visibility(45,2,{},-18),0);
  assert.ok(visibility(45,3,{cloud_coverage:0,visibility:20000},-18,1)<visibility(45,3,{cloud_coverage:0,visibility:20000},-18,0));
});
// Independent JPL Horizons observer ephemerides, retrieved 2026-10-31.
// CENTER=coord@399, SITE_COORD=76.9,11,0.4, APPARENT=AIRLESS, QUANTITIES=4,9,10.
// https://ssd.jpl.nasa.gov/api/horizons.api ; tolerance 0.05 degree.
test('Sun Moon and Venus agree with independent JPL observer ephemerides',async()=>{
  const {computeSky}=await import('../src/scene/sky-state.js');
  const sky=computeSky(new Date('2026-10-31T07:00:00Z'),{latitudeDeg:11,longitudeDeg:76.9,elevationM:400},{refraction:false});
  for(const [body,az,alt]of [[sky.sun,193.444810,64.173137],[sky.moon,300.264866,-15.577577],[sky.planets.find(p=>p.name==='Venus'),215.905803,58.109474]]){
    assert.ok(Math.abs(body.azimuthDeg-az)<.05,`${body.name} azimuth ${body.azimuthDeg}`);assert.ok(Math.abs(body.elevationDeg-alt)<.05,`${body.name} altitude ${body.elevationDeg}`);
  }
  assert.ok(Math.abs(sky.moon.illumination-.6826708)<.005);
  assert.ok(Number.isFinite(sky.moon.phaseAngle) && sky.moon.phaseAngle > 0 && sky.moon.phaseAngle < 180, 'moon phase angle');
  assert.ok(sky.milkyWay && Array.isArray(sky.milkyWay.pole), 'milkyWay pole exposed');
});
test('compass convention and weather visibility share physical direction',async()=>{
  const {direction,visibility}=await import('../src/scene/sky-state.js');
  assert.deepEqual(direction(0,0),[0,0,-1]);assert.ok(direction(90,0)[0]>.999);
  assert.equal(visibility(-2,1,{},-15),0);assert.equal(visibility(45,4,{cloud_coverage:100},-15),0);
  assert.equal(visibility(45,4,{cloud_coverage:0},20),0);assert.ok(visibility(45,1,{cloud_coverage:0,visibility:20000},-15)>.5);
});
