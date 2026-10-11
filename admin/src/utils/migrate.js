import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { logger } from './logger.js';
import { assertDatabaseName } from '../config/databaseName.js';
import { pool as defaultPool } from '../config/db.js';

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function loadMigrations() {
  const migrations = [{
    id: '001_initial_schema',
    description: 'Initial PostgreSQL schema',
    sql: await readFile(path.join(root, 'postgres', 'schema.sql'), 'utf8')
  }];
  const directory = path.join(root, 'postgres', 'migrations');
  let files = [];
  try { files = await readdir(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const file of files.filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name)).sort()) {
    migrations.push({
      id: path.basename(file, '.sql'),
      description: path.basename(file, '.sql').replace(/^\d{3}_/, '').replaceAll('_', ' '),
      sql: await readFile(path.join(directory, file), 'utf8')
    });
  }
  return migrations;
}

export async function applyMigrations({ connection, pool = defaultPool, database, migrations } = {}) {
  const ownsConnection = !connection;
  const conn = connection || await pool.getConnection();
  const targetDatabase = assertDatabaseName(database || process.env.PGDATABASE || 'school_chinese_exam_practice');
  const definitions = migrations || await loadMigrations();
  const ids = definitions.map((migration) => migration.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Migration ids must be non-empty and unique.');
  let locked = false;
  try {
    const [lockRows] = await conn.query(
      "SELECT pg_advisory_lock(hashtext('school-chinese-exam'), hashtext(?)) AS acquired",
      [targetDatabase]
    );
    locked = true;

    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(120) PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const [rows] = await conn.query('SELECT id, checksum FROM schema_migrations ORDER BY id');
    const knownIds = new Set(ids);
    const unknown = rows.find((row) => !knownIds.has(row.id));
    if (unknown) throw new Error(`Database contains unknown migration ${unknown.id}.`);
    const recorded = new Map(rows.map((row) => [row.id, row.checksum.trim()]));
    const result = { applied: [], skipped: [] };
    for (const migration of definitions) {
      const checksum = createHash('sha256').update(migration.sql).digest('hex');
      const previous = recorded.get(migration.id);
      if (previous) {
        if (previous !== checksum) throw new Error(`Migration checksum mismatch for ${migration.id}.`);
        result.skipped.push(migration.id);
        continue;
      }
      await conn.beginTransaction();
      try {
        if (migration.sql.trim()) await conn.query(migration.sql);
        await conn.query('INSERT INTO schema_migrations (id, description, checksum) VALUES (?, ?, ?)', [
          migration.id, migration.description, checksum
        ]);
        await conn.commit();
        result.applied.push(migration.id);
        logger.info(`Applied PostgreSQL migration ${migration.id}`);
      } catch (error) {
        await conn.rollback().catch(() => {});
        throw error;
      }
    }
    return result;
  } finally {
    try {
      if (locked) await conn.query("SELECT pg_advisory_unlock(hashtext('school-chinese-exam'), hashtext(?))", [targetDatabase]);
    } finally {
      if (ownsConnection) conn.release();
    }
  }
}

export async function runMigrations(options = {}) {
  return applyMigrations(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await runMigrations();
    logger.info(`PostgreSQL migrations ready: ${result.applied.length} applied, ${result.skipped.length} already applied.`);
  } finally {
    await defaultPool.end();
  }
}
