import test from 'node:test';
import assert from 'node:assert/strict';
import {ChartManager} from '../src/charts.js';
test('older failed chart requests cannot overwrite a newer range',async()=>{
  const oldWindow=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};
  try{
    let rejectOld;const chart=new ChartManager({fetchHistoryRange:()=>new Promise((_,reject)=>{rejectOld=reject;}),fetchStatsRange:async()=>[]});
    const placeholders=[];chart.showPlaceholder=(_,message)=>placeholders.push(message);
    const old=chart.loadRange('Live',{power:{}},{power:'sensor.pv'},'UTC');
    await chart.loadRange('7D',{power:{}},{power:'sensor.pv'},'UTC');const count=placeholders.length;
    rejectOld(new Error('Old request failed'));await old;assert.equal(placeholders.length,count);
    chart._disposed=true;
    const disposedRes = await chart.loadRange('7D',{}, {power:'sensor.pv'},'UTC');
    assert.equal(disposedRes.powerData,null);
    assert.equal(disposedRes.timeXLabel()(0), '');

    const unconfiguredChart = new ChartManager({});
    const missingRes = await unconfiguredChart.loadRange('Live', {}, {}, 'UTC');
    assert.equal(missingRes.timeXLabel()(0), '');
  }finally{globalThis.window=oldWindow;}
});
