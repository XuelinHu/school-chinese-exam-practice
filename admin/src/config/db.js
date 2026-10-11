import pg from 'pg';
import dotenv from 'dotenv';
import { assertDatabaseName } from './databaseName.js';

dotenv.config();

const { Pool, types } = pg;
types.setTypeParser(20, (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value;
});

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is not set. Copy admin/.env.example to admin/.env and fill it in.`);
  return value;
}

export const database = assertDatabaseName(process.env.PGDATABASE || 'school_chinese_exam_practice');
const idTables = new Set([
  'users', 'levels', 'level_translations', 'question_categories', 'question_category_translations',
  'questions', 'question_translations', 'question_options', 'question_option_translations', 'papers',
  'paper_translations', 'paper_questions', 'study_records', 'user_answers', 'wrong_questions',
  'favorite_questions', 'i18n_messages', 'password_resets', 'login_logs', 'ai_sessions', 'ai_messages',
  'ai_call_logs'
]);

export function bindParameters(sql, params = []) {
  const values = [];
  const named = !Array.isArray(params);
  const indexes = new Map();
  let text = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let positionalIndex = 0;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      text += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      text += char;
      if (char === '*' && next === '/') { text += next; i += 1; blockComment = false; }
      continue;
    }
    if (quote) {
      text += char;
      if (char === quote && next === quote) { text += next; i += 1; }
      else if (char === quote && sql[i - 1] !== '\\') quote = null;
      continue;
    }
    if ((char === '-' && next === '-') || (char === '/' && next === '*')) {
      text += char + next;
      i += 1;
      if (char === '-') lineComment = true;
      else blockComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char === '`' ? '`' : char;
      text += char === '`' ? '"' : char;
      continue;
    }
    if (!named && char === '?') {
      positionalIndex += 1;
      const value = params[positionalIndex - 1] ?? null;
      if (Array.isArray(value) && !/ANY\s*\(\s*$/i.test(text)) {
        if (!value.length) throw new Error('An empty array cannot be used as an SQL IN list.');
        text += value.map((item) => { values.push(item); return `$${values.length}`; }).join(', ');
      } else {
        values.push(value);
        text += `$${values.length}`;
      }
      continue;
    }
    if (named && char === ':' && next !== ':' && /[A-Za-z_]/.test(next || '')) {
      const match = sql.slice(i + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      const name = match[0];
      if (!Object.hasOwn(params, name)) throw new Error(`Missing SQL parameter: ${name}`);
      if (!indexes.has(name)) {
        values.push(params[name] ?? null);
        indexes.set(name, values.length);
      }
      text += `$${indexes.get(name)}`;
      i += name.length;
      continue;
    }
    text += char;
  }
  if (!named && positionalIndex !== params.length) throw new Error('SQL parameter count does not match placeholders.');
  return { text, values };
}

function prepare(sql, params) {
  const insert = sql.match(/^\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/i);
  const statement = insert && idTables.has(insert[1]) && !/\bRETURNING\b/i.test(sql)
    ? `${sql.trim().replace(/;$/, '')} RETURNING id`
    : sql;
  return bindParameters(statement, params);
}

async function queryOn(client, sql, params = []) {
  const { text, values } = prepare(sql, params);
  const result = await (values.length ? client.query(text, values) : client.query(text));
  const results = Array.isArray(result) ? result : [result];
  const rows = results.flatMap((item) => item.rows || []);
  const rowCount = results.reduce((total, item) => total + (item.rowCount || 0), 0);
  const metadata = { affectedRows: rowCount, rowCount, insertId: rows[0]?.id };
  Object.defineProperties(rows, {
    affectedRows: { value: metadata.affectedRows, enumerable: false },
    rowCount: { value: metadata.rowCount, enumerable: false },
    insertId: { value: metadata.insertId, enumerable: false }
  });
  return [rows, metadata];
}

const ssl = process.env.PGSSL === '1' ? { rejectUnauthorized: true } : undefined;
export const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'school_chinese_exam_practice_app',
  password: requireEnv('PGPASSWORD'),
  database,
  max: Math.min(50, Math.max(1, Number(process.env.PGPOOL_MAX || 10))),
  ssl,
  application_name: 'school-chinese-exam-practice'
});

const rawPoolQuery = pool.query.bind(pool);
const queryPool = (sql, params = []) => queryOn({ query: rawPoolQuery }, sql, params);
pool.query = queryPool;
pool.execute = queryPool;
const getConnection = pool.connect.bind(pool);
pool.getConnection = async () => {
  const client = await getConnection();
  return {
    query: (sql, params = []) => queryOn(client, sql, params),
    execute: (sql, params = []) => queryOn(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release()
  };
};

export async function tx(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
