import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from './logger.js';
import { assertDatabaseName } from '../config/databaseName.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../sql/migrations');

/**
 * 逐个执行尚未应用的迁移并记录 SHA-256。迁移必须自身幂等，以便 DDL 中断后安全重试。
 */
export async function applyMigrations(conn, migrations, { lockName = migrationLockName() } = {}) {
  let locked = false;
  try {
    const [lockRows] = await conn.query('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Timed out waiting for the database migration lock');
    locked = true;

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(120) PRIMARY KEY,
        description VARCHAR(255),
        checksum CHAR(64) NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [checksumColumns] = await conn.query(
      `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations' AND COLUMN_NAME = 'checksum'`
    );
    if (Number(checksumColumns[0]?.count) === 0) {
      await conn.query('ALTER TABLE schema_migrations ADD COLUMN checksum CHAR(64) NULL');
    }

    const [rows] = await conn.query('SELECT id, checksum FROM schema_migrations');
    const applied = new Map(rows.map((row) => [row.id, row.checksum]));
    const knownIds = new Set(migrations.map((migration) => migration.id));
    const unknownId = [...applied.keys()].find((id) => !knownIds.has(id));
    if (unknownId) throw new Error(`Database contains unknown migration ${unknownId}`);
    if (knownIds.size !== migrations.length) throw new Error('Migration ids must be unique');

    const changed = [];
    for (const migration of migrations) {
      const checksum = applied.get(migration.id);
      if (checksum != null) {
        if (checksum !== migration.checksum) throw new Error(`Migration checksum mismatch for ${migration.id}`);
        continue;
      }

      if (applied.has(migration.id)) {
        await conn.query('UPDATE schema_migrations SET checksum = ? WHERE id = ? AND checksum IS NULL', [migration.checksum, migration.id]);
        logger.warn(`Recorded current checksum for legacy migration ${migration.id}; prior contents cannot be verified.`);
        continue;
      }

      const result = await migration.up(conn);
      await conn.query('INSERT INTO schema_migrations (id, description, checksum) VALUES (?, ?, ?)', [
        migration.id,
        migration.description || '',
        migration.checksum
      ]);
      changed.push(migration.id);
      logger.info(`Applied migration ${migration.id}`, { changed: result || [] });
    }
    return changed;
  } finally {
    if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
  }
}

function migrationLockName() {
  const database = process.env.DB_NAME || 'school_chinese_exam_practice';
  return `school-exam-${createHash('sha256').update(database).digest('hex').slice(0, 32)}`;
}

export async function runMigrations({ connection } = {}) {
  const ownsConnection = !connection;
  if (ownsConnection && !String(process.env.DB_PASSWORD || '').trim()) {
    // 与 config/db.js 一致：口令只从环境读，不设兜底（见那里的说明）
    throw new Error('DB_PASSWORD is not set. Copy admin/.env.example to admin/.env and fill it in.');
  }
  const database = assertDatabaseName(process.env.DB_NAME || 'school_chinese_exam_practice');
  const conn = connection || (await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database,
    multipleStatements: true
  }));

  try {
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.js')).sort();
    const migrations = [];
    const ids = new Set();
    for (const file of files) {
      const source = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      const module = await import(pathToFileURL(path.join(migrationsDir, file)).href);
      const migration = module.default;
      if (!migration?.id || typeof migration.up !== 'function') {
        throw new Error(`Malformed migration module: ${file}`);
      }
      if (ids.has(migration.id)) throw new Error(`Duplicate migration id: ${migration.id}`);
      ids.add(migration.id);
      migrations.push({ ...migration, checksum: createHash('sha256').update(source).digest('hex') });
    }
    return await applyMigrations(conn, migrations, { lockName: migrationLockName() });
  } finally {
    if (ownsConnection) await conn.end();
  }
}

// 允许 `npm run db:migrate` 直接执行
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const applied = await runMigrations();
    logger.info(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'No pending migrations.');
  } catch (error) {
    logger.error('Migration failed', { message: error.message });
    process.exitCode = 1;
  }
}
