import { Router } from 'express';
import { pool, tx } from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage } from '../utils/paginate.js';

const router = Router();

function lang(req) {
  return req.query.lang || req.body.language || 'zh-CN';
}

async function getQuestionsByPaper(paperId, language) {
  const [rows] = await pool.execute(
    `SELECT q.id, q.question_type, q.difficulty, pq.score, qt.title, qt.content, qt.analysis,
            l.code level_code, lt.name level_name, c.code category_code, ct.name category_name
     FROM paper_questions pq
     JOIN questions q ON q.id = pq.question_id
     JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
     JOIN levels l ON l.id = q.level_id
     JOIN level_translations lt ON lt.level_id = l.id AND lt.language_code = ?
     JOIN question_categories c ON c.id = q.category_id
     JOIN question_category_translations ct ON ct.category_id = c.id AND ct.language_code = ?
     WHERE pq.paper_id = ? AND q.status = 'published'
     ORDER BY pq.sort_order ASC`,
    [language, language, language, paperId]
  );
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [options] = await pool.query(
    `SELECT o.id, o.question_id, o.option_key, ot.content
     FROM question_options o
     JOIN question_option_translations ot ON ot.option_id = o.id AND ot.language_code = ?
     WHERE o.question_id IN (?)
     ORDER BY o.question_id, o.sort_order`,
    [language, ids]
  );
  return rows.map((question) => ({
    ...question,
    options: options.filter((option) => option.question_id === question.id).map(({ question_id, ...option }) => option)
  }));
}

router.get('/levels', asyncHandler(async (req, res) => {
  const language = lang(req);
  const [rows] = await pool.execute(
    `SELECT l.id, l.code, lt.name, lt.description
     FROM levels l
     JOIN level_translations lt ON lt.level_id = l.id AND lt.language_code = ?
     WHERE l.status = 'active'
     ORDER BY l.sort_order`,
    [language]
  );
  ok(res, rows);
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const language = lang(req);
  const [rows] = await pool.execute(
    `SELECT c.id, c.code, ct.name, ct.description
     FROM question_categories c
     JOIN question_category_translations ct ON ct.category_id = c.id AND ct.language_code = ?
     WHERE c.status = 'active'
     ORDER BY c.sort_order`,
    [language]
  );
  ok(res, rows);
}));

router.get('/papers', asyncHandler(async (req, res) => {
  const language = lang(req);
  const { page, pageSize } = pageParams(req.query);
  // 题数改用相关子查询：queryPage 的 COUNT(*) 不能带 GROUP BY，否则 total 会变成分组数
  const data = await queryPage({
    columns: `p.id, p.paper_type, p.total_score, p.duration_minutes, pt.title, pt.description, lt.name level_name,
              (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) question_count`,
    from: `FROM papers p
           JOIN paper_translations pt ON pt.paper_id = p.id AND pt.language_code = ?
           LEFT JOIN level_translations lt ON lt.level_id = p.level_id AND lt.language_code = ?`,
    conditions: ["p.status = 'published'"],
    params: [language, language],
    orderBy: 'p.id DESC',
    page,
    pageSize
  });
  ok(res, data);
}));

router.get('/papers/:id', auth(), asyncHandler(async (req, res) => {
  const language = lang(req);
  const paperId = Number(req.params.id);
  const [[paper]] = await pool.execute(
    `SELECT p.id, p.paper_type, p.total_score, p.duration_minutes, pt.title, pt.description
     FROM papers p
     JOIN paper_translations pt ON pt.paper_id = p.id AND pt.language_code = ?
     WHERE p.id = ? AND p.status = 'published'`,
    [language, paperId]
  );
  if (!paper) throw new HttpError(404, 'Paper not found');
  paper.questions = await getQuestionsByPaper(paperId, language);
  ok(res, paper);
}));

router.post('/papers/:id/submit', auth(), asyncHandler(async (req, res) => {
  const paperId = Number(req.params.id);
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const durationSeconds = Number(req.body.duration_seconds || 0);
  const result = await tx(async (conn) => {
    const [questions] = await conn.execute(
      `SELECT pq.question_id, pq.score, GROUP_CONCAT(o.id ORDER BY o.id) correct_option_ids
       FROM paper_questions pq
       JOIN question_options o ON o.question_id = pq.question_id AND o.is_correct = 1
       WHERE pq.paper_id = ?
       GROUP BY pq.question_id, pq.score`,
      [paperId]
    );
    if (!questions.length) throw new HttpError(404, 'Paper not found');
    const byQuestion = new Map(questions.map((q) => [Number(q.question_id), q]));
    let correctCount = 0;
    let totalScore = 0;
    const answerResults = [];

    for (const item of answers) {
      const questionId = Number(item.question_id);
      const question = byQuestion.get(questionId);
      if (!question) continue;
      const selectedIds = (item.selected_option_ids || []).map(Number).sort((a, b) => a - b);
      const correctIds = String(question.correct_option_ids).split(',').map(Number).sort((a, b) => a - b);
      const isCorrect = JSON.stringify(selectedIds) === JSON.stringify(correctIds);
      const score = isCorrect ? Number(question.score) : 0;
      if (isCorrect) correctCount += 1;
      totalScore += score;
      answerResults.push({ question_id: questionId, selected_option_ids: selectedIds, correct_option_ids: correctIds, is_correct: isCorrect, score });
    }

    const wrongCount = questions.length - correctCount;
    const [record] = await conn.execute(
      `INSERT INTO study_records (user_id, paper_id, total_questions, correct_count, wrong_count, total_score, duration_seconds, started_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND), NOW())`,
      [req.user.id, paperId, questions.length, correctCount, wrongCount, totalScore, durationSeconds, durationSeconds]
    );

    for (const item of answerResults) {
      await conn.execute(
        `INSERT INTO user_answers (user_id, question_id, paper_id, study_record_id, selected_option_ids, is_correct, score)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, item.question_id, paperId, record.insertId, item.selected_option_ids.join(','), item.is_correct ? 1 : 0, item.score]
      );
      if (!item.is_correct) {
        await conn.execute(
          `INSERT INTO wrong_questions (user_id, question_id, wrong_count, resolved, last_wrong_at)
           VALUES (?, ?, 1, 0, NOW())
           ON DUPLICATE KEY UPDATE wrong_count = wrong_count + 1, resolved = 0, last_wrong_at = NOW()`,
          [req.user.id, item.question_id]
        );
      } else {
        await conn.execute('UPDATE wrong_questions SET resolved = 1 WHERE user_id = ? AND question_id = ?', [req.user.id, item.question_id]);
      }
    }

    return {
      record_id: record.insertId,
      total_questions: questions.length,
      correct_count: correctCount,
      wrong_count: wrongCount,
      total_score: totalScore,
      answers: answerResults
    };
  });
  ok(res, result);
}));

router.get('/records', auth(), asyncHandler(async (req, res) => {
  const language = lang(req);
  const { page, pageSize } = pageParams(req.query);
  const data = await queryPage({
    columns: 'r.*, pt.title paper_title',
    from: `FROM study_records r
           LEFT JOIN paper_translations pt ON pt.paper_id = r.paper_id AND pt.language_code = ?`,
    conditions: ['r.user_id = ?'],
    params: [language, req.user.id],
    // id 兜底：同秒提交的两条若只按时间排，翻页时顺序不稳定会漏行或重行
    orderBy: 'r.submitted_at DESC, r.id DESC',
    page,
    pageSize
  });
  ok(res, data);
}));

router.get('/wrong-questions', auth(), asyncHandler(async (req, res) => {
  const language = lang(req);
  const { page, pageSize } = pageParams(req.query);
  const data = await queryPage({
    columns: `w.id, w.wrong_count, w.resolved, w.last_wrong_at, q.id question_id,
              qt.title, qt.analysis, ct.name category_name`,
    from: `FROM wrong_questions w
           JOIN questions q ON q.id = w.question_id
           JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
           JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?`,
    conditions: ['w.user_id = ?'],
    params: [language, language, req.user.id],
    orderBy: 'w.resolved ASC, w.last_wrong_at DESC, w.id DESC',
    page,
    pageSize
  });
  ok(res, data);
}));

export default router;
