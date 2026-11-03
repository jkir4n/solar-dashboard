import { Scene, PerspectiveCamera, SphereGeometry, PlaneGeometry, Mesh, ShaderMaterial, BackSide, Vector3, Color, BufferGeometry, Float32BufferAttribute, Points, FogExp2, DirectionalLight, LineSegments, LineBasicMaterial } from 'three';
import { weatherEffects, cloudArchetypes } from './weather-effects.js';
import { WeatherParticles } from './weather-particles.js';
import { disposeObject } from './house-compound.js';

const vertex = `varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise = `float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);} float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);} float fbm(vec3 p){return .57*noise(p)+.28*noise(p*2.07)+.15*noise(p*4.13);}`;

export class SkyEnvironment {
  constructor(world, light, ambient) {
    this.world = world;
    this.light = light;
    this.ambient = ambient;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(100, 1, .1, 200);
    this.time = 0;
    this.theme = 'dark';
    this.rainbowAfterglow = 0;
    this.flashDuration = 0;
    this.lastBoltTime = 0;
    this.baseLightIntensity = 0;

    this.uniforms = {
      sun: { value: new Vector3(0, 1, 0) },
      pole: { value: new Vector3(0, 1, 0) },
      day: { value: 1 },
      theme: { value: 0 },
      coverage: { value: 0 },
      haze: { value: 0 },
      time: { value: 0 },
      wind: { value: new Vector3() },
      moonGlow: { value: 0 },
      flash: { value: 0 },
      cloudScale: { value: new Vector3(5, 5, 5) },
      stormBase: { value: 0 },
      rainbow: { value: 0 },
    };

    const dome = new Mesh(new SphereGeometry(90, 32, 16), new ShaderMaterial({
      side: BackSide, depthWrite: false, uniforms: this.uniforms, vertexShader: vertex,
      fragmentShader: `varying vec3 direction;uniform vec3 sun,pole;uniform float day,theme,coverage,haze,moonGlow,rainbow;${noise}void main(){
        vec3 d=normalize(direction);float h=max(0.,d.y);
        vec3 darkNight=mix(vec3(.023,.034,.065),vec3(.008,.018,.045),h);
        vec3 lightNight=mix(vec3(.102,.133,.204),vec3(.063,.090,.149),h);
        vec3 night=mix(darkNight,lightNight,theme);
        vec3 darkDay=mix(vec3(.79,.83,.80),vec3(.28,.49,.65),sqrt(h));
        vec3 lightDay=mix(vec3(.87,.90,.94),vec3(.35,.55,.72),sqrt(h));
        vec3 daylight=mix(darkDay,lightDay,theme);
        float sunset=exp(-abs(sun.y)*12.)*pow(max(0.,dot(d,sun)),6.);
        vec3 c=mix(night,daylight,day);
        c+=vec3(.38,.15,.055)*sunset;
        c=mix(c,mix(vec3(.08),mix(vec3(.60,.65,.66),vec3(.78,.82,.85),theme),day),haze*.4);
        float band=exp(-pow(dot(d,pole)*8.0,2.));
        vec3 mwColor=mix(vec3(.10,.12,.18),vec3(.14,.16,.24),theme);
        c+=mwColor*band*(.3+.7*fbm(d*48.))*(1.-day)*(1.-coverage)*(1.-moonGlow)*smoothstep(0.,.25,d.y);
        float angle=acos(clamp(dot(d,-sun),-1.,1.))*57.2958;
        float hGate=smoothstep(0.,.08,d.y);
        float pBow=exp(-pow((angle-41.8)/1.1,2.));
        vec3 pColor=vec3(smoothstep(40.8,42.5,angle),exp(-pow((angle-41.8)/.7,2.)),1.-smoothstep(41.,42.2,angle));
        float sBow=exp(-pow((angle-51.2)/1.5,2.))*.35;
        vec3 sColor=vec3(1.-smoothstep(50.5,52.,angle),exp(-pow((angle-51.2)/.9,2.)),smoothstep(50.2,52.2,angle));
        c+=(pBow*pColor+sBow*sColor)*rainbow*hGate;
        gl_FragColor=vec4(c,1.);
      }`
    }));
    dome.renderOrder = -100;
    this.scene.add(dome);

    this.sun = this.disc(false);
    this.moon = this.disc(true);
    this.scene.add(this.sun, this.moon);

    this.moonLight = new DirectionalLight('#c5d7ff', 0);
    this.world.add(this.moonLight, this.moonLight.target);

    const clouds = new Mesh(new SphereGeometry(70, 32, 16), new ShaderMaterial({
      side: BackSide, transparent: true, depthWrite: false, uniforms: this.uniforms, vertexShader: vertex,
      fragmentShader: `varying vec3 direction;uniform float coverage,time,day,flash,stormBase,haze;uniform vec3 wind,cloudScale;${noise}void main(){
        vec3 d=normalize(direction);vec3 p=d*cloudScale-wind*time*.012;
        float n=fbm(p)+.12*fbm(p*3.);
        float alpha=smoothstep(1.-coverage*.95,1.22-coverage*.95,n)*smoothstep(-.12,.10,d.y);
        vec3 base=mix(vec3(.065,.08,.11),vec3(.82,.84,.82),day)-.14*coverage+.12*n;
        base=mix(base,vec3(.09,.10,.13),stormBase*(1.-haze*.5));
        gl_FragColor=vec4(base+flash,alpha*.96);
      }`
    }));
    clouds.renderOrder = 20;
    this.scene.add(clouds);

    this.stars = new Points(new BufferGeometry(), new ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      vertexShader: `attribute float brightness;attribute float size;varying vec3 c;varying float alpha;void main(){c=color;alpha=brightness;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}`,
      fragmentShader: `varying vec3 c;varying float alpha;void main(){if(alpha<=0.)discard;float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(c,(1.-smoothstep(.1,1.,r))*alpha);}`
    }));
    this.stars.renderOrder = 1;
    this.scene.add(this.stars);

    // Weather particles with roof and plinth height collision
    this.particles = new WeatherParticles(this.world, {
      surfaceHeight: (x, z) => this.surfaceHeight(x, z)
    });

    // 3D Lightning bolt mesh
    const boltGeom = new BufferGeometry();
    boltGeom.setAttribute('position', new Float32BufferAttribute(new Float32Array(72), 3));
    this.lightningMesh = new LineSegments(boltGeom, new LineBasicMaterial({
      color: '#e4f0ff', transparent: true, opacity: 0, depthWrite: false
    }));
    this.lightningMesh.renderOrder = 25;
    this.scene.add(this.lightningMesh);
  }

  surfaceHeight(x, z) {
    // Main house roof: bounds ~[-3.8, 2.8] x [-3.4, 1.8], top at y ~ 3.36
    if (x >= -3.8 && x <= 2.8 && z >= -3.4 && z <= 1.8) return 3.36;
    // Battery room roof: bounds ~[0.86, 3.84] x [0.72, 3.78], top at y ~ 2.7
    if (x >= 0.86 && x <= 3.84 && z >= 0.72 && z <= 3.78) return 2.7;
    // Architectural ground plinth: bounds ~[-6.8, 6.8] x [-5.2, 5.2], surface at y = 0
    if (Math.abs(x) <= 6.8 && Math.abs(z) <= 5.2) return 0;
    return 0;
  }

  disc(moon) {
    return new Mesh(new PlaneGeometry(moon ? .78 : .76, moon ? .78 : .76), new ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { lamp: { value: new Vector3(0, 0, 1) }, opacity: { value: 1 }, phaseAngle: { value: 0 } },
      vertexShader: `varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 uv0;uniform vec3 lamp;uniform float opacity;void main(){
        vec2 p=uv0*2.-1.;float rr=dot(p,p);if(rr>1.)discard;
        vec3 normal=vec3(p,sqrt(max(0.,1.-rr)));
        vec3 l=normalize(lamp);float nDotL=dot(normal,l);
        ${moon ? `
        float lit=smoothstep(-.03,.05,nDotL);
        float texture=.84+.12*sin(p.x*28.+sin(p.y*35.))*sin(p.y*42.-cos(p.x*20.));
        vec3 sunlit=vec3(.90,.94,1.)*texture*(.2+.8*max(0.,nDotL));
        vec3 earthshine=vec3(.04,.05,.07)*texture;
        vec3 color=mix(earthshine,sunlit,lit);
        gl_FragColor=vec4(color,opacity*smoothstep(1.,.95,rr));
        ` : `
        gl_FragColor=vec4(vec3(1.,.9,.65),opacity*smoothstep(1.,.96,rr));
        `}
      }`
    }));
  }

  setState(state) {
    if (!state) return;
    this.state = state;
    const { sun, moon, weather: w } = state;
    const lightTheme = this.theme === 'light';
    const day = Math.max(0, Math.min(1, (sun.elevationDeg + 12) / 18));
    const cloud = (w.cloud_coverage ?? 75) / 100;

    this.uniforms.sun.value.fromArray(sun.direction);
    const pole = state.milkyWay?.pole || state.galacticPole;
    if (pole) this.uniforms.pole.value.fromArray(pole);
    this.uniforms.day.value = day;
    this.uniforms.theme.value = lightTheme ? 1 : 0;
    this.targetCoverage = cloud;
    if (!this.hasState) this.uniforms.coverage.value = cloud;
    this.hasState = true;
    this.uniforms.haze.value = 1 - Math.min(1, (w.visibility ?? 20000) / 20000);
    this.uniforms.moonGlow.value = moon.elevationDeg > 0 ? moon.illumination * .7 : 0;

    const bearing = ((w.wind_bearing ?? 0) + 180) * Math.PI / 180;
    this.uniforms.wind.value.set(Math.sin(bearing), 0, -Math.cos(bearing)).multiplyScalar(w.wind_speed ?? 1);

    // Directional sunlight
    this.light.position.fromArray(sun.direction).multiplyScalar(25);
    const sunFactor = sun.elevationDeg > 0 ? Math.min(1, sun.elevationDeg / 15) * (1 - cloud * .9) : 0;
    this.baseLightIntensity = (lightTheme ? 2.6 : 3.2) * sunFactor;
    this.light.intensity = this.baseLightIntensity;
    this.light.color.set(sun.elevationDeg < 12 ? (lightTheme ? '#ffcaa0' : '#ffd6a0') : (lightTheme ? '#fff6e8' : '#fff3df'));

    // 4-Way Ambient lighting: dark+day, dark+night, light+day, light+night
    if (lightTheme) {
      if (day > .3) {
        this.ambient.color.set('#eaf2f8');
        this.ambient.groundColor?.set('#cfd7c7');
        this.ambient.intensity = .45 + day * 1.5;
      } else {
        // light + night: cohesive twilight-slate/indigo architectural scene
        this.ambient.color.set('#3a4f6e');
        this.ambient.groundColor?.set('#273142');
        this.ambient.intensity = .52;
      }
    } else {
      if (day > .3) {
        this.ambient.color.set('#d5e5ee');
        this.ambient.groundColor?.set('#8a9280');
        this.ambient.intensity = .28 + day * 1.8;
      } else {
        // dark + night: deep astronomical night stage
        this.ambient.color.set('#1a2436');
        this.ambient.groundColor?.set('#080d15');
        this.ambient.intensity = .28;
      }
    }

    // Celestial discs
    for (const [mesh, body] of [[this.sun, sun], [this.moon, moon]]) {
      mesh.position.fromArray(body.direction).multiplyScalar(80);
      mesh.lookAt(0, 0, 0);
      mesh.visible = body.elevationDeg > -.4;
      mesh.material.uniforms.opacity.value = 1 - cloud * .85;
    }

    // Moon illumination & moonlight
    this.moonLight.position.fromArray(moon.direction).multiplyScalar(25);
    this.moonLight.color.set(lightTheme ? '#d0e0ff' : '#c5d7ff');
    this.moonLight.intensity = (moon.elevationDeg > 0 && sun.elevationDeg < 0)
      ? (lightTheme ? .35 : .25) * moon.illumination * (1 - cloud) : 0;

    if (moon.sunDirection) {
      this.moon.material.uniforms.lamp.value.fromArray(moon.sunDirection).applyQuaternion(this.moon.quaternion.clone().invert());
    }
    if (this.moon.material.uniforms.phaseAngle) {
      this.moon.material.uniforms.phaseAngle.value = moon.phaseAngle ?? moon.phaseDeg ?? 0;
    }

    // Stars & planets
    const objects = [...state.stars, ...state.planets.map(p => ({ ...p, colorIndex: p.name === 'Mars' ? 1.5 : .2 })), ...(state.iss ? [{ ...state.iss, magnitude: -2, colorIndex: 0 }] : [])];
    const pos = [], colors = [], brightness = [], sizes = [];
    for (const star of objects) {
      pos.push(...star.direction.map(v => v * 85));
      const ci = star.colorIndex ?? 0, c = new Color(ci > 1 ? '#ffd0a2' : ci < 0 ? '#c6d9ff' : '#f5f1de');
      colors.push(c.r, c.g, c.b);
      brightness.push(star.visibility);
      sizes.push(Math.max(1, 3.8 - star.magnitude * .55));
    }
    for (const [name, array, size] of [['position', pos, 3], ['color', colors, 3], ['brightness', brightness, 1], ['size', sizes, 1]]) {
      const previous = this.stars.geometry.getAttribute(name);
      if (previous?.array.length === array.length) {
        previous.array.set(array);
        previous.needsUpdate = true;
      } else {
        if (name === 'position') this.stars.geometry.dispose();
        this.stars.geometry.setAttribute(name, new Float32BufferAttribute(array, size));
      }
    }
    this.stars.geometry.computeBoundingSphere();

    this.condition = w.condition || '';
    this.effects = weatherEffects(w, sun.elevationDeg);

    // Weather particles
    this.particles.setWeather(this.effects, w);

    // Rainbow logic with 40-second post-rain afterglow
    if (this.effects.rainbow) {
      this.rainbowAfterglow = 40;
      this.uniforms.rainbow.value = .45;
    } else if (this.rainbowAfterglow > 0 && sun.elevationDeg > 0 && sun.elevationDeg < 42 && (w.cloud_coverage ?? 100) < 95) {
      this.uniforms.rainbow.value = (this.rainbowAfterglow / 40) * .45;
    } else {
      this.uniforms.rainbow.value = 0;
    }

    // 7 Cloud archetypes: scale, vertical profile and storm base
    const profiles = {
      cirrus: [2, 35, 2],
      cumulus: [5, 8, 5],
      stratocumulus: [6, 14, 6],
      nimbostratus: [3, 10, 3],
      cumulonimbus: [4, 4, 4],
      altostratus: [5, 20, 5],
      stratus: [2, 28, 2],
    };
    const cType = this.effects.cloudType || 'stratocumulus';
    this.uniforms.cloudScale.value.fromArray(profiles[cType] || [5, 14, 5]);
    this.uniforms.stormBase.value = (cType === 'cumulonimbus' || cType === 'nimbostratus') ? .45 : 0;

    // Wet-surface response on plinth and house materials
    this.world.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material?.isMeshStandardMaterial) {
          material.userData.weatherBaseRoughness ??= material.roughness;
          if (material.userData.weatherBaseRoughness > .3) {
            material.roughness = material.userData.weatherBaseRoughness * (1 - .45 * this.effects.wetness);
          }
        }
      }
    });

    // Fog / Ground mist: active when fog condition, or temperature - dew_point < 2°C
    const dewSpread = (w.temperature != null && w.dew_point != null) ? (w.temperature - w.dew_point) : 10;
    const groundMist = dewSpread < 2 && w.temperature > -5;
    const fog = this.effects.fog || groundMist;
    const fogColor = lightTheme ? (day > .3 ? '#c4d0d3' : '#2b384a') : (day > .3 ? '#a9b9bc' : '#263441');
    const fogDensity = this.condition === 'fog' ? .045 : (groundMist ? .028 : .022);
    this.world.fog = fog ? new FogExp2(fogColor, fogDensity) : null;
  }

  generateLightningBolt() {
    const pos = this.lightningMesh.geometry.attributes.position.array;
    const angle = (Math.random() - .5) * Math.PI * .8;
    const startX = Math.sin(angle) * 55, startZ = -Math.cos(angle) * 55, startY = 45 + Math.random() * 15;
    let currX = startX, currY = startY, currZ = startZ;
    let pIdx = 0;
    for (let i = 0; i < 12; i++) {
      pos[pIdx++] = currX; pos[pIdx++] = currY; pos[pIdx++] = currZ;
      currX += (Math.random() - .5) * 8;
      currY -= 3 + Math.random() * 3;
      currZ += (Math.random() - .5) * 8;
      pos[pIdx++] = currX; pos[pIdx++] = currY; pos[pIdx++] = currZ;
    }
    this.lightningMesh.geometry.attributes.position.needsUpdate = true;
    this.lightningMesh.material.opacity = .95;
    this.flashDuration = .12;
    this.uniforms.flash.value = .85;
    this.light.intensity = this.baseLightIntensity + 3.5;
  }

  tick(dt) {
    this.time += dt;
    this.uniforms.time.value = this.time;
    if (!this.state) return;

    this.uniforms.coverage.value += (this.targetCoverage - this.uniforms.coverage.value) * (dt ? Math.min(1, dt * .8) : 1);

    // Rainbow post-rain afterglow countdown
    if (this.rainbowAfterglow > 0 && dt > 0) {
      this.rainbowAfterglow = Math.max(0, this.rainbowAfterglow - dt);
      if (!this.effects?.rainbow) {
        this.uniforms.rainbow.value = (this.rainbowAfterglow / 40) * .45;
      }
    } else if (!this.effects?.rainbow) {
      this.uniforms.rainbow.value = 0;
    }

    // Weather particles tick
    this.particles.tick(dt);

    // Stochastic lightning simulation scaled by thunderstorm probability
    const thunder = this.effects?.lightning;
    if (thunder && dt > 0) {
      const prob = (this.state.weather.thunderstorm_probability ?? 75) / 100;
      if (this.time - this.lastBoltTime > 2.5 && Math.random() < dt * prob * .4) {
        this.lastBoltTime = this.time;
        this.generateLightningBolt();
      }
    }

    // Lightning flash decay
    if (this.flashDuration > 0 && dt > 0) {
      this.flashDuration -= dt;
      if (this.flashDuration <= 0) {
        this.uniforms.flash.value = 0;
        this.lightningMesh.material.opacity = 0;
        this.light.intensity = this.baseLightIntensity;
      }
    } else if (dt === 0) {
      // Suppress flashes in reduced motion
      this.uniforms.flash.value = 0;
      this.lightningMesh.material.opacity = 0;
      this.light.intensity = this.baseLightIntensity;
    }

    // Moving cloud shadows: modulate directional light intensity with moving clouds
    if (this.baseLightIntensity > 0 && dt > 0 && this.uniforms.coverage.value > .15) {
      const wind = this.uniforms.wind.value;
      const shadowFactor = 1 - .25 * this.uniforms.coverage.value * (.5 + .5 * Math.sin(this.time * .4 + wind.x * .1));
      if (this.flashDuration <= 0) {
        this.light.intensity = this.baseLightIntensity * shadowFactor;
      }
    }
  }

  render(renderer, camera) {
    this.camera.aspect = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
    this.camera.updateProjectionMatrix();
    this.camera.quaternion.copy(camera.quaternion);
    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = false;
    renderer.clearDepth();
  }

  setTheme(theme) {
    this.theme = theme;
    if (this.state) this.setState(this.state);
  }

  setQuality(level) {
    this.low = level === 'low';
    this.particles?.setQuality(level);
    if (this.state) this.setState(this.state);
  }

  dispose() {
    disposeObject(this.scene);
    this.particles?.dispose();
    this.moonLight.removeFromParent();
    this.moonLight.target.removeFromParent();
    this.world.fog = null;
  }
}
