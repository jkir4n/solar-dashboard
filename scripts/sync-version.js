// Runs automatically via the "version" npm lifecycle hook.
// Writes the current package.json version into hacs.json so they stay in sync.
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const hacsPath = resolve(root, 'hacs.json');

const hacs = JSON.parse(readFileSync(hacsPath, 'utf8'));
hacs.version = version;
writeFileSync(hacsPath, JSON.stringify(hacs, null, 2) + '\n');

console.log(`hacs.json version → ${version}`);
