// scripts/dev.mjs
// Chạy song song: proxy Gemini (server.js) + Vite dev server.
import { spawn } from 'node:child_process';

const children = [];

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, ...env }
  });
  children.push(child);
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    if (name === 'proxy') {
      console.error('Proxy Gemini đã dừng — /api/extract-menu sẽ không còn hoạt động.');
    }
  });
  return child;
}

console.log('[dev] starting gemini proxy + vite...');

run('proxy', 'node', ['server.js']);
run('vite', 'npx', ['vite', '--port=3000', '--host=0.0.0.0']);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const c of children) {
      try { c.kill(); } catch { /* noop */ }
    }
    process.exit(0);
  });
}
