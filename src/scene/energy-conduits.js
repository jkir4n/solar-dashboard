import { Group, CatmullRomCurve3, Vector3, Mesh, TubeGeometry, SphereGeometry, MeshBasicMaterial } from 'three';
import { disposeObject } from './house-compound.js';

export function energyRoutes(state) {
  const positive = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const solar = positive(state.solarW);
  const battery = Number.isFinite(state.batteryW) ? (state.batteryW > 0 ? Math.min(state.batteryW, solar) : state.batteryW) : 0;
  return { solar, battery, grid: positive(state.gridW), home: positive(state.homeW) };
}

const THEME_PALETTES = {
  light: {
    solar: '#af8539',
    batteryCharge: '#548a75',
    batteryDischarge: '#ac5550',
    grid: '#7582a2',
    home: '#5e8790',
  },
  dark: {
    solar: '#d2b26e',
    batteryCharge: '#8cb89a',
    batteryDischarge: '#d66860',
    grid: '#a8b0cf',
    home: '#78a6b0',
  },
};

export function createEnergyConduits() {
  const group = new Group(), routes = [];
  let theme = 'dark';
  let currentState = null;

  const definitions = [
    ['solar', [[2.6,3.25,-.8],[2.85,3,-.8],[2.85,.32,-.8],[3.9,.32,-.1],[3.9,.32,2.8],[3.28,.65,2.8]]],
    ['battery', [[3.28,.65,2.8],[3.28,.4,3.1],[2.4,.4,3.1],[2.4,.8,2.4]]],
    ['grid', [[5.25,.3,2.35],[5.25,.16,3.95],[3.9,.16,3.95],[3.9,.3,2.8],[3.28,.65,2.8]]],
    ['home', [[3.28,.65,2.8],[3.25,.31,3.3],[.2,.31,3.3],[.2,.31,1.5]]],
  ];

  for (const [name, points] of definitions) {
    const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'catmullrom', .05);
    const initialColor = THEME_PALETTES.dark[name === 'battery' ? 'batteryCharge' : name];
    const pipe = new Mesh(new TubeGeometry(curve, 60, .025, 6, false), new MeshBasicMaterial({ color: initialColor, transparent: true, opacity: .35 }));
    group.add(pipe);
    const beads = Array.from({ length: 5 }, () => {
      const mesh = new Mesh(new SphereGeometry(.055, 8, 6), new MeshBasicMaterial({ color: initialColor }));
      group.add(mesh);
      return mesh;
    });
    routes.push({ name, curve, pipe, beads, watts: 0, phase: 0 });
  }

  function updateColors() {
    const pal = THEME_PALETTES[theme] || THEME_PALETTES.dark;
    const values = currentState ? energyRoutes(currentState) : { solar: 0, battery: 0, grid: 0, home: 0 };
    for (const r of routes) {
      let color = pal[r.name];
      if (r.name === 'battery') {
        color = values.battery < -10 ? pal.batteryDischarge : pal.batteryCharge;
      } else if (r.name === 'home') {
        // Color Home load conduit by dominant supply source
        const solarToHome = Math.max(0, values.solar - Math.max(0, values.battery));
        const batteryToHome = values.battery < -10 ? Math.abs(values.battery) : 0;
        const gridToHome = values.grid;
        if (batteryToHome > solarToHome && batteryToHome > gridToHome && batteryToHome > 10) {
          color = pal.batteryDischarge;
        } else if (gridToHome > solarToHome && gridToHome > batteryToHome && gridToHome > 10) {
          color = pal.grid;
        } else if (solarToHome > 10) {
          color = pal.solar;
        } else {
          color = pal.home;
        }
      }
      r.pipe.material.color.set(color);
      for (const b of r.beads) b.material.color.set(color);
    }
  }

  return {
    group,
    routes,
    setState(state) {
      currentState = state;
      const values = energyRoutes(state);
      routes.forEach(r => {
        r.watts = values[r.name];
        r.pipe.material.opacity = Math.abs(r.watts) > 10 ? .7 : .18;
      });
      updateColors();
    },
    setTheme(newTheme) {
      theme = newTheme;
      updateColors();
    },
    tick(dt) {
      for (const r of routes) {
        r.phase = (r.phase + dt * (.04 + Math.min(Math.abs(r.watts), 6000) / 30000)) % 1;
        r.beads.forEach((b, i) => {
          b.visible = Math.abs(r.watts) > 10;
          const t = (r.phase + i / r.beads.length) % 1;
          b.position.copy(r.curve.getPointAt(r.watts < 0 ? 1 - t : t));
        });
      }
    },
    dispose() { disposeObject(group); },
  };
}
