/**
 * 002_token_version — 令牌吊销版本号。
 *
 * 背景：JWT 只验签名时，令牌在 7 天有效期内无法收回 —— 改密码、管理员重置密码、
 * 停用账号都拦不住已签发的令牌（攻击者拿到令牌后仍可一直访问）。
 *
 * 方案：users 上加 `token_version`，签发令牌时写进载荷（tv），中间件每次回查比对。
 * 版本号一变，所有旧令牌立即失效（返回 401）。停用账号另有 status 校验兜底。
 *
 * 默认 0：升级瞬间已签发的旧令牌没有 tv 字段，按 0 处理，不会被误伤下线。
 */

const addColumnIfMissing = async (conn, table, column, definition) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].count > 0) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
};

export default {
  id: '002_token_version',
  description: 'token revocation version for password change / admin reset / account disable',

  async up(conn) {
    const changed = [];
    if (await addColumnIfMissing(conn, 'users', 'token_version', 'INT NOT NULL DEFAULT 0')) {
      changed.push('users.token_version');
    }
    return changed;
  }
};
