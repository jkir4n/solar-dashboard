import { t } from '../i18n.js';

// Move established telemetry nodes into the new shell, preserving their IDs and update paths.
export function createHud(root, { lang = 'en', onSelect, onCutaway, onMoreInfo, onRange } = {}) {
  const dash = root.querySelector('.dashboard-root');
  const nodes = {
    battery: root.getElementById('batteryHero'), solar: root.getElementById('solarCard'), controls: root.getElementById('controlsCard'),
    cells: root.getElementById('pack1')?.closest('.card'), charts: root.getElementById('chartsCard'), clock: root.getElementById('clock'),
    gridInfo: root.getElementById('gridInfo'),
  };
  const zones = ['solar','home','battery','grid'];
  // Unknown conditions/qualities fall back to the raw id rather than a missing-key string.
  const tr = (prefix, id) => { if (!id) return '—'; const key = prefix + (id === 'windy-variant' ? 'windy' : id), v = t(lang, key); return v === key ? id.replaceAll('-', ' ') : v; };
  const condLabel = id => tr('cond_', id), qualityLabel = id => tr('quality_', id);
  const zoneLabel = zone => zone==='cells'?t(lang,'cellsC1C8').replace('8','16'):t(lang,zone);
  dash.innerHTML = `<header class="command-header"><div class="solar-brand"><span>✳</span>${t(lang,'solar')}</div><div class="connection-status"><i></i><span>${t(lang,'live')}</span></div><div id="clockSlot"></div></header>
    <div class="energy-summary">${zones.map(zone => `<button class="energy-metric" data-zone="${zone}"><span><i class="dot-${zone}"></i>${zoneLabel(zone)}</span><strong id="energy-${zone}">—</strong><small id="energy-note-${zone}"></small></button>`).join('')}</div>
    <div class="world-container"><canvas id="sceneCanvas" tabindex="0" aria-label="${t(lang,'powerFlow')}"></canvas><div id="sceneStatus" role="status" hidden></div><div class="world-badges">${zones.map(zone => `<button class="world-badge" data-zone="${zone}" id="badge-${zone}"><i class="dot-${zone}"></i><span>${zoneLabel(zone)}</span><strong>—</strong></button>`).join('')}</div></div>
    <nav class="scene-navigation" aria-label="${t(lang,'controls')}"><button data-zone="overview">⌂</button><button id="cutawayBtn" aria-label="Cutaway" aria-pressed="false">◫</button>${['solar','battery','cells','controls','grid'].map(zone=>`<button data-zone="${zone}">${zoneLabel(zone)}</button>`).join('')}</nav>
    <aside class="equipment-inspector" aria-label="${t(lang,'analytics')}"><div class="inspector-heading"><span id="inspectorTitle"></span><button id="inspectorClose" aria-label="Close">×</button></div><div class="inspector-panels">
    ${['solar','battery','cells','controls','grid','home'].map(zone=>`<section data-panel="${zone}" ${zone==='solar'?'':'hidden'}></section>`).join('')}
    </div><button class="more-info" id="equipmentMoreInfo">${t(lang,'moreInfo')} ↗</button></aside>
    <section class="environment-panel"><div class="environment-caption">${t(lang,'weather')}</div><strong id="environmentCondition">—</strong><span id="environmentDetail">—</span><span id="skySummary">—</span><details class="weather-details"><summary>${t(lang,'weather')}</summary><dl id="weatherDetails"></dl><p>${t(lang,'atmosphericNote')}</p><button data-zone="sky">☾ ${t(lang,'sky')}</button></details></section>
    <section class="analytics-dock"><button id="analyticsToggle" aria-expanded="true">${t(lang,'analytics')} <span>⌄</span></button><div id="analyticsContent"></div></section>
    <div class="scene-footer"><span id="energyProvenance"></span><span id="skyQuality"></span></div>`;
  for (const zone of ['solar','battery','cells','controls']) if (nodes[zone]) dash.querySelector(`[data-panel="${zone}"]`).append(nodes[zone]);
  dash.querySelector('#clockSlot').append(nodes.clock);
  dash.querySelector('#analyticsContent').append(nodes.charts);
  const gridPanel=dash.querySelector('[data-panel="grid"]');
  gridPanel.innerHTML=`<h2>${t(lang,'grid')}</h2><p id="gridAvailability">—</p><div id="gridLivePower" class="large-reading">—</div>`;
  if(nodes.gridInfo){ nodes.gridInfo.style.display='flex';gridPanel.append(nodes.gridInfo); }
  dash.querySelector('[data-panel="home"]').innerHTML=`<h2>${t(lang,'home')}</h2><div id="homeLivePower" class="large-reading">—</div><p class="measurement-note">${t(lang,'power')} · ${t(lang,'home')}</p>`;
  const events = new AbortController();
  let selected='solar', cutaway=false;
  const select=zone=>{
    if(zone==='overview'||zone==='sky'){dash.querySelector('.equipment-inspector').classList.remove('open');return;}dash.querySelector('.weather-details').open=false;
    selected=zone;dash.querySelector('#inspectorTitle').textContent=zoneLabel(zone);
    dash.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==zone);
    dash.querySelectorAll('[data-zone]').forEach(b=>b.classList.toggle('selected',b.dataset.zone===zone));
    dash.querySelector('.equipment-inspector').classList.add('open');
  };
  dash.addEventListener('click',event=>{
    const zone=event.target.closest('[data-zone]')?.dataset.zone;
    if(zone){select(zone);onSelect?.(zone);}
    if(event.target.closest('#cutawayBtn')){cutaway=!cutaway;dash.querySelector('#cutawayBtn').setAttribute('aria-pressed',String(cutaway));onCutaway?.(cutaway);}
    if(event.target.closest('#inspectorClose')){dash.querySelector('.equipment-inspector').classList.remove('open');dash.querySelectorAll('[data-zone]').forEach(b=>b.classList.remove('selected'));}
    if(event.target.closest('#equipmentMoreInfo'))onMoreInfo?.(selected);
    if(event.target.closest('#analyticsToggle')){const closed=dash.querySelector('.analytics-dock').classList.toggle('collapsed');dash.querySelector('#analyticsToggle').setAttribute('aria-expanded',String(!closed));if(!closed)onRange?.(true);}
  },{signal:events.signal});
  dash.querySelector('.weather-details').addEventListener('toggle',event=>{dash.classList.toggle('weather-expanded',event.target.open);},{signal:events.signal});  const fmt = value => value == null ? '—' : `${(value/1000).toFixed(2)} kW`;
  select('solar');dash.querySelector('.equipment-inspector').classList.remove('open');
  return {
    select,
    updateEnergy(state){
      const values={solar:fmt(state.solarW),home:fmt(state.homeW),battery:state.socPct==null?'—':`${Math.round(state.socPct)}%`,grid:fmt(state.gridW)};
      for(const zone of zones){dash.querySelector(`#energy-${zone}`).textContent=values[zone];dash.querySelector(`#badge-${zone} strong`).textContent=values[zone];}
      dash.querySelector('#energy-note-battery').textContent=state.batteryW==null?'—':`${t(lang,state.batteryW>0?'charging':state.batteryW<0?'discharging':'idle')} ${fmt(Math.abs(state.batteryW))}`;
      dash.querySelector('#gridLivePower').textContent=fmt(state.gridW);dash.querySelector('#homeLivePower').textContent=fmt(state.homeW);
      dash.querySelector('#gridAvailability').textContent=state.gridAvailable==null?'—':state.gridAvailable?t(lang,'live'):t(lang,'offline');
      dash.querySelector('#energyProvenance').textContent=state.provenance.homeW.kind==='derived'?t(lang,'homeDerived'):state.homeW==null?t(lang,'homeUnavailable'):t(lang,'homeMeasured');
    },
    updateWeather(snapshot){
      const w=snapshot.effective,fmt=(v,unit)=>v==null?'—':`${Math.round(v)}${unit}`;
      dash.querySelector('#environmentCondition').textContent=condLabel(snapshot.condition);
      dash.querySelector('#environmentDetail').textContent=`${fmt(w.temperature,'°C')} · ${qualityLabel(snapshot.quality)}`;
      const fields=[[t(lang,'wind'),w.wind_speed,' m/s'],[t(lang,'gusts'),w.wind_gust_speed,' m/s'],[t(lang,'bearing'),w.wind_bearing,'°'],[t(lang,'humidity'),w.humidity,'%'],[t(lang,'cloud'),w.cloud_coverage,'%'],[t(lang,'visibility'),w.visibility==null?null:w.visibility/1000,' km'],[t(lang,'pressure'),w.pressure,' hPa'],[t(lang,'dewPoint'),w.dew_point,'°C'],[t(lang,'uvIndex'),w.uv_index,''],[t(lang,'rainRate'),w.precipitation_intensity,' mm/h'],[t(lang,'rainProbability'),w.precipitation_probability,'%']];
      const details=dash.querySelector('#weatherDetails');
      if(!details.children.length)for(const [label]of fields){const term=document.createElement('dt'),value=document.createElement('dd');term.textContent=label;details.append(term,value);}
      fields.forEach(([,value,unit],i)=>{details.children[i*2+1].textContent=value==null?'—':`${Number(value.toFixed(1))}${unit}`;});
      const emojiMap={'clear-night':'🌙',cloudy:'☁️',exceptional:'✨',fog:'🌫️',hail:'🌨️',lightning:'⚡','lightning-rainy':'⛈️',partlycloudy:'⛅',pouring:'🌧️',rainy:'🌦️',snowy:'❄️','snowy-rainy':'🌨️',sunny:'☀️',windy:'💨','windy-variant':'🌬️'};
      const wxEmojiEl=dash.querySelector('#wxEmoji');if(wxEmojiEl)wxEmojiEl.textContent=emojiMap[snapshot.condition]||'🌤️';
      for(const [id,value]of [['wxCondition',condLabel(snapshot.condition)],['wxTemp',fmt(w.temperature,'°C')],['wxCloud',fmt(w.cloud_coverage,'%')],['wxHumid',fmt(w.humidity,'%')],['wxSource',snapshot.source||'']]){
        const el=dash.querySelector('#'+id);if(el)el.textContent=value;
      }
    },
    updateAnchors(projected){for(const zone of zones){const p=projected[zone],el=dash.querySelector(`#badge-${zone}`);el.hidden=!p?.visible;if(p){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;}}},
    dispose(){events.abort();},
  };
}
