import { Scene, OrthographicCamera, WebGLRenderer, PCFShadowMap, ACESFilmicToneMapping, HemisphereLight, DirectionalLight, Raycaster, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHouseCompound, normalizePanelConfig } from './house-compound.js';
import { SkyEnvironment } from './sky-environment.js';
import { createEnergyConduits } from './energy-conduits.js';

export const CAMERA_PRESETS = {
  overview: { target: new Vector3(0, 1.2, 0), pos: new Vector3(13, 12, 16), zoom: 1.0, cutaway: false },
  solar: { target: new Vector3(-.5, 3.8, -.8), pos: new Vector3(6, 15, 12), zoom: 1.45, cutaway: false },
  battery: { target: new Vector3(2.4, 1.8, 2.2), pos: new Vector3(8.5, 4.2, 8.5), zoom: 1.7, cutaway: true },
  cells: { target: new Vector3(2.4, 1.4, 2.1), pos: new Vector3(6.5, 3.0, 6.0), zoom: 2.1, cutaway: true },
  controls: { target: new Vector3(3.28, 1.8, 2.8), pos: new Vector3(8.0, 3.5, 7.5), zoom: 1.85, cutaway: true },
  grid: { target: new Vector3(5.25, 1.2, 2.35), pos: new Vector3(12, 5, 8.5), zoom: 1.6, cutaway: false },
  home: { target: new Vector3(-1.5, 1.6, .5), pos: new Vector3(4, 8, 14), zoom: 1.3, cutaway: false },
  sky: { target: new Vector3(0, 6, 0), pos: new Vector3(0, 2, 18), zoom: 0.95, cutaway: false, maxPolar: Math.PI - .2 },
};

export class WorldScene {
  constructor(canvas, { onSelect, onCellHover, onFrame, onStatus } = {}) {
    this.canvas = canvas;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-12, 12, 8, -8, .1, 300);
    this.camera.position.set(13, 12, 16);
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFShadowMap;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    } catch {
      this.renderer = {
        shadowMap: {},
        domElement: canvas,
        render: () => {},
        setSize: () => {},
        setPixelRatio: () => {},
        dispose: () => {},
        forceContextLoss: () => {},
      };
    }

    this.controls = new OrbitControls(this.camera, canvas);
    this.reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    this.controls.enableDamping = !this.reduced;
    this.controls.enablePan = false;
    this.controls.minZoom = .65;
    this.controls.maxZoom = 2.3;
    this.controls.minPolarAngle = .2;
    this.controls.maxPolarAngle = Math.PI * .49;
    this.controls.target.set(0, 1.2, 0);
    this.controls.update();

    this.ambient = new HemisphereLight('#e7eff4', '#a29b84', 2.2);
    this.light = new DirectionalLight('#fff1d4', 2.8);
    this.light.position.set(-8, 13, 6);
    this.light.castShadow = true;
    Object.assign(this.light.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.normalBias = .03;
    this.scene.add(this.ambient, this.light, this.light.target);

    this.sky = new SkyEnvironment(this.scene, this.light, this.ambient);
    this.conduits = createEnergyConduits();
    this.scene.add(this.conduits.group);

    this.setPanelConfig({});
    this.cutaway = 0;
    this.cutawayTarget = 0;
    this.lastFrame = 0;
    this.activeUntil = 0;
    this.cameraTween = null;

    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    const signal = (this.events = new AbortController()).signal;

    this.controls.addEventListener('change', () => { this.activeUntil = performance.now() + 500; });
    canvas.addEventListener('pointerdown', e => {
      this.down = [e.clientX, e.clientY];
      this.activeUntil = performance.now() + 1000;
    }, { signal });
    canvas.addEventListener('pointerup', e => {
      if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) >= 5) {
        this.down = null;
        return;
      }
      this.down = null;
      const hit = this.pick(e);
      if (hit) onSelect?.(hit.userData.zone, hit.userData.cellIndex);
    }, { signal });
    canvas.addEventListener('pointermove', e => {
      if (!this.down) onCellHover?.(this.pick(e)?.userData.cellIndex ?? null);
    }, { signal });
    canvas.addEventListener('pointerleave', () => onCellHover?.(null), { signal });
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.contextLost = true;
      this.stop();
      onStatus?.('lost');
    }, { signal });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      onStatus?.('ready');
      if (typeof document !== 'undefined' && !document.hidden) this.start();
    }, { signal });

    this.tick = now => {
      if (!this.running || this.disposed) return;
      this.raf = requestAnimationFrame(this.tick);
      const interval = now < this.activeUntil ? 1000 / 60 : 1000 / 30;
      if (this.lastFrame && now - this.lastFrame < interval - 1) return;
      const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, .1) : 0;
      this.lastFrame = now;
      const start = performance.now();

      // Cubic fly-to camera tween
      if (this.cameraTween) {
        const elapsed = now - this.cameraTween.start;
        const t = Math.min(1, elapsed / this.cameraTween.duration);
        const ease = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(this.cameraTween.fromPos, this.cameraTween.toPos, ease);
        this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, ease);
        this.camera.zoom = this.cameraTween.fromZoom + (this.cameraTween.toZoom - this.cameraTween.fromZoom) * ease;
        this.camera.updateProjectionMatrix();
        this.activeUntil = now + 500;
        if (t >= 1) this.cameraTween = null;
      }

      this.controls.update();

      // 600 ms cubic ease for cutaway
      this.cutaway += (this.cutawayTarget - this.cutaway) * (this.reduced ? 1 : Math.min(1, dt * 6));
      this.house.setCutaway(this.cutaway);

      this.conduits.tick(this.reduced ? 0 : dt);
      this.sky?.tick(this.reduced ? 0 : dt);
      this.sky.render(this.renderer, this.camera);
      this.renderer.render(this.scene, this.camera);
      this.onFrame?.(this.projectAnchors());

      this.slowFrames = performance.now() - start > 28 ? (this.slowFrames || 0) + 1 : 0;
      if (this.slowFrames > 90 && !this.lowQuality) {
        this.lowQuality = true;
        this.resize(this.width, this.height, 1.25);
        this.sky?.setQuality('low');
      }
    };
  }

  pick(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.house.pickables).find(hit => {
      for (let parent = hit.object; parent; parent = parent.parent) if (!parent.visible) return false;
      return hit.object.material.opacity > .3;
    })?.object;
  }

  setEnergy(state) {
    this.energy = state;
    this.conduits.setState(state);
    this.house.setEnergy(state);
  }

  setCellStates(cellData) {
    this.cellData = cellData;
    this.house.setCellStates(cellData);
  }

  setSky(state) {
    this.sky?.setState(state);
    this.house.setNight(state.sun?.elevationDeg < 0, this.energy?.homeW, state.sun?.elevationDeg);
  }

  setTheme(theme) {
    this.theme = theme;
    this.sky?.setTheme(theme);
    this.conduits.setTheme(theme);
  }

  setPanelConfig(input) {
    const config = normalizePanelConfig(input), key = JSON.stringify(config);
    if (key === this.panelKey) return;
    this.panelKey = key;
    this.house?.dispose();
    this.house = createHouseCompound({ panelConfig: config });
    this.scene.add(this.house.group);
    if (this.energy) this.house.setEnergy(this.energy);
    if (this.cellData) this.house.setCellStates(this.cellData);
    if (this.width) this.resize(this.width, this.height, this.dpr);
  }

  setCutaway(value) {
    this.cutawayTarget = value ? 1 : 0;
    this.activeUntil = performance.now() + 1000;
  }

  highlightCell(index) {
    this.house.highlightCell(index);
  }

  focus(zone) {
    this.focusZone = zone;
    const preset = CAMERA_PRESETS[zone] || CAMERA_PRESETS.overview;
    this.controls.maxPolarAngle = preset.maxPolar ?? Math.PI * .49;
    this.setCutaway(preset.cutaway);

    if (this.reduced) {
      this.controls.target.copy(preset.target);
      this.camera.position.copy(preset.pos);
      this.camera.zoom = preset.zoom;
      if (this.width) this.resize(this.width, this.height, this.dpr);
      this.camera.updateProjectionMatrix();
      this.controls.update();
    } else {
      this.cameraTween = {
        start: performance.now(),
        duration: 600,
        fromPos: this.camera.position.clone(),
        toPos: preset.pos.clone(),
        fromTarget: this.controls.target.clone(),
        toTarget: preset.target.clone(),
        fromZoom: this.camera.zoom,
        toZoom: preset.zoom,
      };
    }
    this.activeUntil = performance.now() + 1000;
  }

  projectAnchors() {
    return Object.fromEntries(Object.entries(this.house.anchors).map(([name, point]) => {
      const p = point.clone();
      if (name === 'solar') p.y += this.cutaway * 1.8;
      p.project(this.camera);
      return [name, {
        x: (p.x + 1) * this.width / 2,
        y: (1 - p.y) * this.height / 2,
        visible: Math.abs(p.x) < .96 && Math.abs(p.y) < .94 && Math.abs(p.z) < 1
      }];
    }));
  }

  resize(width, height, dpr = (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const aspect = width / height, size = Math.max(15, this.house.extent * 1.12, 19 / aspect);
    this.camera.left = -size * aspect / 2;
    this.camera.right = size * aspect / 2;
    this.camera.top = size / 2;
    this.camera.bottom = -size / 2;
    if (width < 600 && ['battery', 'cells', 'controls'].includes(this.focusZone)) {
      this.camera.top -= size * .22;
      this.camera.bottom -= size * .22;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(dpr, this.lowQuality ? 1.25 : 2));
    this.renderer.setSize(width, height, false);
  }

  start() {
    if (this.running || this.disposed || this.contextLost) return;
    this.running = true;
    this.lastFrame = 0;
    if (typeof requestAnimationFrame === 'function') {
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  stop() {
    this.running = false;
    if (typeof cancelAnimationFrame === 'function' && this.raf) {
      cancelAnimationFrame(this.raf);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.events.abort();
    this.controls.dispose();
    this.house.dispose();
    this.conduits.dispose();
    this.sky?.dispose();
    this.light.shadow.map?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
