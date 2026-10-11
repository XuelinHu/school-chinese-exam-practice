import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { runMigrations } from './migrate.js';
import { logger } from './logger.js';

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const identityTables = [
  'levels', 'level_translations', 'question_categories', 'question_category_translations',
  'questions', 'question_translations', 'question_options', 'question_option_translations',
  'papers', 'paper_translations', 'paper_questions', 'users'
];

try {
  const result = await runMigrations({ pool });
  const seed = await fs.readFile(path.join(root, 'postgres', 'seed.sql'), 'utf8');
  await pool.query(seed);
  for (const table of identityTables) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(COALESCE(MAX(id), 1), 1), MAX(id) IS NOT NULL) FROM ${table}`);
  }
  logger.info(`PostgreSQL schema ready: ${result.applied.length} applied, ${result.skipped.length} already applied.`);
} finally {
  await pool.end();
}
