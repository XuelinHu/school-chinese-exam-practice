import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from './logger.js';
import { runMigrations } from './migrate.js';
import { assertDatabaseName } from '../config/databaseName.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const database = assertDatabaseName(process.env.DB_NAME || 'school_chinese_exam_practice');
const connectionOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD
};

if (!String(process.env.DB_PASSWORD || '').trim()) {
  throw new Error('DB_PASSWORD is not set. Copy admin/.env.example to admin/.env and fill it in.');
}

const admin = await mysql.createConnection(connectionOptions);
try {
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} finally {
  await admin.end();
}

const connection = await mysql.createConnection({ ...connectionOptions, database, multipleStatements: true });
try {
  const schema = await fs.readFile(path.join(root, 'sql', 'schema.sql'), 'utf8');
  await connection.query(schema);
  logger.info(`Executed schema.sql for ${database}`);

  await runMigrations({ connection });

  const seed = await fs.readFile(path.join(root, 'sql', 'seed.sql'), 'utf8');
  await connection.query(seed);
  logger.info('Executed seed.sql');
} finally {
  await connection.end();
}

logger.info('Database initialized.');
