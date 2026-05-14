import { Router } from 'express';
import { pool } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/role.js';
import { asyncHandler, ok } from '../utils/response.js';

const router = Router();
router.use(auth(), allow('admin'));

router.get('/stats', asyncHandler(async (_req, res) => {
  const [[users]] = await pool.execute(`SELECT COUNT(*) count FROM users WHERE role='student'`);
  const [[questions]] = await pool.execute(`SELECT COUNT(*) count FROM questions`);
  const [[papers]] = await pool.execute(`SELECT COUNT(*) count FROM papers`);
  const [[records]] = await pool.execute(`SELECT COUNT(*) count, COALESCE(AVG(total_score),0) avg_score FROM study_records`);
  ok(res, {
    students: users.count,
    questions: questions.count,
    papers: papers.count,
    records: records.count,
    avgScore: Number(records.avg_score).toFixed(1)
  });
}));

router.get('/users', asyncHandler(async (_req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, username, name, email, phone, role, student_no, nationality, language, status, created_at
     FROM users ORDER BY id DESC`
  );
  ok(res, rows);
}));

router.get('/questions', asyncHandler(async (req, res) => {
  const language = req.query.lang || 'zh-CN';
  const [rows] = await pool.execute(
    `SELECT q.id, qt.title, q.question_type, q.difficulty, q.score, q.status, lt.name level_name, ct.name category_name
     FROM questions q
     JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
     JOIN level_translations lt ON lt.level_id = q.level_id AND lt.language_code = ?
     JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?
     ORDER BY q.id DESC`,
    [language, language, language]
  );
  ok(res, rows);
}));

router.get('/papers', asyncHandler(async (req, res) => {
  const language = req.query.lang || 'zh-CN';
  const [rows] = await pool.execute(
    `SELECT p.id, pt.title, p.paper_type, p.total_score, p.duration_minutes, p.status, COUNT(pq.id) question_count
     FROM papers p
     JOIN paper_translations pt ON pt.paper_id = p.id AND pt.language_code = ?
     LEFT JOIN paper_questions pq ON pq.paper_id = p.id
     GROUP BY p.id, pt.title, p.paper_type, p.total_score, p.duration_minutes, p.status
     ORDER BY p.id DESC`,
    [language]
  );
  ok(res, rows);
}));

router.get('/records', asyncHandler(async (req, res) => {
  const language = req.query.lang || 'zh-CN';
  const [rows] = await pool.execute(
    `SELECT r.id, u.username, u.name, pt.title paper_title, r.total_questions, r.correct_count, r.wrong_count, r.total_score, r.submitted_at
     FROM study_records r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN paper_translations pt ON pt.paper_id = r.paper_id AND pt.language_code = ?
     ORDER BY r.submitted_at DESC`,
    [language]
  );
  ok(res, rows);
}));

export default router;
