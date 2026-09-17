import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, raw } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage, likeValue } from '../utils/paginate.js';
import { logger } from '../utils/logger.js';
import { avatarDir, sniffImage, UPLOAD_URL_PREFIX } from '../config/uploads.js';

const router = Router();

const publicUserFields =
  'id, username, name, email, phone, role, student_no, nationality, language, status, avatar_url, last_login_at, login_count, created_at';

const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'ms-MY'];
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 64;

/** 连续失败达到该次数后锁定账号。 */
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_CODE_TTL_MINUTES = 10;

const rateLimitKeyByUser = (req) => String(req.user?.id || req.ip || 'unknown');

// ---------------------------------------------------------------- helpers

function clientIp(req) {
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;
}

function userAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 500) || null;
}

async function writeLoginLog(req, { userId = null, username = null, action, success = true, message = null }) {
  try {
    await pool.execute(
      `INSERT INTO login_logs (user_id, username, action, success, ip, user_agent, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, success ? 1 : 0, clientIp(req), userAgent(req), message]
    );
  } catch (error) {
    logger.warn('Failed to write login log', { action, message: error.message });
  }
}

function validatePassword(password, confirmPassword) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    throw new HttpError(400, `Password must be at least ${PASSWORD_MIN} characters`);
  }
  if (password.length > PASSWORD_MAX) {
    throw new HttpError(400, `Password must be at most ${PASSWORD_MAX} characters`);
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new HttpError(400, 'The two passwords do not match');
  }
}

/**
 * `tv`（token_version）必须写进载荷：中间件拿它和库里的当前值比对，
 * 一旦改密/被重置/被停用版本号自增，所有旧令牌立刻作废。
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, tv: user.token_version ?? 0 },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );
}

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : null;
}

function assertUserIsActive(user) {
  if (user.status !== 'active') throw new HttpError(403, 'This account has been disabled');
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    throw new HttpError(423, `Account locked, please retry in ${minutes} minute(s)`);
  }
}

/** 是否把找回密码的重置码回传前端（仅开发/演示环境应开启）。 */
function resetCodeIsReturnable() {
  return process.env.AUTH_RESET_RETURN_CODE === 'true' || process.env.NODE_ENV !== 'production';
}

// ---------------------------------------------------------------- 注册 / 登录 / 退出

router.post(
  '/register',
  rateLimit({ keyPrefix: 'register', windowMs: 60 * 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const { username, password, confirmPassword, name, email, phone, student_no, nationality } = req.body || {};
    const language = normalizeLanguage(req.body?.language) || 'zh-CN';

    if (!USERNAME_PATTERN.test(String(username || ''))) {
      throw new HttpError(400, 'Username must be 3-50 characters and use letters, digits, dot, dash or underscore');
    }
    validatePassword(password, confirmPassword);
    if (email && !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Invalid email address');

    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) throw new HttpError(409, 'This username is already taken');

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (username, password, name, email, phone, role, student_no, nationality, language, status)
       VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, 'active')`,
      [username, hash, name || username, email || null, phone || null, student_no || null, nationality || 'Malaysia', language]
    );

    await writeLoginLog(req, { userId: result.insertId, username, action: 'register' });
    ok(res, { id: result.insertId, username }, 'registered');
  })
);

router.post(
  '/login',
  rateLimit({ keyPrefix: 'login', windowMs: 15 * 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) throw new HttpError(400, 'Username and password are required');

    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    // 账号不存在时也走一次 bcrypt，避免用响应时间探测用户名是否注册
    if (!user) {
      await bcrypt.compare(String(password), '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu');
      await writeLoginLog(req, { username, action: 'login', success: false, message: 'unknown username' });
      throw new HttpError(401, 'Invalid username or password');
    }

    try {
      assertUserIsActive(user);
    } catch (error) {
      await writeLoginLog(req, { userId: user.id, username, action: 'login', success: false, message: error.message });
      throw error;
    }

    if (!(await bcrypt.compare(String(password), user.password))) {
      const failed = Number(user.failed_login_count || 0) + 1;
      const lockedUntil = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await pool.execute('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?', [
        failed,
        lockedUntil,
        user.id
      ]);
      const message = lockedUntil
        ? `Too many failed attempts, account locked for ${LOCK_MINUTES} minutes`
        : 'Invalid username or password';
      await writeLoginLog(req, { userId: user.id, username, action: 'login', success: false, message });
      throw new HttpError(lockedUntil ? 423 : 401, message);
    }

    await pool.execute(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW(),
              last_active_at = NOW(), login_count = login_count + 1
       WHERE id = ?`,
      [user.id]
    );
    await writeLoginLog(req, { userId: user.id, username, action: 'login' });

    const [[fresh]] = await pool.execute(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [user.id]);
    ok(res, { token: signToken(user), user: fresh });
  })
);

router.post(
  '/logout',
  auth(),
  asyncHandler(async (req, res) => {
    await writeLoginLog(req, { userId: req.user.id, username: req.user.username, action: 'logout' });
    ok(res);
  })
);

// ---------------------------------------------------------------- 个人资料

router.get(
  '/profile',
  auth(),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [req.user.id]);
    if (!rows[0]) throw new HttpError(404, 'User not found');
    ok(res, rows[0]);
  })
);

router.put(
  '/profile',
  auth(),
  asyncHandler(async (req, res) => {
    const { name, email, phone, nationality } = req.body || {};
    if (email && !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Invalid email address');

    const language = normalizeLanguage(req.body?.language);
    const current = (await pool.execute(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [req.user.id]))[0][0];
    if (!current) throw new HttpError(404, 'User not found');

    await pool.execute('UPDATE users SET name = ?, email = ?, phone = ?, nationality = ?, language = ? WHERE id = ?', [
      name ?? current.name,
      email ?? current.email,
      phone ?? current.phone,
      nationality ?? current.nationality,
      language ?? current.language,
      req.user.id
    ]);

    const [[fresh]] = await pool.execute(`SELECT ${publicUserFields} FROM users WHERE id = ?`, [req.user.id]);
    ok(res, fresh, 'saved');
  })
);

router.post(
  '/profile/avatar',
  auth(),
  raw({ type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw new HttpError(400, 'No image payload received (Content-Type must be image/png, image/jpeg, image/gif or image/webp)');
    }

    const kind = sniffImage(buffer);
    if (!kind) throw new HttpError(400, 'Unsupported or corrupted image file');

    await fs.mkdir(avatarDir, { recursive: true });
    // 换格式上传时清掉旧文件，避免残留
    for (const stale of await fs.readdir(avatarDir).catch(() => [])) {
      if (stale.startsWith(`${req.user.id}.`)) await fs.unlink(path.join(avatarDir, stale)).catch(() => {});
    }

    const filename = `${req.user.id}.${kind.ext}`;
    await fs.writeFile(path.join(avatarDir, filename), buffer);

    const url = `${UPLOAD_URL_PREFIX}/avatars/${filename}`;
    await pool.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);
    ok(res, { avatar_url: url }, 'uploaded');
  })
);

// ---------------------------------------------------------------- 修改 / 找回密码

router.post(
  '/change-password',
  auth(),
  rateLimit({ keyPrefix: 'change-password', windowMs: 15 * 60_000, max: 10, keyBy: rateLimitKeyByUser }),
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body || {};
    if (!oldPassword) throw new HttpError(400, 'Current password is required');
    validatePassword(newPassword, confirmPassword);

    const [[user]] = await pool.execute('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!user || !(await bcrypt.compare(String(oldPassword), user.password))) {
      await writeLoginLog(req, { userId: req.user.id, username: req.user.username, action: 'change_password', success: false, message: 'wrong current password' });
      throw new HttpError(400, 'Current password is incorrect');
    }
    if (await bcrypt.compare(String(newPassword), user.password)) {
      throw new HttpError(400, 'The new password must be different from the current one');
    }

    // token_version 自增：本次请求用的令牌（以及任何其他设备上的令牌）立即失效，
    // 前端改密后必须重新登录 —— 否则被盗令牌能一直用到 7 天后过期。
    await pool.execute(
      `UPDATE users SET password = ?, failed_login_count = 0, locked_until = NULL,
       token_version = token_version + 1 WHERE id = ?`,
      [await bcrypt.hash(newPassword, 10), req.user.id]
    );
    await writeLoginLog(req, { userId: req.user.id, username: req.user.username, action: 'change_password' });
    ok(res, null, 'password changed');
  })
);

router.post(
  '/password/forgot',
  rateLimit({ keyPrefix: 'forgot', windowMs: 15 * 60_000, max: 5 }),
  asyncHandler(async (req, res) => {
    const { username, email, student_no: studentNo } = req.body || {};
    if (!username) throw new HttpError(400, 'Username is required');
    if (!email && !studentNo) throw new HttpError(400, 'Please provide the bound email or student number to verify your identity');

    const [[user]] = await pool.execute(
      'SELECT id, username, email, student_no FROM users WHERE username = ? AND status = ?',
      [username, 'active']
    );

    const genericMessage = 'If the account details match, a reset code has been issued';
    if (!user) {
      await writeLoginLog(req, { username, action: 'reset_password', success: false, message: 'forgot: unknown username' });
      return ok(res, null, genericMessage);
    }

    const emailMatches = email && user.email && String(user.email).toLowerCase() === String(email).toLowerCase();
    const studentNoMatches = studentNo && user.student_no && String(user.student_no) === String(studentNo);
    if (!emailMatches && !studentNoMatches) {
      await writeLoginLog(req, { userId: user.id, username, action: 'reset_password', success: false, message: 'forgot: identity mismatch' });
      return ok(res, null, genericMessage);
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.execute('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await pool.execute(
      'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [user.id, await bcrypt.hash(code, 10), RESET_CODE_TTL_MINUTES]
    );

    logger.info('Password reset code issued', { userId: user.id, username: user.username });
    await writeLoginLog(req, { userId: user.id, username, action: 'reset_password', message: 'forgot: code issued' });

    // 没有邮件服务：开发环境把码回传前端便于演示，生产环境只写日志由管理员转达
    ok(res, resetCodeIsReturnable() ? { code, expiresInMinutes: RESET_CODE_TTL_MINUTES } : null, genericMessage);
  })
);

router.post(
  '/password/reset',
  rateLimit({ keyPrefix: 'reset', windowMs: 15 * 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const { username, code, newPassword, confirmPassword } = req.body || {};
    if (!username || !code) throw new HttpError(400, 'Username and reset code are required');
    validatePassword(newPassword, confirmPassword);

    const [[user]] = await pool.execute('SELECT id, username FROM users WHERE username = ? AND status = ?', [
      username,
      'active'
    ]);
    if (!user) throw new HttpError(400, 'Invalid or expired reset code');

    const [[record]] = await pool.execute(
      `SELECT id, code_hash FROM password_resets
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );
    if (!record || !(await bcrypt.compare(String(code), record.code_hash))) {
      await writeLoginLog(req, { userId: user.id, username, action: 'reset_password', success: false, message: 'reset: bad code' });
      throw new HttpError(400, 'Invalid or expired reset code');
    }

    // 同上：重置密码也要吊销所有已签发令牌，否则盗号者仍能凭旧令牌继续访问
    await pool.execute(
      `UPDATE users SET password = ?, failed_login_count = 0, locked_until = NULL,
       token_version = token_version + 1 WHERE id = ?`,
      [await bcrypt.hash(newPassword, 10), user.id]
    );
    await pool.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [record.id]);
    await writeLoginLog(req, { userId: user.id, username, action: 'reset_password' });
    ok(res, null, 'password reset');
  })
);

// ---------------------------------------------------------------- 登录日志

router.get(
  '/login-logs',
  auth(),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = ['user_id = ?'];
    const params = [req.user.id];

    if (req.query.action) {
      conditions.push('action = ?');
      params.push(String(req.query.action));
    }
    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(username LIKE ? OR message LIKE ? OR ip LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    const data = await queryPage({
      columns: 'id, username, action, success, ip, user_agent, message, created_at',
      from: 'FROM login_logs',
      conditions,
      params,
      orderBy: 'created_at DESC, id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

export default router;
