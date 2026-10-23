import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'dist/renderer/app.js');
mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/renderer/app.js')],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome140'],
  sourcemap: false,
  minify: process.env.NODE_ENV === 'production',
  legalComments: 'none',
  logLevel: 'info'
});
console.log('renderer bundle built:', outfile);
