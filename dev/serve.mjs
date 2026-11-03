import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const roots = await Promise.all(['src', 'dev', 'node_modules/three', 'node_modules/astronomy-engine'].map(p => realpath(path.join(root, p))));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const candidate = await realpath(path.join(root, pathname === '/' ? 'dev/solar-dashboard.html' : pathname));
    if (!roots.some(base => { const rel = path.relative(base, candidate); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); }) || !(await stat(candidate)).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(candidate)] || 'text/plain', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(candidate));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.SOLAR_DEV_PORT || 49629), '127.0.0.1', () => console.log(`Solar source harness: http://127.0.0.1:${server.address().port}/`));
