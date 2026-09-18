import { pool } from '../../config/db.js';
import { aiConfig } from '../../config/ai.js';

/**
 * 智能体的业务工具集 —— 这是「定制化」的核心。
 *
 * 智能体不靠微调，而是靠这些工具实时读取本平台的真实数据（题库、错题、成绩、统计），
 * 因此回答里出现的题目、分数、数量都来自数据库，而不是模型编造。
 *
 * 约定：
 * - 所有 SQL 参数化；`lang` 由会话注入，三语内容一律走 `language_code = ?`。
 * - 每个工具声明 `scenes`，非授权场景不可调用（学员拿不到平台统计）。
 * - 返回值统一为可 JSON 序列化的对象，由 agent 截断后注入模型。
 */

const clampLimit = (value, fallback = 10, max = 50) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

/** 语言回落到中文，避免翻译表缺行时整条查询为空。 */
const safeLang = (lang) => (['zh-CN', 'en-US', 'ms-MY'].includes(lang) ? lang : 'zh-CN');

// ---------------------------------------------------------------- 学员工具

async function getMyProfile({ ctx }) {
  const [[user]] = await pool.execute(
    `SELECT u.username, u.name, u.nationality, u.language, u.student_no, u.created_at,
            COUNT(r.id) record_count,
            COALESCE(SUM(r.total_questions), 0) total_questions,
            COALESCE(SUM(r.correct_count), 0) correct_count,
            COALESCE(ROUND(AVG(r.total_score), 2), 0) avg_score,
            MAX(r.submitted_at) last_submitted_at
     FROM users u
     LEFT JOIN study_records r ON r.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id`,
    [ctx.userId]
  );
  if (!user) return { found: false };

  const [[wrong]] = await pool.execute(
    'SELECT COUNT(*) total, SUM(resolved = 0) unresolved FROM wrong_questions WHERE user_id = ?',
    [ctx.userId]
  );

  const accuracy = Number(user.total_questions)
    ? Math.round((Number(user.correct_count) / Number(user.total_questions)) * 1000) / 10
    : 0;

  return {
    found: true,
    username: user.username,
    name: user.name,
    nationality: user.nationality,
    preferred_language: user.language,
    student_no: user.student_no,
    practice_count: Number(user.record_count),
    total_questions: Number(user.total_questions),
    correct_count: Number(user.correct_count),
    accuracy_percent: accuracy,
    avg_score: Number(user.avg_score),
    last_practice_at: user.last_submitted_at,
    wrong_question_count: Number(wrong.total || 0),
    unresolved_wrong_count: Number(wrong.unresolved || 0)
  };
}

async function getMyWrongQuestions({ ctx, args }) {
  const limit = clampLimit(args.limit, 10);
  const lang = safeLang(ctx.lang);

  const [rows] = await pool.execute(
    `SELECT w.question_id, w.wrong_count, w.resolved, w.last_wrong_at,
            qt.title, qt.analysis, ct.name AS category_name, lt.name AS level_name,
            q.difficulty, q.question_type
     FROM wrong_questions w
     JOIN questions q ON q.id = w.question_id
     JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
     JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?
     JOIN level_translations lt ON lt.level_id = q.level_id AND lt.language_code = ?
     WHERE w.user_id = ?
     ORDER BY w.resolved ASC, w.wrong_count DESC, w.last_wrong_at DESC
     LIMIT ${limit}`,
    [lang, lang, lang, ctx.userId]
  );

  return {
    count: rows.length,
    questions: rows.map((row) => ({
      question_id: row.question_id,
      title: row.title,
      category: row.category_name,
      level: row.level_name,
      difficulty: row.difficulty,
      type: row.question_type,
      wrong_count: Number(row.wrong_count),
      resolved: Boolean(row.resolved),
      analysis: row.analysis || null,
      last_wrong_at: row.last_wrong_at
    }))
  };
}

async function getMyRecords({ ctx, args }) {
  const limit = clampLimit(args.limit, 5);
  const lang = safeLang(ctx.lang);

  const [rows] = await pool.execute(
    `SELECT r.id, r.total_questions, r.correct_count, r.wrong_count, r.total_score,
            r.duration_seconds, r.submitted_at, pt.title AS paper_title
     FROM study_records r
     LEFT JOIN paper_translations pt ON pt.paper_id = r.paper_id AND pt.language_code = ?
     WHERE r.user_id = ?
     ORDER BY r.submitted_at DESC
     LIMIT ${limit}`,
    [lang, ctx.userId]
  );

  return {
    count: rows.length,
    records: rows.map((row) => ({
      record_id: row.id,
      paper_title: row.paper_title,
      total_questions: Number(row.total_questions),
      correct_count: Number(row.correct_count),
      wrong_count: Number(row.wrong_count),
      total_score: Number(row.total_score),
      duration_seconds: Number(row.duration_seconds),
      submitted_at: row.submitted_at
    }))
  };
}

// ---------------------------------------------------------------- 通用工具

async function listPapers({ ctx, args }) {
  const lang = safeLang(ctx.lang);
  const conditions = [`p.status = 'published'`, 'pt.language_code = ?'];
  const params = [lang, lang];

  if (args.level_code) {
    conditions.push('l.code = ?');
    params.push(String(args.level_code));
  }
  if (args.paper_type) {
    conditions.push('p.paper_type = ?');
    params.push(String(args.paper_type));
  }

  const [rows] = await pool.execute(
    `SELECT p.id, p.paper_type, p.total_score, p.duration_minutes,
            pt.title, pt.description, lt.name AS level_name, l.code AS level_code,
            (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count
     FROM papers p
     JOIN paper_translations pt ON pt.paper_id = p.id AND pt.language_code = ?
     LEFT JOIN levels l ON l.id = p.level_id
     LEFT JOIN level_translations lt ON lt.level_id = p.level_id AND lt.language_code = ?
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.id DESC
     LIMIT 30`,
    params
  );

  return {
    count: rows.length,
    papers: rows.map((row) => ({
      paper_id: row.id,
      title: row.title,
      description: row.description,
      level: row.level_name,
      level_code: row.level_code,
      paper_type: row.paper_type,
      question_count: Number(row.question_count),
      total_score: Number(row.total_score),
      duration_minutes: Number(row.duration_minutes),
      practice_url: `/practice/${row.id}`
    }))
  };
}

async function getQuestionDetail({ ctx, args }) {
  const questionId = Number.parseInt(args.question_id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return { found: false, error: 'question_id must be a positive integer' };
  }
  const lang = safeLang(ctx.lang);

  const [[question]] = await pool.execute(
    `SELECT q.id, q.question_type, q.difficulty, q.score,
            qt.title, qt.content, qt.analysis, ct.name AS category_name, lt.name AS level_name
     FROM questions q
     JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
     JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?
     JOIN level_translations lt ON lt.level_id = q.level_id AND lt.language_code = ?
     WHERE q.id = ?`,
    [lang, lang, lang, questionId]
  );
  if (!question) return { found: false };

  const [options] = await pool.execute(
    `SELECT o.option_key, o.is_correct, ot.content
     FROM question_options o
     JOIN question_option_translations ot ON ot.option_id = o.id AND ot.language_code = ?
     WHERE o.question_id = ?
     ORDER BY o.sort_order, o.id`,
    [lang, questionId]
  );

  return {
    found: true,
    question_id: question.id,
    title: question.title,
    content: question.content,
    analysis: question.analysis,
    category: question.category_name,
    level: question.level_name,
    type: question.question_type,
    difficulty: question.difficulty,
    score: Number(question.score),
    options: options.map((option) => ({
      key: option.option_key,
      content: option.content,
      is_correct: Boolean(option.is_correct)
    }))
  };
}

// ---------------------------------------------------------------- 管理端工具

async function platformStats() {
  const [[users]] = await pool.execute(
    `SELECT COUNT(*) total,
            SUM(role = 'student') students,
            SUM(role = 'teacher') teachers,
            -- 后台角色有两个（超管 + 内容管理员），只数 admin 会漏报
            SUM(role IN ('admin', 'content_admin')) staff,
            SUM(status = 'active') active,
            SUM(last_active_at > NOW() - INTERVAL 5 MINUTE) online
     FROM users
     WHERE deleted_at IS NULL`
  );
  const [[questions]] = await pool.execute(
    `SELECT COUNT(*) total,
            SUM(status = 'published') published,
            SUM(difficulty = 'hard') hard
     FROM questions`
  );
  const [[papers]] = await pool.execute(
    `SELECT COUNT(*) total, SUM(status = 'published') published FROM papers`
  );
  const [[records]] = await pool.execute(
    `SELECT COUNT(*) total, COALESCE(ROUND(AVG(total_score), 2), 0) avg_score,
            COALESCE(SUM(total_questions), 0) answered
     FROM study_records`
  );
  const [[wrong]] = await pool.execute(
    'SELECT COUNT(*) total, SUM(resolved = 0) unresolved FROM wrong_questions'
  );

  return {
    users: {
      total: Number(users.total),
      students: Number(users.students),
      teachers: Number(users.teachers),
      staff: Number(users.staff),
      active: Number(users.active),
      online_now: Number(users.online)
    },
    questions: {
      total: Number(questions.total),
      published: Number(questions.published),
      hard: Number(questions.hard)
    },
    papers: { total: Number(papers.total), published: Number(papers.published) },
    study_records: {
      total: Number(records.total),
      answered_questions: Number(records.answered),
      avg_score: Number(records.avg_score)
    },
    wrong_questions: { total: Number(wrong.total), unresolved: Number(wrong.unresolved) }
  };
}

async function listStudents({ args }) {
  const limit = clampLimit(args.limit, 10);
  // 软删除的学员不出现在任何名单里
  const conditions = [`u.role = 'student'`, 'u.deleted_at IS NULL'];
  const params = [];

  if (args.keyword) {
    conditions.push('(u.username LIKE ? OR u.name LIKE ? OR u.student_no LIKE ?)');
    const keyword = `%${String(args.keyword).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(keyword, keyword, keyword);
  }
  if (args.status) {
    conditions.push('u.status = ?');
    params.push(String(args.status));
  }

  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.name, u.nationality, u.student_no, u.status,
            u.last_active_at, u.login_count,
            COUNT(r.id) AS record_count,
            COALESCE(ROUND(AVG(r.total_score), 2), 0) AS avg_score
     FROM users u
     LEFT JOIN study_records r ON r.user_id = u.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id
     ORDER BY u.id DESC
     LIMIT ${limit}`,
    params
  );

  return {
    count: rows.length,
    students: rows.map((row) => ({
      user_id: row.id,
      username: row.username,
      name: row.name,
      nationality: row.nationality,
      student_no: row.student_no,
      status: row.status,
      practice_count: Number(row.record_count),
      avg_score: Number(row.avg_score),
      last_active_at: row.last_active_at,
      login_count: Number(row.login_count)
    }))
  };
}

async function topWrongQuestions({ ctx, args }) {
  const limit = clampLimit(args.limit, 10);
  const lang = safeLang(ctx.lang);

  const [rows] = await pool.execute(
    `SELECT w.question_id, COUNT(DISTINCT w.user_id) AS student_count,
            SUM(w.wrong_count) AS total_wrong, SUM(w.resolved = 0) AS unresolved,
            qt.title, ct.name AS category_name, lt.name AS level_name, q.difficulty
     FROM wrong_questions w
     JOIN questions q ON q.id = w.question_id
     JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
     JOIN question_category_translations ct ON ct.category_id = q.category_id AND ct.language_code = ?
     JOIN level_translations lt ON lt.level_id = q.level_id AND lt.language_code = ?
     GROUP BY w.question_id, qt.title, ct.name, lt.name, q.difficulty
     ORDER BY total_wrong DESC
     LIMIT ${limit}`,
    [lang, lang, lang]
  );

  return {
    count: rows.length,
    questions: rows.map((row) => ({
      question_id: row.question_id,
      title: row.title,
      category: row.category_name,
      level: row.level_name,
      difficulty: row.difficulty,
      students_wrong: Number(row.student_count),
      total_wrong: Number(row.total_wrong),
      unresolved: Number(row.unresolved)
    }))
  };
}

// ---------------------------------------------------------------- 注册表

const ALL_TOOLS = [
  {
    name: 'get_my_profile',
    scenes: ['student'],
    description: '获取当前登录学员的个人档案与学习概况：国籍、练习次数、答题总数、正确率、平均分、错题数量。',
    parameters: { type: 'object', properties: {}, required: [] },
    run: getMyProfile
  },
  {
    name: 'get_my_wrong_questions',
    scenes: ['student'],
    description: '查询当前学员的错题列表，包含题目、分类、等级、错误次数与解析。当学员问「我有哪些错题」「我哪里薄弱」时使用。',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认 10，最大 50' } },
      required: []
    },
    run: getMyWrongQuestions
  },
  {
    name: 'get_my_records',
    scenes: ['student'],
    description: '查询当前学员最近的练习成绩记录。当学员问「我的成绩」「我上次考了多少」时使用。',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认 5，最大 50' } },
      required: []
    },
    run: getMyRecords
  },
  {
    name: 'list_papers',
    scenes: ['student', 'admin'],
    description: '列出平台上已发布的练习/试卷，可按等级代码（HSK1/HSK2/CAMPUS）或类型（practice/exam/daily）筛选。',
    parameters: {
      type: 'object',
      properties: {
        level_code: { type: 'string', description: '等级代码，例如 HSK1、HSK2、CAMPUS' },
        paper_type: { type: 'string', enum: ['practice', 'exam', 'daily'], description: '试卷类型' }
      },
      required: []
    },
    run: listPapers
  },
  {
    name: 'get_question_detail',
    scenes: ['student', 'admin'],
    description: '查询某道题的完整信息：题干、选项、正确答案与解析。当需要讲解具体题目时使用。',
    parameters: {
      type: 'object',
      properties: { question_id: { type: 'integer', description: '题目 ID' } },
      required: ['question_id']
    },
    run: getQuestionDetail
  },
  {
    name: 'platform_stats',
    scenes: ['admin'],
    description: '获取平台整体统计：用户数、在线人数、题目数、试卷数、答题记录数、平均分、错题数。',
    parameters: { type: 'object', properties: {}, required: [] },
    run: platformStats
  },
  {
    name: 'list_students',
    scenes: ['admin'],
    description: '检索学员列表，可按关键词（用户名/姓名/学号）或状态筛选，返回练习次数与平均分。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '匹配用户名、姓名或学号' },
        status: { type: 'string', enum: ['active', 'disabled'], description: '账号状态' },
        limit: { type: 'integer', description: '返回条数，默认 10，最大 50' }
      },
      required: []
    },
    run: listStudents
  },
  {
    name: 'top_wrong_questions',
    scenes: ['admin'],
    description: '查询全平台错误率最高的题目排行，用于发现普遍薄弱的知识点。',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认 10，最大 50' } },
      required: []
    },
    run: topWrongQuestions
  }
];

/** 指定场景可用的工具定义（Ollama `tools` 字段格式）。 */
export function toolDefinitions(scene) {
  return ALL_TOOLS.filter((tool) => tool.scenes.includes(scene)).map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters }
  }));
}

export function toolNames(scene) {
  return ALL_TOOLS.filter((tool) => tool.scenes.includes(scene)).map((tool) => tool.name);
}

/**
 * 执行工具。任何异常都转成结构化错误返回给模型，让它有机会自我纠正，
 * 而不是中断整轮对话。
 */
export async function runTool(name, args, ctx) {
  const tool = ALL_TOOLS.find((item) => item.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  if (!tool.scenes.includes(ctx.scene)) {
    return { error: `Tool ${name} is not available in the "${ctx.scene}" scene` };
  }

  try {
    const result = await tool.run({ ctx, args: args && typeof args === 'object' ? args : {} });
    return result;
  } catch (error) {
    return { error: `Tool ${name} failed: ${error.message}` };
  }
}

/** 注入模型前截断过大的工具结果，控制上下文占用。 */
export function truncateResult(result) {
  const text = JSON.stringify(result);
  if (text.length <= aiConfig.toolResultChars) return text;
  return `${text.slice(0, aiConfig.toolResultChars)}…(结果已截断)`;
}

/**
 * 关键词意图路由 —— 模型不支持工具调用或未收敛时的兜底。
 * 命中则直接执行对应工具，把真实数据作为上下文注入，再让模型总结。
 */
const INTENT_RULES = [
  { tool: 'get_my_wrong_questions', scenes: ['student'], pattern: /错题|错题本|做错|薄弱|不熟|wrong/i },
  { tool: 'get_my_records', scenes: ['student'], pattern: /成绩|分数|考了|记录|得分|score|markah/i },
  { tool: 'get_my_profile', scenes: ['student'], pattern: /我的(资料|档案|情况|水平|进度)|正确率|概况|profile|profil/i },
  { tool: 'platform_stats', scenes: ['admin'], pattern: /统计|多少(个|名)?(学生|用户|人)|平台(情况|数据)|概览|总览|stats|statistik/i },
  { tool: 'top_wrong_questions', scenes: ['admin'], pattern: /高频错题|错误率|最难|易错|排行|top\s*wrong/i },
  { tool: 'list_students', scenes: ['admin'], pattern: /学员(列表|名单)|学生(列表|名单)|查(学员|学生)|students?\s*list/i },
  { tool: 'list_papers', scenes: ['student', 'admin'], pattern: /试卷|练习(列表|有哪些)|有哪些(题|练习)|paper|latihan/i }
];

export function routeIntent(text, scene) {
  const content = String(text || '');
  for (const rule of INTENT_RULES) {
    if (rule.scenes.includes(scene) && rule.pattern.test(content)) return rule.tool;
  }
  return null;
}
