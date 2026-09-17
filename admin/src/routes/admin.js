import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/role.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage, likeValue } from '../utils/paginate.js';
import { logger } from '../utils/logger.js';
import adminContentRoutes from './adminContent.js';
import adminAiRoutes from './adminAi.js';

/**
 * 后台管理接口。
 *
 * 约定：**每个菜单的列表都是分页查询**，统一返回
 * `{ code, message, data: { list, total, page, pageSize, totalPages } }`。
 *
 * 目录：
 *   /stats        数据看板
 *   /users        学生管理（含在线状态）
 *   /records      成绩记录
 *   /login-logs   登录日志
 *   /online       在线状态
 *   /levels /categories /questions /papers   → adminContent.js
 *   /ai/*                                    → adminAi.js
 */

const router = Router();
router.use(auth(), allow('admin'));

/** 最近活跃视为在线的时间窗（分钟）。 */
const ONLINE_WINDOW_MINUTES = 5;
const ROLES = ['student', 'admin'];
const USER_STATUS = ['active', 'disabled'];
const USER_FIELDS = ['name', 'email', 'phone', 'student_no', 'nationality', 'language'];
const LANGUAGES = ['zh-CN', 'en-US', 'ms-MY'];
const LOGIN_ACTIONS = ['login', 'logout', 'register', 'change_password', 'reset_password'];

function toInt(value, label, { min = 0 } = {}) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min) throw new HttpError(400, `${label} 必须是 ≥ ${min} 的整数`);
  return num;
}

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `${label} 取值非法：${value}`);
  return value;
}

/** 只接受 `YYYY-MM-DD`，避免把任意字符串拼进 SQL。 */
function toDate(value, label) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new HttpError(400, `${label} 格式应为 YYYY-MM-DD`);
  return String(value);
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function onlineMinutes(req) {
  const raw = Number.parseInt(req.query.minutes, 10);
  return Number.isInteger(raw) && raw > 0 && raw <= 1440 ? raw : ONLINE_WINDOW_MINUTES;
}

// ---------------------------------------------------------------- 数据看板

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [[totals]] = await pool.execute(
      `SELECT (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
              (SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active') AS active_students,
              (SELECT COUNT(*) FROM users WHERE last_active_at > NOW() - INTERVAL ${ONLINE_WINDOW_MINUTES} MINUTE) AS online,
              (SELECT COUNT(*) FROM questions WHERE status = 'published') AS questions,
              (SELECT COUNT(*) FROM papers WHERE status = 'published') AS papers,
              (SELECT COUNT(*) FROM study_records) AS records,
              (SELECT COALESCE(ROUND(AVG(total_score), 1), 0) FROM study_records) AS avg_score,
              (SELECT COALESCE(SUM(correct_count), 0) FROM study_records) AS correct_total,
              (SELECT COALESCE(SUM(total_questions), 0) FROM study_records) AS question_total`
    );

    const [trend] = await pool.execute(
      `SELECT DATE(submitted_at) AS day,
              COUNT(*) AS records,
              COUNT(DISTINCT user_id) AS users,
              ROUND(AVG(total_score), 1) AS avg_score
       FROM study_records
       WHERE submitted_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(submitted_at) ORDER BY day`
    );

    const [signups] = await pool.execute(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM users WHERE created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(created_at) ORDER BY day`
    );

    const [topWrong] = await pool.execute(
      `SELECT w.question_id, COUNT(*) AS wrong_times, SUM(w.resolved) AS resolved_times,
              q.question_type, q.difficulty,
              qt.title AS title
       FROM wrong_questions w
       JOIN questions q ON q.id = w.question_id
       LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = 'zh-CN'
       GROUP BY w.question_id, q.question_type, q.difficulty, title
       ORDER BY wrong_times DESC, w.question_id LIMIT 10`
    );

    const [byLevel] = await pool.execute(
      `SELECT l.code, COALESCE(lt.name, l.code) AS name,
              COUNT(DISTINCT r.id) AS records,
              ROUND(AVG(r.total_score), 1) AS avg_score
       FROM levels l
       LEFT JOIN level_translations lt ON lt.level_id = l.id AND lt.language_code = 'zh-CN'
       LEFT JOIN papers p ON p.level_id = l.id
       LEFT JOIN study_records r ON r.paper_id = p.id
       GROUP BY l.id, l.code, name ORDER BY l.sort_order`
    );

    const [recent] = await pool.execute(
      `SELECT r.id, r.total_score, r.correct_count, r.total_questions, r.submitted_at,
              u.username, u.name AS user_name
       FROM study_records r JOIN users u ON u.id = r.user_id
       ORDER BY r.submitted_at DESC LIMIT 10`
    );

    const questionTotal = Number(totals.question_total);
    ok(res, {
      totals: {
        students: Number(totals.students),
        activeStudents: Number(totals.active_students),
        online: Number(totals.online),
        questions: Number(totals.questions),
        papers: Number(totals.papers),
        records: Number(totals.records),
        avgScore: Number(totals.avg_score),
        accuracy: questionTotal ? Number(((Number(totals.correct_total) / questionTotal) * 100).toFixed(1)) : 0
      },
      trend,
      signups,
      topWrongQuestions: topWrong,
      byLevel,
      recentRecords: recent
    });
  })
);

// ---------------------------------------------------------------- 学生管理

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR u.student_no LIKE ?)');
      params.push(keyword, keyword, keyword, keyword);
    }
    if (req.query.role) {
      conditions.push('u.role = ?');
      params.push(assertEnum(req.query.role, ROLES, 'role'));
    }
    if (req.query.status) {
      conditions.push('u.status = ?');
      params.push(assertEnum(req.query.status, USER_STATUS, 'status'));
    }
    if (req.query.online === 'true') {
      conditions.push(`u.last_active_at > NOW() - INTERVAL ${onlineMinutes(req)} MINUTE`);
    }
    if (req.query.locked === 'true') {
      conditions.push('u.locked_until IS NOT NULL AND u.locked_until > NOW()');
    }

    const data = await queryPage({
      columns: `u.id, u.username, u.name, u.email, u.phone, u.role, u.student_no, u.nationality,
                u.language, u.status, u.avatar_url, u.last_active_at, u.last_login_at, u.login_count,
                u.locked_until, u.created_at,
                (u.last_active_at > NOW() - INTERVAL ${onlineMinutes(req)} MINUTE) AS online,
                (SELECT COUNT(*) FROM study_records r WHERE r.user_id = u.id) AS record_count,
                (SELECT COALESCE(ROUND(AVG(r.total_score), 1), 0) FROM study_records r WHERE r.user_id = u.id) AS avg_score,
                (SELECT COUNT(*) FROM wrong_questions w WHERE w.user_id = u.id AND w.resolved = 0) AS unresolved_wrong`,
      from: 'FROM users u',
      conditions,
      params,
      orderBy: 'u.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[user]] = await pool.execute(
      `SELECT id, username, name, email, phone, role, student_no, nationality, language, status,
              avatar_url, last_active_at, last_login_at, login_count, failed_login_count, locked_until, created_at
       FROM users WHERE id = ?`,
      [id]
    );
    if (!user) throw new HttpError(404, '用户不存在');

    const [[stats]] = await pool.execute(
      `SELECT (SELECT COUNT(*) FROM study_records WHERE user_id = ?) AS records,
              (SELECT COALESCE(ROUND(AVG(total_score), 1), 0) FROM study_records WHERE user_id = ?) AS avg_score,
              (SELECT COUNT(*) FROM wrong_questions WHERE user_id = ?) AS wrong,
              (SELECT COUNT(*) FROM wrong_questions WHERE user_id = ? AND resolved = 0) AS unresolved_wrong,
              (SELECT COUNT(*) FROM ai_sessions WHERE user_id = ?) AS ai_sessions`,
      [id, id, id, id, id]
    );
    ok(res, { ...user, stats });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[user]] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!user) throw new HttpError(404, '用户不存在');

    const sets = [];
    const params = [];

    for (const field of USER_FIELDS) {
      if (req.body?.[field] === undefined) continue;
      const column = field;
      sets.push(`${column} = ?`);
      params.push(normalizeText(req.body[field]));
    }
    if (req.body?.language !== undefined) {
      const language = normalizeText(req.body.language);
      if (language && !LANGUAGES.includes(language)) throw new HttpError(400, `language 取值非法：${language}`);
    }
    if (req.body?.role !== undefined) {
      const role = assertEnum(req.body.role, ROLES, 'role');
      if (id === req.user.id && role !== 'admin') throw new HttpError(400, '不能取消自己的管理员身份');
      if (user.role === 'admin' && role !== 'admin') {
        const [[admins]] = await pool.execute("SELECT COUNT(*) count FROM users WHERE role = 'admin' AND status = 'active'");
        if (admins.count <= 1) throw new HttpError(409, '至少需要保留一名管理员');
      }
      sets.push('role = ?');
      params.push(role);
    }
    if (req.body?.status !== undefined) {
      const status = assertEnum(req.body.status, USER_STATUS, 'status');
      if (id === req.user.id && status !== 'active') throw new HttpError(400, '不能停用自己');
      sets.push('status = ?');
      params.push(status);
      // 停用要立刻生效：中间件虽然会查 status，但顺手抬一版令牌更保险，
      // 也让「停用前签发的令牌」在重新启用后依然是废的。
      if (status === 'disabled' && user.status !== 'disabled') {
        sets.push('token_version = token_version + 1');
      }
    }

    if (!sets.length) throw new HttpError(400, '没有需要更新的字段');

    params.push(id);
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    ok(res, null, 'updated');
  })
);

/** 管理员重置学员密码：不传 newPassword 就生成一个随机密码并回传一次。 */
router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[user]] = await pool.execute('SELECT id, username FROM users WHERE id = ?', [id]);
    if (!user) throw new HttpError(404, '用户不存在');

    const requested = normalizeText(req.body?.newPassword);
    if (requested && requested.length < 8) throw new HttpError(400, '密码至少 8 位');
    const password = requested || crypto.randomBytes(9).toString('base64url');

    // 抬一版令牌：管理员重置密码后，该账号在所有设备上的旧会话立即失效
    await pool.execute(
      `UPDATE users SET password = ?, failed_login_count = 0, locked_until = NULL,
       token_version = token_version + 1 WHERE id = ?`,
      [await bcrypt.hash(password, 10), id]
    );
    await pool.execute(
      `INSERT INTO login_logs (user_id, username, action, success, ip, user_agent, message)
       VALUES (?, ?, 'reset_password', 1, ?, ?, ?)`,
      [id, user.username, req.ip, String(req.get('user-agent') || '').slice(0, 500), `管理员 ${req.user.username} 重置密码`]
    );

    logger.info('Admin reset a user password', { admin: req.user.username, userId: id });
    // 明文只在这里回传一次，不落库、不写日志
    ok(res, { username: user.username, password: requested ? undefined : password }, 'password reset');
  })
);

router.post(
  '/users/:id/unlock',
  asyncHandler(async (req, res) => {
    const [result] = await pool.execute(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?',
      [Number(req.params.id)]
    );
    if (!result.affectedRows) throw new HttpError(404, '用户不存在');
    ok(res, null, 'unlocked');
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, '不能删除自己');

    const [[user]] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!user) throw new HttpError(404, '用户不存在');
    if (user.role === 'admin') {
      const [[admins]] = await pool.execute("SELECT COUNT(*) count FROM users WHERE role = 'admin'");
      if (admins.count <= 1) throw new HttpError(409, '至少需要保留一名管理员');
    }

    // study_records / wrong_questions / ai_sessions 均 ON DELETE CASCADE
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    logger.info('Admin deleted a user', { admin: req.user.username, userId: id, username: user.username });
    ok(res, null, 'deleted');
  })
);

// ---------------------------------------------------------------- 成绩记录

router.get(
  '/records',
  asyncHandler(async (req, res) => {
    const lang = LANGUAGES.includes(req.query.lang) ? req.query.lang : 'zh-CN';
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.name LIKE ? OR COALESCE(pt.title, pz.title) LIKE ?)');
      params.push(keyword, keyword, keyword);
    }
    if (req.query.userId) {
      conditions.push('r.user_id = ?');
      params.push(toInt(req.query.userId, 'userId', { min: 1 }));
    }
    if (req.query.paperId) {
      conditions.push('r.paper_id = ?');
      params.push(toInt(req.query.paperId, 'paperId', { min: 1 }));
    }
    const from = toDate(req.query.dateFrom, 'dateFrom');
    if (from) {
      conditions.push('r.submitted_at >= ?');
      params.push(`${from} 00:00:00`);
    }
    const to = toDate(req.query.dateTo, 'dateTo');
    if (to) {
      conditions.push('r.submitted_at <= ?');
      params.push(`${to} 23:59:59`);
    }
    if (req.query.minScore) {
      conditions.push('r.total_score >= ?');
      params.push(Number(req.query.minScore));
    }

    const data = await queryPage({
      columns: `r.id, r.user_id, r.paper_id, r.total_questions, r.correct_count, r.wrong_count,
                r.total_score, r.duration_seconds, r.started_at, r.submitted_at,
                u.username, u.name AS user_name, u.student_no,
                COALESCE(pt.title, pz.title) AS paper_title`,
      from: `FROM study_records r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN papers p ON p.id = r.paper_id
             LEFT JOIN paper_translations pt ON pt.paper_id = r.paper_id AND pt.language_code = ?
             LEFT JOIN paper_translations pz ON pz.paper_id = r.paper_id AND pz.language_code = 'zh-CN'`,
      conditions,
      params: [lang, ...params],
      orderBy: 'r.submitted_at DESC, r.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/records/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[record]] = await pool.execute(
      `SELECT r.*, u.username, u.name AS user_name
       FROM study_records r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
      [id]
    );
    if (!record) throw new HttpError(404, '成绩记录不存在');

    const [answers] = await pool.execute(
      `SELECT a.id, a.question_id, a.is_correct, a.score, a.answered_at,
              a.selected_option_ids, a.answer_text,
              COALESCE(qt.title, qz.title) AS title
       FROM user_answers a
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = 'zh-CN'
       LEFT JOIN question_translations qz ON qz.question_id = q.id AND qz.language_code = 'zh-CN'
       WHERE a.study_record_id = ? ORDER BY a.id`,
      [id]
    );
    record.answers = answers;
    ok(res, record);
  })
);

// ---------------------------------------------------------------- 登录日志

router.get(
  '/login-logs',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('l.username LIKE ?');
      params.push(keyword);
    }
    if (req.query.userId) {
      conditions.push('l.user_id = ?');
      params.push(toInt(req.query.userId, 'userId', { min: 1 }));
    }
    if (req.query.action) {
      conditions.push('l.action = ?');
      params.push(assertEnum(req.query.action, LOGIN_ACTIONS, 'action'));
    }
    if (req.query.success !== undefined && req.query.success !== '') {
      conditions.push('l.success = ?');
      params.push(req.query.success === 'true' || req.query.success === '1' ? 1 : 0);
    }
    if (req.query.ip) {
      conditions.push('l.ip = ?');
      params.push(String(req.query.ip));
    }
    const from = toDate(req.query.dateFrom, 'dateFrom');
    if (from) {
      conditions.push('l.created_at >= ?');
      params.push(`${from} 00:00:00`);
    }
    const to = toDate(req.query.dateTo, 'dateTo');
    if (to) {
      conditions.push('l.created_at <= ?');
      params.push(`${to} 23:59:59`);
    }

    const data = await queryPage({
      columns: `l.id, l.user_id, l.username, l.action, l.success, l.ip, l.user_agent, l.message, l.created_at,
                u.name AS user_name`,
      from: 'FROM login_logs l LEFT JOIN users u ON u.id = l.user_id',
      conditions,
      params,
      orderBy: 'l.created_at DESC, l.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

// ---------------------------------------------------------------- 在线状态

router.get(
  '/online',
  asyncHandler(async (req, res) => {
    const minutes = onlineMinutes(req);
    const { page, pageSize } = pageParams(req.query);
    const conditions = [`u.last_active_at > NOW() - INTERVAL ${minutes} MINUTE`];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.name LIKE ?)');
      params.push(keyword, keyword);
    }
    if (req.query.role) {
      conditions.push('u.role = ?');
      params.push(assertEnum(req.query.role, ROLES, 'role'));
    }

    const data = await queryPage({
      columns: `u.id, u.username, u.name, u.role, u.avatar_url, u.language, u.status,
                u.last_active_at, u.last_login_at, u.login_count,
                TIMESTAMPDIFF(MINUTE, u.last_active_at, NOW()) AS idle_minutes`,
      from: 'FROM users u',
      conditions,
      params,
      orderBy: 'u.last_active_at DESC',
      page,
      pageSize
    });

    const [[summary]] = await pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(role = 'student') AS students,
              SUM(role = 'admin') AS admins
       FROM users WHERE last_active_at > NOW() - INTERVAL ${minutes} MINUTE`
    );
    ok(res, { ...data, windowMinutes: minutes, summary });
  })
);

// ---------------------------------------------------------------- 子路由

router.use('/', adminContentRoutes);
router.use('/ai', adminAiRoutes);

export default router;
