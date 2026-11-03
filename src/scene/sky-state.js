import { Observer, Equator, Horizon, Illumination, MoonPhase, Rotation_EQJ_HOR, RotateVector, Vector } from 'astronomy-engine';
import { stars } from './star-catalogue.js';
const rad=Math.PI/180;
const clamp=(v)=>Math.max(0,Math.min(1,v));
// Scene axes: +X east, +Y up, -Z geographic north.
export function direction(azimuthDeg,elevationDeg){const az=azimuthDeg*rad,el=elevationDeg*rad;return [Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)];}
export function visibility(elevationDeg,magnitude,weather={},sunElevation=-18,moonGlow=0){
  if(elevationDeg<=0||sunElevation>=0||weather.cloud_coverage==null)return 0;
  const night=clamp((-sunElevation-3)/15),cloud=clamp((weather.cloud_coverage??0)/100),clarity=clamp((weather.visibility??20000)/20000);
  const horizon=clamp(elevationDeg/12),limit=-1+7*night;
  return clamp((limit-magnitude+1-moonGlow*2)/2)*horizon*(1-cloud)**3*Math.sqrt(clarity)*(1-.4*moonGlow)*clamp(-sunElevation/4);
}
export function computeSky(date,location,{weather={},refraction=true,iss=null}={}){
  if(!location||!Number.isFinite(date?.getTime())||![location.latitudeDeg,location.longitudeDeg,location.elevationM??0].every(Number.isFinite)||Math.abs(location.latitudeDeg)>90||Math.abs(location.longitudeDeg)>180)return null;
  const observer=new Observer(location.latitudeDeg,location.longitudeDeg,location.elevationM||0);
  const body=name=>{const eq=Equator(name,date,observer,true,true),h=Horizon(date,observer,eq.ra,eq.dec,refraction?'normal':undefined),illum=Illumination(name,date);return {name,azimuthDeg:h.azimuth,elevationDeg:h.altitude,direction:direction(h.azimuth,h.altitude),magnitude:illum.mag,illumination:illum.phase_fraction,phaseAngle:illum.phase_angle,distanceAU:eq.dist};};
  const sun=body('Sun'),moon=body('Moon');moon.phaseDeg=MoonPhase(date);
  const lamp=sun.direction.map((v,i)=>v*sun.distanceAU-moon.direction[i]*moon.distanceAU),length=Math.hypot(...lamp);
  moon.sunDirection=lamp.map(v=>v/length);
  moon.illumination=(1-moon.sunDirection.reduce((sum,v,i)=>sum+v*moon.direction[i],0))/2;
  const planets=['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'].map(body);
  const moonGlow=moon.elevationDeg>0?moon.illumination*Math.min(1,moon.elevationDeg/20):0;
  for(const p of planets)p.visibility=visibility(p.elevationDeg,p.magnitude,weather,sun.elevationDeg,moonGlow);
  const rotation=Rotation_EQJ_HOR(date,observer);
  const rotate=(ra,dec)=>{const c=Math.cos(dec*rad),v=RotateVector(rotation,new Vector(c*Math.cos(ra*15*rad),c*Math.sin(ra*15*rad),Math.sin(dec*rad),date));return [-v.y,v.z,-v.x];};
  const catalogue=stars.map(([name,ra,dec,magnitude,colorIndex])=>{const vector=rotate(ra,dec);return {id:`hyg-${ra}-${dec}-${magnitude}`,name,direction:vector,magnitude,colorIndex,visibility:visibility(Math.asin(vector[1])/rad,magnitude,weather,sun.elevationDeg,moonGlow)};});
  // Galactic north pole in J2000 defines the Milky Way's great-circle plane.
  const galacticPole=rotate(192.85948 / 15,27.12825);
  const satellite=iss&&iss.sunlit&&sun.elevationDeg<-6&&iss.elevationDeg>5?{...iss,direction:direction(iss.azimuthDeg,iss.elevationDeg),visibility:visibility(iss.elevationDeg,-2,weather,sun.elevationDeg)}:null;
  return {date,location,sun,moon,planets,stars:catalogue,galacticPole,milkyWay:{pole:galacticPole,rotation},iss:satellite,weather};
}
