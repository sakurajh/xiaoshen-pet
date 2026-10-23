import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

async function rebuild() {
  await import('./build.mjs');
}

let child = null;
function launch() {
  child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.log('Electron exited with', code);
    child = null;
    process.exit(code ?? 0);
  });
}

await rebuild();
launch();

let timer = null;
try {
  watch(new URL('../src/renderer', import.meta.url), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await rebuild();
      if (child) {
        child.kill();
        child.once('exit', () => launch());
      } else {
        launch();
      }
    }, 180);
  });
} catch {
  // recursive watch is best-effort
}
