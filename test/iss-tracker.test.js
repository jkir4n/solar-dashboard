import test from 'node:test';
import assert from 'node:assert/strict';
test('ISS requires fresh successful observation and disposal cancels callbacks',async()=>{
  const {ISSTracker}=await import('../src/iss-tracker.js');let now=1000000,changes=0;
  const tracker=new ISSTracker({now:()=>now,getLocation:()=>({latitudeDeg:0,longitudeDeg:0,elevationM:0}),onChange:()=>changes++,fetcher:async()=>({ok:true,json:async()=>({latitude:0,longitude:0,altitude:420,visibility:'visible',timestamp:now/1000})})});
  await tracker.refresh();assert.ok(tracker.snapshot().elevationDeg>89);assert.equal(changes,1);
  now+=31000;assert.equal(tracker.snapshot(),null);tracker.dispose();await tracker.refresh();assert.equal(changes,1);
});
