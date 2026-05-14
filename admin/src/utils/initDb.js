import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Java@c1024',
  multipleStatements: true
});

for (const file of ['schema.sql', 'seed.sql']) {
  const sql = await fs.readFile(path.join(root, 'sql', file), 'utf8');
  await connection.query(sql);
  logger.info(`Executed ${file}`);
}

await connection.end();
logger.info('Database initialized.');
