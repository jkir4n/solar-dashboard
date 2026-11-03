import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import { disposeObject } from './house-compound.js';

// Fixed pools keep storm transitions and impacts from allocating GPU resources.
export class WeatherParticles {
  constructor(world,{random=Math.random,surfaceHeight=()=>0}={}) {
    this.random=random;this.surfaceHeight=surfaceHeight;this.count=600;this.splashCount=96;
    this.positions=new Float32Array((this.count+this.splashCount)*3);
    this.kinds=new Float32Array(this.count+this.splashCount);
    this.alpha=new Float32Array(this.count+this.splashCount);
    this.velocity=new Float32Array(this.count);this.bounces=new Uint8Array(this.count);
    this.splashAge=new Float32Array(this.splashCount).fill(1);this.splashCursor=0;this.time=0;this.strength=0;
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('kind',new Float32BufferAttribute(this.kinds,1));
    geometry.setAttribute('alpha',new Float32BufferAttribute(this.alpha,1));
    // Float32BufferAttribute copies arrays; retain the actual upload buffers.
    this.positions=geometry.attributes.position.array;this.kinds=geometry.attributes.kind.array;this.alpha=geometry.attributes.alpha.array;
    this.points=new Points(geometry,new ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:`attribute float kind,alpha;varying float k,a;void main(){k=kind;a=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=kind<.5?9.:kind<1.5?4.:kind<2.5?3.:14.;}`,
      fragmentShader:`varying float k,a;void main(){if(a<=0.)discard;vec2 p=gl_PointCoord-.5;float shape;vec3 color;if(k<.5){shape=1.-smoothstep(.1,.5,length(vec2(p.x*6.,p.y)));color=vec3(.65,.78,.85);}else if(k<2.5){shape=1.-smoothstep(.25,.5,length(p));color=vec3(.91,.95,1.);}else{float radius=length(vec2(p.x,p.y*2.5));shape=(1.-smoothstep(.04,.09,abs(radius-.32)))*(1.-smoothstep(.42,.5,radius));color=vec3(.7,.83,.9);}gl_FragColor=vec4(color,shape*a);}`
    }));
    this.points.frustumCulled=false;world.add(this.points);
    for(let i=0;i<this.count;i++)this.respawn(i,true);
  }
  setWeather(effects,{condition='',precipitation_intensity=null}={}) {
    const next=effects.hail?'hail':effects.rain&&effects.snow?'sleet':effects.snow?'snow':effects.rain?'rain':'dry';
    this.effects=effects;
    // Finish fading the old kind before switching its shape or velocity.
    this.nextKind=next;
    // Constructor respawn ran before any kind existed; reseed with the first real kind's velocities.
    if(this.kind==null){this.kind=next;for(let i=0;i<this.count;i++)this.respawn(i,true);}
    this.density=condition==='pouring'?1:.58;
    if(precipitation_intensity!=null)this.density=Math.max(.15,Math.min(1,precipitation_intensity/8));
    this.dirty=true;
  }
  kindFor(i){return this.kind==='hail'?2:this.kind==='snow'||(this.kind==='sleet'&&i%2===0)?1:0;}
  respawn(i,initial=false){
    this.positions[i*3]=(this.random()-.5)*22;this.positions[i*3+2]=(this.random()-.5)*18;
    this.positions[i*3+1]=initial?8+this.random()*10:18+this.random()*2;
    this.bounces[i]=0;this.velocity[i]=this.kindFor(i)===1?-1.2:this.kindFor(i)===2?-7:-14;
  }
  impact(x,y,z){
    const slot=this.splashCursor++%this.splashCount,i=this.count+slot;
    this.positions.set([x,y+.035,z],i*3);this.kinds[i]=3;this.splashAge[slot]=0;
  }
  tick(dt){
    if(!this.effects)return;
    const switching=this.kind!==this.nextKind,target=switching||this.nextKind==='dry'?0:1;
    this.strength+=(target-this.strength)*(dt?1-Math.exp(-dt*3):1);
    if(switching&&(this.strength<.015||dt===0)){
      this.kind=this.nextKind;this.strength=dt?0:this.kind==='dry'?0:1;
      for(let i=0;i<this.count;i++)this.respawn(i);
    }
    this.time+=dt;
    const count=Math.round((this.low?180:this.count)*this.density),wind=this.effects.wind;
    const baseSpeed=Math.hypot(wind[0],wind[2]),gustSpeed=baseSpeed+this.effects.gust*(.5+.5*Math.sin(this.time*.8));
    const factor=baseSpeed>0?gustSpeed/baseSpeed:1;
    for(let i=0;i<this.count;i++){
      const type=this.kindFor(i);this.kinds[i]=type;
      this.alpha[i]=i<count&&this.kind!=='dry'?.55*this.strength:0;
      if(!this.alpha[i]||dt===0)continue;
      const offset=i*3,oldY=this.positions[offset+1];
      const x=this.positions[offset]+wind[0]*factor*dt*.2+(type===1?Math.sin(this.time+i)*dt*.3:0);
      const z=this.positions[offset+2]+wind[2]*factor*dt*.2;
      if(type===2)this.velocity[i]-=9.81*dt;
      let y=oldY+this.velocity[i]*dt;
      const surface=this.surfaceHeight(x,z);
      if(surface!=null&&y<=surface){
        if(type===2&&oldY>=surface&&this.bounces[i]<3&&Math.abs(this.velocity[i])>.7){
          y=surface+.015;this.velocity[i]=Math.abs(this.velocity[i])*.38;this.bounces[i]++;
        }else{
          if(type===0&&oldY>=surface)this.impact(x,surface,z);
          this.respawn(i);continue;
        }
      }
      if(y<-.5||Math.abs(x)>12||Math.abs(z)>10){this.respawn(i);continue;}
      this.positions.set([x,y,z],offset);
    }
    for(let j=0;j<this.splashCount;j++){
      this.splashAge[j]+=dt;
      this.alpha[this.count+j]=dt===0?0:Math.max(0,1-this.splashAge[j]/.35)*this.strength*.65;
    }
    this.points.visible=this.strength>.005&&this.kind!=='dry';
    for(const name of ['position','kind','alpha'])this.points.geometry.attributes[name].needsUpdate=true;
  }
  setQuality(level){this.low=level==='low';}
  dispose(){disposeObject(this.points);}
}
