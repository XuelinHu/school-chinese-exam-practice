import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDemoSeedAllowed } from '../src/utils/demoSeedGuard.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });

if (!/_test$/i.test(process.env.DB_NAME || '')) {
  throw new Error('Integration checks require DB_NAME to end with _test.');
}
assertDemoSeedAllowed(process.env);

const root = path.resolve(directory, '..');
const port = await freePort();
const base = `http://127.0.0.1:${port}/api`;
const env = { ...process.env, PORT: String(port), CHECK_BASE: base };

function run(script) {
  const result = spawnSync(process.execPath, [script], { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
}

run('src/utils/initDb.js');
const bootstrapEnv = { ...env, CONFIRM_ADMIN_BOOTSTRAP: '1' };
const bootstrapArgs = ['src/utils/bootstrapAdmin.js', '--username', 'admin', '--password-stdin'];
const bootstrap = spawnSync(process.execPath, bootstrapArgs, {
  cwd: root,
  env: bootstrapEnv,
  input: `${process.env.SEED_ADMIN_PASSWORD}\n`,
  encoding: 'utf8'
});
assert.equal(bootstrap.status, 0, bootstrap.stderr);
assert.equal(bootstrap.stdout.includes(process.env.SEED_ADMIN_PASSWORD), false);

const duplicateBootstrap = spawnSync(process.execPath, bootstrapArgs, {
  cwd: root,
  env: bootstrapEnv,
  input: `${process.env.SEED_ADMIN_PASSWORD}\n`,
  encoding: 'utf8'
});
assert.notEqual(duplicateBootstrap.status, 0);
assert.match(duplicateBootstrap.stderr, /administrator already exists/i);
assert.equal(duplicateBootstrap.stderr.includes(process.env.SEED_ADMIN_PASSWORD), false);

run('src/utils/seedUsers.js');

const api = spawn(process.execPath, ['src/server.js'], { cwd: root, env, stdio: 'inherit' });
try {
  await waitForApi(base, api);
  run('scripts/check-permissions.mjs');
  run('scripts/check-pagination.mjs');
} finally {
  if (api.exitCode === null) {
    api.kill('SIGTERM');
    await Promise.race([once(api, 'exit'), delay(5000)]);
    if (api.exitCode === null) api.kill('SIGKILL');
  }
}

console.log('Isolated permission and pagination checks passed.');

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port: available } = server.address();
  server.close();
  await once(server, 'close');
  return available;
}

async function waitForApi(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      await delay(100);
    }
  }
  throw new Error('Temporary API did not become ready within 10 seconds.');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
