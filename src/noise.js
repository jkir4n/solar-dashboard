// Stefan Gustavson's simplex noise — public domain
const perm = new Uint8Array(512);
const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();

const F2 = (Math.sqrt(3) - 1) / 2;
const G2 = (3 - Math.sqrt(3)) / 6;

export function snoise2(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);

  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;

  const ii = i & 255, jj = j & 255;
  const gi0 = perm[ii +     perm[jj    ]] % 8;
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
  const gi2 = perm[ii + 1  + perm[jj + 1 ]] % 8;

  let n = 0;
  let t0 = 0.5 - x0*x0 - y0*y0;
  if (t0 >= 0) { t0 *= t0; n += t0*t0 * (grad2[gi0][0]*x0 + grad2[gi0][1]*y0); }
  let t1 = 0.5 - x1*x1 - y1*y1;
  if (t1 >= 0) { t1 *= t1; n += t1*t1 * (grad2[gi1][0]*x1 + grad2[gi1][1]*y1); }
  let t2 = 0.5 - x2*x2 - y2*y2;
  if (t2 >= 0) { t2 *= t2; n += t2*t2 * (grad2[gi2][0]*x2 + grad2[gi2][1]*y2); }

  return 70 * n;
}

export function snFBM(x, y, octaves = 4) {
  let value = 0, amplitude = 0.5, frequency = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += snoise2(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / max;
}
