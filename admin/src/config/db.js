import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 数据库口令不设兜底值。
 *
 * 以前这里写着 `|| '<真实口令>'`，等于把生产口令固化进仓库（AGENT.md 明确要求
 * 「Keep real passwords only in local `.env`」）。没有兜底值后忘记配 .env 会启动即报错，
 * 这是想要的行为 —— 明确失败好过静默用一个谁都能从仓库里读到的口令连上库。
 */
function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy admin/.env.example to admin/.env and fill it in.`);
  }
  return value;
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: requireEnv('DB_PASSWORD'),
  database: process.env.DB_NAME || 'school_chinese_exam_practice',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

export async function tx(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
