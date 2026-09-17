import { pool } from '../config/db.js';

/**
 * 节流刷新 `users.last_active_at`，用于「在线状态」。
 * 每个用户最多每 60 秒写一次库，避免每个请求都产生一次 UPDATE。
 *
 * 挂在全局：`req.user` 由各路由内的 auth() 填充，因此在响应结束时读取才拿得到。
 */
const WRITE_INTERVAL_MS = 60_000;
const lastWrite = new Map();

export function touchActive(req, res, next) {
  res.on('finish', () => {
    const userId = req.user?.id;
    if (!userId) return;

    const now = Date.now();
    if (now - (lastWrite.get(userId) || 0) < WRITE_INTERVAL_MS) return;
    lastWrite.set(userId, now);

    pool
      .execute('UPDATE users SET last_active_at = NOW() WHERE id = ?', [userId])
      .catch(() => lastWrite.delete(userId));
  });
  next();
}
