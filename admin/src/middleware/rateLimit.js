import { HttpError } from '../utils/errors.js';

/**
 * 进程内滑动窗口限流。单实例部署够用；多实例时需换成 Redis 等共享存储。
 */
const buckets = new Map();

function sweep(now) {
  for (const [key, hits] of buckets) {
    const alive = hits.filter((at) => now - at < 60 * 60 * 1000);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}

let lastSweep = 0;

/**
 * @param {object} options
 * @param {number} options.windowMs 窗口长度
 * @param {number} options.max      窗口内允许的次数
 * @param {string} [options.keyPrefix]
 * @param {(req) => string} [options.keyBy] 默认按 IP 限流
 */
export function rateLimit({ windowMs = 60_000, max = 20, keyPrefix = 'rl', keyBy } = {}) {
  return (req, _res, next) => {
    const now = Date.now();
    if (now - lastSweep > 5 * 60_000) {
      sweep(now);
      lastSweep = now;
    }

    const identity = keyBy ? keyBy(req) : req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const hits = (buckets.get(key) || []).filter((at) => now - at < windowMs);

    if (hits.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      _res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      return next(new HttpError(429, `Too many requests, please retry in ${Math.max(retryAfter, 1)}s`));
    }

    hits.push(now);
    buckets.set(key, hits);
    return next();
  };
}

/** 测试或重启场景下清空计数。 */
export function resetRateLimits() {
  buckets.clear();
}
