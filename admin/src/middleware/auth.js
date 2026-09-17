import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { HttpError } from '../utils/errors.js';

/**
 * 解析 JWT 并校验账号的**当前**状态。
 *
 * 只验签名是不够的：令牌签发后 7 天内一直有效，改密码、被管理员重置密码、
 * 被管理员停用都收不回。所以这里回查一次 users，比对两个东西：
 *  - `status` 必须为 active —— 停用立即生效，不用等令牌过期；
 *  - `token_version` 必须与签发时写进载荷的 `tv` 一致 —— 改密/重置/停用即失效。
 *
 * 角色也从库里现取，管理员被降权后旧令牌不会残留管理员权限。
 * 一次主键查询的开销可以接受，换来的是「吊销立即生效」。
 */
export function auth(required = true) {
  return async (req, _res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      if (!required) return next();
      return next(new HttpError(401, 'Unauthorized'));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    } catch {
      return next(new HttpError(401, 'Invalid token'));
    }

    try {
      const [[user]] = await pool.execute(
        'SELECT id, username, role, status, token_version FROM users WHERE id = ?',
        [payload.id]
      );

      if (!user) return next(new HttpError(401, 'Invalid token'));
      if (user.status !== 'active') return next(new HttpError(403, 'This account has been disabled'));

      // 升级前签发的老令牌没有 tv 字段，按 0 处理，避免升级瞬间把所有人踢下线
      if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
        return next(new HttpError(401, 'Session expired, please sign in again'));
      }

      req.user = { id: user.id, username: user.username, role: user.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
