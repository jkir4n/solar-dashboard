import { Group, Mesh, MeshStandardMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, InstancedMesh, Object3D, Vector3, CatmullRomCurve3, TubeGeometry, MeshBasicMaterial, LineSegments, EdgesGeometry, LineBasicMaterial } from 'three';

export function normalizePanelConfig(input = {}) {
  const value = (key, fallback, min, max) => Number.isFinite(input[key]) ? Math.max(min, Math.min(max, input[key])) : fallback;
  return {
    count: Math.round(value('count', 6, 1, 100)),
    width: value('width', 2.278, .5, 3),
    height: value('height', 1.134, .5, 2),
    tilt: value('tilt', 7.5, 0, 90),
    azimuth: ((value('azimuth', 220, -3600, 3600) % 360) + 360) % 360
  };
}

export function disposeObject(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  textures.forEach(value => value.dispose());
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  group.removeFromParent();
}

export function createHouseCompound({ panelConfig }) {
  const config = normalizePanelConfig(panelConfig);
  const group = new Group(), roof = new Group(), facade = new Group(), pickables = [], cells = [];
  roof.name = 'roof';
  group.add(roof, facade);

  const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: .8, ...extra });
  const stone = mat('#e9e6db'), trim = mat('#f6f4e9'), timber = mat('#ac8764'), dark = mat('#40575b');
  const glazing = mat('#839fa0', { transparent: true, opacity: .55, metalness: .15, roughness: .22 });
  const windows = mat('#b9bda8', { emissive: '#ffb85c', emissiveIntensity: .02 });

  function box(w, h, d, x, y, z, material, parent = group, zone) {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    if (zone) { mesh.userData.zone = zone; pickables.push(mesh); }
    return mesh;
  }

  const cols = Math.ceil(Math.sqrt(config.count * config.height / config.width));
  const rows = Math.ceil(config.count / cols);
  const arrayWidth = cols * (config.width + .12), arrayDepth = rows * (config.height + .12);
  const roofSpan = Math.max(6.4, Math.hypot(arrayWidth, arrayDepth) + .4);
  const extent = Math.max(13.5, roofSpan + 6);

  // Plinth Base & Terraces
  box(extent, .35, Math.max(10.3, roofSpan + 3), 0, -.33, 0, mat('#cbd0c2'));
  box(extent - .2, .1, Math.max(10.1, roofSpan + 2.8), 0, -.1, 0, mat('#e2e3d7'));
  box(9.2, .07, 7.3, -.5, -.02, -.5, mat('#9eae82'));
  box(7.4, .16, 6.5, .1, .06, -.1, mat('#d2d5c8'));

  // Plinth Compass Markings: N · E · S · W
  const compassGroup = new Group();
  compassGroup.name = 'compass';
  group.add(compassGroup);
  // North pointer (pointing to -Z)
  box(.12, .025, .6, 0, .01, -4.8, mat('#b88a3c'), compassGroup);
  box(.35, .02, .08, 0, .01, -4.6, mat('#b88a3c'), compassGroup);
  // East tick (+X)
  box(.5, .02, .08, 5.5, .01, 0, mat('#74847d'), compassGroup);
  // South tick (+Z)
  box(.08, .02, .4, 0, .01, 4.8, mat('#74847d'), compassGroup);
  // West tick (-X)
  box(.4, .02, .08, -5.5, .01, 0, mat('#74847d'), compassGroup);

  // Residence Main Structure
  box(6, .25, 4, -.5, .23, -.8, stone, group, 'home');
  box(6, 2.8, .18, -.5, 1.7, -2.72, stone, group, 'home');
  for (const x of [-3.42, 2.42]) box(.18, 2.8, 4, x, 1.7, -.8, stone, group, 'home');
  box(5.7, .12, 3.7, -.5, .42, -.8, mat('#c7b69c'));
  box(.15, 2.5, 2.8, .8, 1.6, -1.2, stone);

  // Roof & Overhang
  const mainRoofMesh = box(roofSpan, .24, roofSpan * .8, -.5, 3.24, -.8, trim.clone(), roof, 'solar');
  for (const z of [-.8 - roofSpan * .4, -.8 + roofSpan * .4]) {
    box(roofSpan, .16, .1, -.5, 3.44, z, stone.clone(), roof);
  }

  // Ghostly roof wireframe for cutaway
  const roofEdges = new LineSegments(new EdgesGeometry(mainRoofMesh.geometry), new LineBasicMaterial({
    color: '#658592', transparent: true, opacity: .35
  }));
  roofEdges.position.copy(mainRoofMesh.position);
  roof.add(roofEdges);

  // Facade & Window Mullions
  for (let i = 0; i < 6; i++) {
    box(.87, 2.35, .07, -2.98 + i * .92, 1.65, 1.21, windows, facade, 'home');
    box(.045, 2.5, .12, -3.44 + i * .92, 1.65, 1.23, dark, facade);
  }
  for (let i = 0; i < 12; i++) box(.1, 2.6, .09, -3.35 + i * .15, 1.7, 1.32, timber, facade);

  // Interior Architectural Volumes
  box(1.9, .45, .8, -1.8, .7, -.3, mat('#ddd6c4'));
  box(1.9, .55, .18, -1.8, 1.05, -.65, mat('#c9c1ae'));
  box(1, .1, .5, -1.8, .6, .65, timber);

  // Energy Room: Battery Enclosure & Walls
  box(2.7, .19, 2.8, 2.35, .22, 2.25, stone);
  box(.13, 2.2, 2.8, 3.65, 1.4, 2.25, stone, group, 'battery');
  box(2.7, 2.2, .13, 2.35, 1.4, .9, stone);
  box(2.98, .21, 3.05, 2.35, 2.6, 2.25, trim.clone(), roof, 'battery');
  box(2.5, 1.95, .06, 2.35, 1.4, 3.65, glazing, facade, 'battery');
  for (const x of [1.03, 2.35, 3.67]) box(.055, 2.2, .11, x, 1.4, 3.68, dark, facade);
  box(1.85, 1.9, .65, 2.4, 1.25, 1.9, dark, group, 'battery');

  // 16S Prismatic Cells (C1-C16)
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) {
      const x = 1.61 + i * .225, y = .78 + row * .8;
      const cell = box(.195, .64, .45, x, y, 2.06, mat('#83a29e', { metalness: .3, emissive: '#65957e', emissiveIntensity: .1 }), group, 'cells');
      cell.userData.cellIndex = row * 8 + i;
      cells.push(cell);
      box(.06, .025, .06, x, y + .34, 2.12, timber);
    }
  }

  // Top Pack SOC Status Pill
  const packLight = box(1.7, .1, .06, 2.4, 2.11, 2.26, mat('#79a483', { emissive: '#4b8a61', emissiveIntensity: .3 }));

  // 3D Glowing Supercap Balancing Arc
  const arcCurve = new CatmullRomCurve3([
    new Vector3(1.61, 1.5, 2.1),
    new Vector3(2.4, 1.9, 2.35),
    new Vector3(3.18, 1.5, 2.1)
  ]);
  const arcMesh = new Mesh(new TubeGeometry(arcCurve, 24, .02, 6, false), new MeshBasicMaterial({
    color: '#4be0d0', transparent: true, opacity: .9
  }));
  arcMesh.visible = false;
  group.add(arcMesh);

  // Hybrid Inverter & Control Skid
  box(.65, 1.12, .38, 3.28, 1.65, 2.8, trim, group, 'controls');
  box(.35, .22, .03, 3.28, 1.83, 3, dark, group, 'controls');

  // Inverter Status LEDs: [Charging, Discharging, Grid Bypass, Top Balancing]
  const inverterLeds = [
    box(.035, .035, .015, 3.16, 2.05, 3.01, new MeshBasicMaterial({ color: '#276749' }), group), // Charge
    box(.035, .035, .015, 3.24, 2.05, 3.01, new MeshBasicMaterial({ color: '#7b341e' }), group), // Discharge
    box(.035, .035, .015, 3.32, 2.05, 3.01, new MeshBasicMaterial({ color: '#2c5282' }), group), // Bypass
    box(.035, .035, .015, 3.40, 2.05, 3.01, new MeshBasicMaterial({ color: '#553c9a' }), group), // Balancing
  ];

  // Rooftop Solar Array & Anodized Rails
  const array = new Group();
  array.position.set(-.5, 3.6 + Math.sin(config.tilt * Math.PI / 180) * arrayDepth / 2, -.8);
  array.rotation.order = 'YXZ';
  array.rotation.y = -config.azimuth * Math.PI / 180;
  array.rotation.x = -config.tilt * Math.PI / 180;
  roof.add(array);

  // Mounting rails
  for (const zOffset of [-arrayDepth * .25, arrayDepth * .25]) {
    box(arrayWidth, .025, .04, 0, -.03, zOffset, mat('#8fa2ac'), array);
  }

  const panels = new InstancedMesh(new BoxGeometry(config.width, .07, config.height), mat('#173a49', { metalness: .4, roughness: .3 }), config.count);
  panels.name = 'solar-panels';
  panels.userData.zone = 'solar';
  panels.castShadow = panels.receiveShadow = true;
  const transform = new Object3D();
  for (let i = 0; i < config.count; i++) {
    transform.position.set(
      (i % cols - (cols - 1) / 2) * (config.width + .12),
      0,
      (Math.floor(i / cols) - (rows - 1) / 2) * (config.height + .12)
    );
    transform.updateMatrix();
    panels.setMatrixAt(i, transform.matrix);
    for (let j = 1; j < 6; j++) {
      box(.008, .003, config.height, transform.position.x - config.width / 2 + config.width * j / 6, .037, transform.position.z, mat('#718995'), array);
    }
  }
  array.add(panels);
  pickables.push(panels);

  // Deck & Landscaping
  box(4, .08, 1.5, -1.1, .2, 2.1, timber);
  for (let i = 0; i < 22; i++) box(.012, .008, 1.48, -3.02 + i * .18, .245, 2.1, dark);
  for (let i = 0; i < 4; i++) box(.85, .07, .54, -1.7, .015, 3.25 + i * .57, trim);

  const leaves = ['#81976b', '#96a777', '#657f61'].map(color => mat(color));
  for (const [x, z, scale] of [[-4.9, -2.8, 1.2], [-5.3, 2.2, .95], [4.9, -3.1, 1.2]]) {
    const trunk = new Mesh(new CylinderGeometry(.07, .11, 1.7 * scale, 8), timber);
    trunk.position.set(x, .85 * scale, z);
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const canopy = new Mesh(new SphereGeometry(.59 * scale, 14, 10), leaves[i % 3]);
      canopy.position.set(x + Math.sin(i * 2) * .36, (1.7 + i % 3 * .2) * scale, z + Math.cos(i * 2) * .3);
      canopy.scale.y = 1.15;
      canopy.castShadow = true;
      group.add(canopy);
    }
  }
  for (let i = 0; i < 10; i++) {
    const shrub = new Mesh(new SphereGeometry(.23, 10, 8), leaves[i % 3]);
    shrub.position.set(-3.85, .18, -1.5 + i * .48);
    shrub.scale.y = .7;
    group.add(shrub);
  }

  // Utility Grid Pylon & Meter Beacon
  box(.9, .12, .95, 5.25, 0, 2.35, stone);
  box(.5, 1.4, .35, 5.25, .75, 2.35, mat('#a7b0a8'), group, 'grid');
  box(.31, .32, .025, 5.25, 1, 2.54, dark, group, 'grid');
  // Grid status beacon on meter
  const gridBeacon = new Mesh(new SphereGeometry(.07, 12, 8), new MeshStandardMaterial({
    color: '#718096', emissive: '#4a5568', emissiveIntensity: .2
  }));
  gridBeacon.position.set(5.25, 1.55, 2.35);
  group.add(gridBeacon);

  const anchors = {
    solar: new Vector3(-.5, 4.4, -.8),
    home: new Vector3(-2, 1.9, 2.1),
    battery: new Vector3(2.4, 2.9, 2.2),
    cells: new Vector3(2.4, 1.5, 2.2),
    controls: new Vector3(3.28, 2.3, 2.8),
    grid: new Vector3(5.25, 1.9, 2.35)
  };

  roof.traverse(mesh => { if (mesh.material) mesh.material.transparent = true; });

  return {
    group,
    pickables,
    anchors,
    extent,
    cells,
    inverterLeds,
    gridBeacon,
    arcMesh,
    setCutaway(progress) {
      roof.position.y = progress * 1.8;
      roof.traverse(mesh => {
        if (mesh.material && mesh !== roofEdges) {
          mesh.material.opacity = Math.max(.12, 1 - progress * .88);
          mesh.castShadow = progress < .1;
        }
      });
      roofEdges.material.opacity = .25 + .25 * (1 - progress);
      facade.visible = progress < .5;
    },
    highlightCell(index) {
      cells.forEach((cell, i) => {
        cell.material.emissiveIntensity = i === index ? 1 : .1;
      });
    },
    setCellStates({ voltages = [], minCell = null, maxCell = null, balancing = false } = {}) {
      cells.forEach((cell, i) => {
        if (i === maxCell) {
          cell.material.color.set('#c25c54');
          cell.material.emissive.set('#b33f38');
          cell.material.emissiveIntensity = .55;
        } else if (i === minCell) {
          cell.material.color.set('#4b8e9e');
          cell.material.emissive.set('#337485');
          cell.material.emissiveIntensity = .55;
        } else {
          cell.material.color.set('#529676');
          cell.material.emissive.set('#3e7d5f');
          cell.material.emissiveIntensity = .1;
        }
      });

      // 3D Supercap Balancing Arc between C{max} and C{min}
      if (balancing && maxCell != null && minCell != null && maxCell !== minCell && cells[maxCell] && cells[minCell]) {
        const p1 = cells[maxCell].position;
        const p2 = cells[minCell].position;
        const mid = new Vector3((p1.x + p2.x) / 2, Math.max(p1.y, p2.y) + .35, 2.35);
        const newCurve = new CatmullRomCurve3([p1.clone(), mid, p2.clone()]);
        arcMesh.geometry.dispose();
        arcMesh.geometry = new TubeGeometry(newCurve, 24, .02, 6, false);
        arcMesh.visible = true;
      } else {
        arcMesh.visible = false;
      }

      // Top Balancing LED on inverter
      inverterLeds[3].material.color.set(balancing ? '#9f7aea' : '#553c9a');
    },
    setEnergy(state) {
      // Pack SOC pill color
      const color = state.socPct == null ? '#9aa5a0' : state.socPct < 20 ? '#b65e59' : state.socPct < 40 ? '#bb954e' : '#79a483';
      packLight.material.color.set(color);
      packLight.material.emissive.set(color);

      // Inverter status LEDs: [Charging, Discharging, Grid Bypass, Top Balancing]
      const charging = (state.batteryW ?? 0) > 10;
      const discharging = (state.batteryW ?? 0) < -10;
      const bypass = (state.gridW ?? 0) > 10 && (state.batteryW ?? 0) <= 0;
      inverterLeds[0].material.color.set(charging ? '#48bb78' : '#276749');
      inverterLeds[1].material.color.set(discharging ? '#f56565' : '#7b341e');
      inverterLeds[2].material.color.set(bypass ? '#4299e1' : '#2c5282');

      // Grid meter beacon
      if (state.gridAvailable === true) {
        gridBeacon.material.color.set('#48bb78');
        gridBeacon.material.emissive.set('#48bb78');
        gridBeacon.material.emissiveIntensity = 1.2;
      } else if (state.gridAvailable === false) {
        gridBeacon.material.color.set('#f56565');
        gridBeacon.material.emissive.set('#f56565');
        gridBeacon.material.emissiveIntensity = 1.2;
      } else {
        gridBeacon.material.color.set('#718096');
        gridBeacon.material.emissive.set('#4a5568');
        gridBeacon.material.emissiveIntensity = .15;
      }
    },
    setNight(isNight, homeW = 0, sunElevationDeg = -10) {
      // Gate interior window glow by dusk factor * home load
      const dusk = Math.max(0, Math.min(1, (-sunElevationDeg + 6) / 12));
      const load = Math.min(1, Math.max(.1, (homeW || 500) / 2500));
      windows.emissiveIntensity = isNight ? (dusk * (.18 + .72 * load)) : .02;
    },
    dispose() {
      disposeObject(group);
    },
  };
}
