const rad=Math.PI/180;
function earthPoint(lat,lon,heightKm){const sin=Math.sin(lat*rad),cos=Math.cos(lat*rad),n=6378.137/Math.sqrt(1-.00669437999*sin*sin);return [(n+heightKm)*cos*Math.cos(lon*rad),(n+heightKm)*cos*Math.sin(lon*rad),(n*(1-.00669437999)+heightKm)*sin];}
export class ISSTracker {
  constructor({getLocation,now=Date.now,onChange=()=>{},fetcher=(...args)=>fetch(...args)}){Object.assign(this,{getLocation,now,onChange,fetcher});this.delay=10000;this.generation=0;}
  start(){if(this.running||this.disposed)return;this.running=true;this.refresh();}
  async refresh(){
    if(this.disposed||this.inFlight)return;const location=this.getLocation();if(!location){if(this.running)this.timer=setTimeout(()=>this.refresh(),10000);return;}
    this.inFlight=true;const generation=++this.generation,locationKey=JSON.stringify(location);this.controller=new AbortController();
    const timeout=this.requestTimeout=setTimeout(()=>this.controller.abort(),8000);
    try{
      const response=await this.fetcher('https://api.wheretheiss.at/v1/satellites/25544?units=kilometers',{signal:this.controller.signal});
      if(!response.ok)throw new Error('ISS unavailable');const data=await response.json();
      if(this.disposed||generation!==this.generation||JSON.stringify(this.getLocation())!==locationKey)return;
      if(![data.latitude,data.longitude,data.altitude,data.timestamp].every(Number.isFinite))throw new Error('Invalid ISS data');
      const target=earthPoint(data.latitude,data.longitude,data.altitude),observer=earthPoint(location.latitudeDeg,location.longitudeDeg,(location.elevationM||0)/1000);
      const [x,y,z]=target.map((v,i)=>v-observer[i]),lat=location.latitudeDeg*rad,lon=location.longitudeDeg*rad;
      const east=-Math.sin(lon)*x+Math.cos(lon)*y,north=-Math.sin(lat)*Math.cos(lon)*x-Math.sin(lat)*Math.sin(lon)*y+Math.cos(lat)*z,up=Math.cos(lat)*Math.cos(lon)*x+Math.cos(lat)*Math.sin(lon)*y+Math.sin(lat)*z;
      this.locationKey=locationKey;
      this.value={azimuthDeg:(Math.atan2(east,north)/rad+360)%360,elevationDeg:Math.atan2(up,Math.hypot(east,north))/rad,sunlit:data.visibility==='visible'||data.visibility==='daylight',observedAtMs:data.timestamp*1000};this.delay=10000;this.onChange(this.snapshot());
    }catch{if(generation===this.generation&&!this.disposed){this.value=null;this.delay=Math.min(300000,this.delay*2);this.onChange(null);}}
    finally{clearTimeout(timeout);this.inFlight=false;if(this.running&&!this.disposed)this.timer=setTimeout(()=>this.refresh(),this.delay);}
  }
  snapshot(){return this.value&&this.locationKey===JSON.stringify(this.getLocation())&&Math.abs(this.now()-this.value.observedAtMs)<=30000?this.value:null;}
  stop(){this.running=false;this.generation++;clearTimeout(this.timer);clearTimeout(this.requestTimeout);this.controller?.abort();this.value=null;}
  dispose(){this.disposed=true;this.stop();}
}
