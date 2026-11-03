const finite = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const clamp = (v,min,max) => v == null ? null : Math.max(min,Math.min(max,v));
const cloudFallback = { sunny:0,'clear-night':0,partlycloudy:40,cloudy:90,rainy:85,pouring:100,lightning:95,'lightning-rainy':100,snowy:90,'snowy-rainy':95,hail:95,fog:100,windy:25,'windy-variant':70 };
export function blendBearing(a,b,w) { if(a==null)return b;if(b==null)return a;return ((a+(((b-a+540)%360)-180)*w)%360+360)%360; }
export function normalizeWeather(attrs = {}, units = attrs) {
  const temp = v => {v=finite(v);return v==null?null:units.temperature_unit==='°F'?(v-32)*5/9:v;};
  const wind = v => {v=finite(v);return v==null?null:Math.max(0,v*({'km/h':1/3.6,mph:.44704,kn:.514444,'m/s':1}[units.wind_speed_unit]??1));};
  const vis = finite(attrs.visibility), pressure=finite(attrs.pressure);
  return {
    cloud_coverage:clamp(finite(attrs.cloud_coverage),0,100),temperature:temp(attrs.temperature),apparent_temperature:temp(attrs.apparent_temperature),dew_point:temp(attrs.dew_point),
    humidity:clamp(finite(attrs.humidity),0,100),uv_index:clamp(finite(attrs.uv_index),0,30),pressure:pressure==null?null:pressure*({Pa:.01,kPa:10,inHg:33.8639,hPa:1,mbar:1}[units.pressure_unit]??1),
    wind_speed:wind(attrs.wind_speed),wind_gust_speed:wind(attrs.wind_gust_speed),wind_bearing:finite(attrs.wind_bearing)==null?null:blendBearing(finite(attrs.wind_bearing),0,0),
    visibility:vis==null?null:Math.max(0,vis*({km:1000,mi:1609.344,m:1}[units.visibility_unit]??1000)),
    precipitation_intensity:finite(attrs.precipitation_intensity)==null?null:Math.max(0,finite(attrs.precipitation_intensity))*((units.precipitation_unit==='in'||units.precipitation_unit==='in/h')?25.4:1),precipitation_probability:clamp(finite(attrs.precipitation_probability),0,100),thunderstorm_probability:clamp(finite(attrs.thunderstorm_probability),0,100),
    heat_index:temp(attrs.heat_index??attrs.apparent_temperature),wind_chill:temp(attrs.wind_chill??attrs.temperature),twilightFactor:null,moon_illumination:null,
  };
}

export class WeatherState {
  constructor(bridge,{now=Date.now,onChange=()=>{}}={}){this.bridge=bridge;this.now=now;this.onChange=onChange;this.value={condition:null,effective:normalizeWeather(),quality:'unknown',updatedAtMs:null};this.generation=0;this.lastSuccess=null;}
  start(){if(this.timer||this.disposed)return;this.update();this.refreshForecast();this.timer=setInterval(()=>{this.update();this.refreshForecast();},300000);}
  update(){
    if(this.disposed)return;
    const entries=Object.entries(this.bridge.hass?.states||{}).filter(([id,s])=>id.startsWith('weather.')&&!['unavailable','unknown'].includes(s.state));
    const now=this.now();
    const score=([id,s])=>{
      let p=0;
      if(id.includes('google'))p+=10000;
      else if(id.includes('pirateweather')||id.includes('pirate_weather'))p+=8000;
      else if(id.includes('metno')||id.includes('met_no'))p+=6000;
      const updated=Date.parse(s.last_updated||s.last_changed);
      const isFresh=Number.isFinite(updated)?(now-updated<1800000):true;
      if(isFresh)p+=1000;
      p+=Object.keys(s.attributes||{}).length;
      return p;
    };
    entries.sort((a,b)=>score(b)-score(a));
    const found=entries[0];
    if(!found){this.generation++;this.entityId=null;this.forecast=null;this.stability=0;this.value={condition:null,effective:normalizeWeather(),quality:'unknown',updatedAtMs:null};this.onChange(this.value);return;}
    const [id,state]=found;
    if(id!==this.entityId){this.generation++;this.entityId=id;this.forecast=null;this.stability=0;}
    const connected=this.bridge.hass?.connection?.connected!==false;
    if(connected)this.lastSuccess=now;
    const stale=!connected&&(this.lastSuccess==null||now-this.lastSuccess>900000);
    const attrs=state.attributes||{},effective=normalizeWeather(attrs),aux=this.bridge.getWeatherAuxSnap(id);
    if(effective.cloud_coverage==null)effective.cloud_coverage=cloudFallback[state.state]??null;
    for(const [key,source] of [['precipitation_intensity','precipIntensity'],['precipitation_probability','precipProb'],['thunderstorm_probability','thunderstormProb']])if(finite(aux[source])!=null)effective[key]=finite(aux[source]);
    const fc=this.forecast,minutes=fc?(Date.parse(fc.datetime)-now)/60000:0;
    let w=0;
    if(!stale&&fc&&this.stability>=3&&minutes>0&&minutes<=90){
      const actual=effective.cloud_coverage,predicted=finite(fc.cloud_coverage);
      const corroboration=actual==null||predicted==null?0:Math.max(0,1-Math.abs(actual-predicted)/30);
      w=Math.min(1/(1+Math.exp(-(minutes-25)/8)),corroboration);
      if((effective.precipitation_intensity??0)>.5||(effective.thunderstorm_probability??0)>40)w=0;
      else if(/rain|lightning/.test(state.state))w*=.2;
      if(w>.7&&state.state!==fc.condition){this.plateauSince??=now;if(now-this.plateauSince>1200000)w=.3;}else this.plateauSince=null;
      const target=normalizeWeather(fc,attrs);
      for(const key of ['cloud_coverage','temperature','apparent_temperature','dew_point','humidity','uv_index','pressure','wind_speed','wind_gust_speed','visibility','precipitation_probability'])if(effective[key]!=null&&target[key]!=null)effective[key]+=(target[key]-effective[key])*w;
      effective.wind_bearing=blendBearing(effective.wind_bearing,target.wind_bearing,w);
    }
    this.value={condition:state.state,effective,quality:stale?'stale':w>0?'forecast-assisted':'current',updatedAtMs:this.lastSuccess,entityId:id,source:attrs.attribution||attrs.friendly_name||id};
    this.onChange(this.value);
  }
  async refreshForecast(){
    if(this.disposed||this.inFlight||!this.entityId||this.bridge.hass?.connection?.connected===false)return;
    this.inFlight=true;const generation=this.generation,id=this.entityId;
    let timeout;
    const cancelled=new Promise((_,reject)=>{this.cancelForecast=()=>reject(new Error('Forecast cancelled'));});
    try{
      const result=await Promise.race([cancelled,this.bridge.hass.callWS({type:'call_service',domain:'weather',service:'get_forecasts',service_data:{type:'hourly'},target:{entity_id:id},return_response:true}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Forecast timeout')),15000);})]);
      if(this.disposed||generation!==this.generation)return;
      const entries=result?.response?.[id]?.forecast||[];
      this.forecast=entries.find(e=>Date.parse(e.datetime)>this.now()+1800000)||entries.find(e=>Date.parse(e.datetime)>this.now())||null;
      const key=this.forecast?.condition;
      this.stability=key&&key===this.pendingCondition?this.stability+1:1;this.pendingCondition=key;
      this.update();
    }catch{if(!this.disposed&&generation===this.generation){this.forecast=null;this.stability=0;this.update();}}
    finally{clearTimeout(timeout);this.inFlight=false;this.cancelForecast=null;}
  }
  snapshot(){return this.value;}
  stop(){this.generation++;clearInterval(this.timer);this.timer=null;this.cancelForecast?.();}
  dispose(){this.disposed=true;this.stop();}
}
