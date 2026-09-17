import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../sql/migrations');

/**
 * 逐个执行 sql/migrations 下尚未应用的迁移，并用 schema_migrations 表记录版本。
 * 每个迁移模块导出 { id, description, up(conn) }，必须自身幂等 —— 这样
 * 「全新建库」(schema.sql 已建好一切) 与「已有旧库」两条路径都能安全跑。
 */
export async function runMigrations({ connection } = {}) {
  const ownsConnection = !connection;
  const conn = connection || (await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Java@c1024',
    database: process.env.DB_NAME || 'school_chinese_exam_practice',
    multipleStatements: true
  }));

  const applied = [];
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(120) PRIMARY KEY,
        description VARCHAR(255),
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await conn.query('SELECT id FROM schema_migrations');
    const done = new Set(rows.map((row) => row.id));

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.js'))
      .sort();

    for (const file of files) {
      const module = await import(path.join(migrationsDir, file));
      const migration = module.default;
      if (!migration?.id || typeof migration.up !== 'function') {
        logger.warn(`Skipping malformed migration: ${file}`);
        continue;
      }
      if (done.has(migration.id)) continue;

      const changed = await migration.up(conn);
      await conn.query('INSERT INTO schema_migrations (id, description) VALUES (?, ?)', [
        migration.id,
        migration.description || ''
      ]);
      applied.push(migration.id);
      logger.info(`Applied migration ${migration.id}`, { changed: changed || [] });
    }
  } finally {
    if (ownsConnection) await conn.end();
  }

  return applied;
}

// 允许 `npm run db:migrate` 直接执行
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const applied = await runMigrations();
  logger.info(applied.length ? `Migrations applied: ${applied.join(', ')}` : 'No pending migrations.');
  process.exit(0);
}
