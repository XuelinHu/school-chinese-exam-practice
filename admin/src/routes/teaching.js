import { Router } from 'express';
import { pool } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { allow, TEACHING_ROLES } from '../middleware/role.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage, likeValue } from '../utils/paginate.js';

/**
 * 教学查看区（教师端，**只读**）。
 *
 * 「教师能看不能改」靠的是这个文件里**只有 GET**，不是靠前端藏按钮 ——
 * 新增接口时请保持这一点。
 *
 * 与 /api/admin/* 的分工：那边是账号运营（改资料、重置密码、停用、看登录日志），
 * 这边只回答教学问题：谁在学、学得怎么样、错在哪。
 * 因此这里**不返回** email / phone / locked_until / login_count 这类账号字段。
 *
 * 列清单与分页响应格式和后台各菜单一致：`{ list, total, page, pageSize, totalPages }`。
 */

const router = Router();
router.use(auth(), allow(...TEACHING_ROLES));

/** 已软删除的学员不出现在任何教学视图里。 */
const ALIVE_STUDENT = "u.role = 'student' AND u.deleted_at IS NULL";

function toId(value, label) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) throw new HttpError(400, `${label} 必须是正整数`);
  return num;
}

/** 确认目标是一个未删除的学员，否则 404 —— 而不是返回空列表让人以为「没数据」。 */
async function assertStudent(id) {
  const [[student]] = await pool.execute(
    `SELECT id, username, name, student_no, nationality, status
     FROM users WHERE id = ? AND role = 'student' AND deleted_at IS NULL`,
    [id]
  );
  if (!student) throw new HttpError(404, '学员不存在');
  return student;
}

function lang(req) {
  return req.query.lang || 'zh-CN';
}

// ---------------------------------------------------------------- 学员列表

router.get(
  '/students',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = pageParams(req.query);
    const conditions = [ALIVE_STUDENT];
    const params = [];

    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.name LIKE ? OR u.student_no LIKE ?)');
      params.push(keyword, keyword, keyword);
    }
    if (req.query.status === 'active' || req.query.status === 'disabled') {
      conditions.push('u.status = ?');
      params.push(req.query.status);
    }
    // 「等级」不是学员身上的字段（users 没有等级列），这里指的是
    // 「练过该等级试卷的学员」—— 教师按等级找人是这个意思，所以用 EXISTS 表达。
    if (req.query.levelId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM study_records r
        JOIN papers p ON p.id = r.paper_id
        WHERE r.user_id = u.id AND p.level_id = ?
      )`);
      params.push(toId(req.query.levelId, 'levelId'));
    }

    const data = await queryPage({
      columns: `u.id, u.username, u.name, u.student_no, u.nationality, u.status,
                u.last_active_at, u.created_at,
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

// ---------------------------------------------------------------- 单个学员

router.get(
  '/students/:id',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id, 'id');
    const student = await assertStudent(id);
    const [[stats]] = await pool.execute(
      `SELECT COUNT(*) AS record_count,
              COALESCE(ROUND(AVG(total_score), 1), 0) AS avg_score,
              COALESCE(MAX(total_score), 0) AS best_score,
              COALESCE(SUM(duration_seconds), 0) AS total_seconds
       FROM study_records WHERE user_id = ?`,
      [id]
    );
    const [[wrong]] = await pool.execute(
      'SELECT COUNT(*) AS total, SUM(resolved = 0) AS unresolved FROM wrong_questions WHERE user_id = ?',
      [id]
    );
    ok(res, {
      ...student,
      stats: {
        recordCount: Number(stats.record_count),
        avgScore: Number(stats.avg_score),
        bestScore: Number(stats.best_score),
        totalSeconds: Number(stats.total_seconds),
        wrongTotal: Number(wrong.total || 0),
        wrongUnresolved: Number(wrong.unresolved || 0)
      }
    });
  })
);

router.get(
  '/students/:id/records',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id, 'id');
    await assertStudent(id);
    const { page, pageSize } = pageParams(req.query);
    const language = lang(req);

    const data = await queryPage({
      columns: `r.id, r.paper_id, r.total_questions, r.correct_count, r.wrong_count,
                r.total_score, r.duration_seconds, r.started_at, r.submitted_at,
                COALESCE(pt.title, pz.title) AS paper_title`,
      from: `FROM study_records r
             LEFT JOIN paper_translations pt ON pt.paper_id = r.paper_id AND pt.language_code = ?
             LEFT JOIN paper_translations pz ON pz.paper_id = r.paper_id AND pz.language_code = 'zh-CN'`,
      conditions: ['r.user_id = ?'],
      params: [language, id],
      orderBy: 'r.submitted_at DESC, r.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/students/:id/wrong-questions',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id, 'id');
    await assertStudent(id);
    const { page, pageSize } = pageParams(req.query);
    const language = lang(req);

    const conditions = ['w.user_id = ?'];
    const params = [language, language, id];
    if (req.query.resolved === '0' || req.query.resolved === '1') {
      conditions.push('w.resolved = ?');
      params.push(Number(req.query.resolved));
    }

    const data = await queryPage({
      columns: `w.id, w.wrong_count, w.resolved, w.last_wrong_at, q.id AS question_id,
                q.question_type, q.difficulty, qt.title, qt.analysis,
                ct.name AS category_name, lt.name AS level_name`,
      from: `FROM wrong_questions w
             JOIN questions q ON q.id = w.question_id
             JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
             JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?
             LEFT JOIN levels l ON l.id = q.level_id
             LEFT JOIN level_translations lt ON lt.level_id = l.id AND lt.language_code = 'zh-CN'`,
      conditions,
      params,
      orderBy: 'w.resolved ASC, w.last_wrong_at DESC, w.id DESC',
      page,
      pageSize
    });
    ok(res, data);
  })
);

export default router;
