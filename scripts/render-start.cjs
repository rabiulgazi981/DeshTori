// One Render service exposes Next.js, with Nest behind a same-origin /api proxy.
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const apiRoot = resolve(root, 'apps/api');
const webRoot = resolve(root, 'apps/web');
function run(file, args, cwd, env) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveExit() : reject(new Error(`Setup exited with code ${code}`)));
  });
}
async function main() {
  if (process.env.RENDER_EXTERNAL_URL) {
    process.env.WEB_ORIGIN ||= process.env.RENDER_EXTERNAL_URL;
    process.env.PUBLIC_API_URL ||= `${process.env.RENDER_EXTERNAL_URL}/api`;
  }
  const { PrismaClient } = require('../apps/api/node_modules/@prisma/client');
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.INTEGRATIONS_ENCRYPTION_KEY) {
    throw new Error('DATABASE_URL, JWT_SECRET and INTEGRATIONS_ENCRYPTION_KEY are required');
  }
  const direct = new URL(process.env.DATABASE_URL);
  direct.hostname = direct.hostname.replace('-pooler.', '.');
  const migrationEnv = { ...process.env, DATABASE_URL: direct.toString() };
  const db = new PrismaClient({ datasources: { db: { url: migrationEnv.DATABASE_URL } } });
  try {
    const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    if (tables.length && !tables.some(t => t.table_name === '_prisma_migrations')) {
      throw new Error('Existing database without migration history: review and baseline before deploying');
    }
  } finally { await db.$disconnect(); }
  await run(resolve(apiRoot, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy'], apiRoot, migrationEnv);
  if (process.env.SEED_OWNER_PASSWORD) {
    const seededDb = new PrismaClient();
    let empty;
    try { empty = await seededDb.user.count() === 0; } finally { await seededDb.$disconnect(); }
    if (empty) await run(resolve(apiRoot, 'node_modules/ts-node/dist/bin.js'), ['--transpile-only', '-O', '{"module":"commonjs"}', 'prisma/seed.ts'], apiRoot, process.env);
  }
  const api = spawn(process.execPath, ['--max-old-space-size=160', 'dist/main.js'], {
    cwd: apiRoot, stdio: 'inherit', env: { ...process.env, PORT: '4000' },
  });
  const web = spawn(process.execPath, ['--max-old-space-size=220', 'node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0', '-p', process.env.PORT || '10000'], {
    cwd: webRoot, stdio: 'inherit', env: process.env,
  });
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    api.kill('SIGTERM'); web.kill('SIGTERM');
    setTimeout(() => process.exit(code), 1000);
  }
  for (const child of [api, web]) {
    child.on('error', () => stop(1));
    child.on('exit', code => stop(code || 1));
  }
  process.on('SIGTERM', () => stop(0));
  process.on('SIGINT', () => stop(0));
}
main().catch(() => { console.error('DeshTori setup failed. Check database reachability, migration history and required environment variables.'); process.exit(1); });
