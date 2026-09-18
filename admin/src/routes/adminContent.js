import { Router } from 'express';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { pageParams, queryPage, likeValue } from '../utils/paginate.js';
import {
  LANGUAGES,
  PRIMARY_LANGUAGE,
  normalizeLanguage,
  normalizeText,
  assertPrimaryTranslation,
  readTranslations,
  writeTranslations,
  translationJoin
} from '../utils/translations.js';

/**
 * 后台内容管理：等级 / 分类 / 题库 / 试卷。
 *
 * 全部列表接口都走 `queryPage`（先 COUNT 再取数），统一返回
 * `{ list, total, page, pageSize, totalPages }`。
 *
 * 挂载点：`/api/admin`（父路由已 `auth()` + `allow('admin')`）。
 */

const router = Router();

const SORTS = {
  questions: {
    id: 'q.id DESC',
    score: 'q.score DESC, q.id DESC',
    difficulty: 'FIELD(q.difficulty, "hard", "normal", "easy"), q.id DESC',
    updated: 'q.updated_at DESC, q.id DESC'
  },
  papers: {
    id: 'p.id DESC',
    score: 'p.total_score DESC, p.id DESC',
    updated: 'p.updated_at DESC, p.id DESC'
  },
  levels: { id: 'l.id ASC', sort: 'l.sort_order ASC, l.id ASC' },
  categories: { id: 'c.id ASC', sort: 'c.sort_order ASC, c.id ASC' }
};

function pickSort(table, key, fallback) {
  return SORTS[table][String(key || '')] || fallback;
}

/** `?lang=` 只影响列表展示语言，不改变任何落库内容。 */
function listLang(req) {
  return normalizeLanguage(req.query.lang, PRIMARY_LANGUAGE);
}

function assertEnum(value, allowed, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!allowed.includes(value)) throw new HttpError(400, `${label} 取值非法：${value}`);
  return value;
}

function toInt(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new HttpError(400, `${label} 必须是 ${min}~${max} 之间的整数`);
  }
  return num;
}

function toDecimal(value, label, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) throw new HttpError(400, `${label} 必须是非负数字`);
  return Math.round(num * 100) / 100;
}

const QUESTION_TYPES = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const CONTENT_STATUS = ['published', 'draft', 'disabled'];
const PAPER_TYPES = ['practice', 'exam', 'daily'];

/** 题目/试卷/等级/分类共用的三语字段表单校验。 */
function readTranslationPayload(body, fields, label) {
  const values = body?.translations;
  if (values === undefined) return null;
  if (!values || typeof values !== 'object') throw new HttpError(400, 'translations 必须是对象');
  assertPrimaryTranslation(values, fields, label);
  return values;
}

// ---------------------------------------------------------------- 等级

const LEVEL_FIELDS = ['name', 'description'];

router.get(
  '/levels',
  asyncHandler(async (req, res) => {
    const lang = listLang(req);
    const { page, pageSize } = pageParams(req.query);
    const t = translationJoin({ table: 'level_translations', foreignKey: 'level_id', alias: 'lt', primaryAlias: 'l', lang });

    const conditions = [];
    const filterParams = [];
    if (req.query.status) {
      conditions.push('l.status = ?');
      filterParams.push(assertEnum(req.query.status, ['active', 'disabled'], 'status'));
    }
    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push(`${t.pick('name')} LIKE ?`);
      filterParams.push(keyword);
    }

    const data = await queryPage({
      columns: `l.id, l.code, l.sort_order, l.status, l.created_at,
                ${t.pick('name')} AS name, ${t.pick('description')} AS description,
                (SELECT COUNT(*) FROM questions q WHERE q.level_id = l.id) AS question_count`,
      from: `FROM levels l ${t.sql}`,
      conditions,
      params: [...t.params, ...filterParams],
      orderBy: pickSort('levels', req.query.sort, SORTS.levels.sort),
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/levels/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[level]] = await pool.execute('SELECT id, code, sort_order, status FROM levels WHERE id = ?', [id]);
    if (!level) throw new HttpError(404, '等级不存在');
    level.translations = await readTranslations({
      table: 'level_translations', foreignKey: 'level_id', id, fields: LEVEL_FIELDS
    });
    ok(res, level);
  })
);

router.post(
  '/levels',
  asyncHandler(async (req, res) => {
    const code = normalizeText(req.body?.code);
    if (!code) throw new HttpError(400, 'code 不能为空');
    const translations = readTranslationPayload(req.body, LEVEL_FIELDS, '等级名称');

    const [[existing]] = await pool.execute('SELECT id FROM levels WHERE code = ?', [code]);
    if (existing) throw new HttpError(409, `等级编码 ${code} 已存在`);

    const id = await tx(async (conn) => {
      const [created] = await conn.execute(
        'INSERT INTO levels (code, sort_order, status) VALUES (?, ?, ?)',
        [code, toInt(req.body?.sortOrder ?? 0, 'sortOrder'), assertEnum(req.body?.status, ['active', 'disabled'], 'status') || 'active']
      );
      await writeTranslations({
        table: 'level_translations', foreignKey: 'level_id', id: created.insertId,
        fields: LEVEL_FIELDS, values: translations, runner: conn
      });
      return created.insertId;
    });
    ok(res, { id }, 'created');
  })
);

router.put(
  '/levels/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[level]] = await pool.execute('SELECT id FROM levels WHERE id = ?', [id]);
    if (!level) throw new HttpError(404, '等级不存在');

    const code = normalizeText(req.body?.code);
    if (code) {
      const [[clash]] = await pool.execute('SELECT id FROM levels WHERE code = ? AND id <> ?', [code, id]);
      if (clash) throw new HttpError(409, `等级编码 ${code} 已被占用`);
    }
    const translations = readTranslationPayload(req.body, LEVEL_FIELDS, '等级名称');

    await tx(async (conn) => {
      await conn.execute('UPDATE levels SET code = COALESCE(?, code), sort_order = COALESCE(?, sort_order), status = COALESCE(?, status) WHERE id = ?', [
        code,
        req.body?.sortOrder === undefined ? null : toInt(req.body.sortOrder, 'sortOrder'),
        assertEnum(req.body?.status, ['active', 'disabled'], 'status') ?? null,
        id
      ]);
      await writeTranslations({
        table: 'level_translations', foreignKey: 'level_id', id,
        fields: LEVEL_FIELDS, values: translations, runner: conn
      });
    });
    ok(res, null, 'updated');
  })
);

router.delete(
  '/levels/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[used]] = await pool.execute('SELECT COUNT(*) count FROM questions WHERE level_id = ?', [id]);
    if (used.count > 0) throw new HttpError(409, `该等级下还有 ${used.count} 道题目，请先转移或删除`);
    const [result] = await pool.execute('DELETE FROM levels WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, '等级不存在');
    ok(res, null, 'deleted');
  })
);

// ---------------------------------------------------------------- 分类

const CATEGORY_FIELDS = ['name', 'description'];

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const lang = listLang(req);
    const { page, pageSize } = pageParams(req.query);
    const t = translationJoin({
      table: 'question_category_translations', foreignKey: 'category_id', alias: 'ct', primaryAlias: 'c', lang
    });

    const conditions = [];
    const filterParams = [];
    if (req.query.status) {
      conditions.push('c.status = ?');
      filterParams.push(assertEnum(req.query.status, ['active', 'disabled'], 'status'));
    }
    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push(`${t.pick('name')} LIKE ?`);
      filterParams.push(keyword);
    }

    const data = await queryPage({
      columns: `c.id, c.parent_id, c.code, c.sort_order, c.status,
                ${t.pick('name')} AS name, ${t.pick('description')} AS description,
                (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id) AS question_count`,
      from: `FROM question_categories c ${t.sql}`,
      conditions,
      params: [...t.params, ...filterParams],
      orderBy: pickSort('categories', req.query.sort, SORTS.categories.sort),
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[category]] = await pool.execute(
      'SELECT id, parent_id, code, sort_order, status FROM question_categories WHERE id = ?', [id]
    );
    if (!category) throw new HttpError(404, '分类不存在');
    category.translations = await readTranslations({
      table: 'question_category_translations', foreignKey: 'category_id', id, fields: CATEGORY_FIELDS
    });
    ok(res, category);
  })
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const code = normalizeText(req.body?.code);
    if (!code) throw new HttpError(400, 'code 不能为空');
    const translations = readTranslationPayload(req.body, CATEGORY_FIELDS, '分类名称');

    const [[existing]] = await pool.execute('SELECT id FROM question_categories WHERE code = ?', [code]);
    if (existing) throw new HttpError(409, `分类编码 ${code} 已存在`);

    const parentId = req.body?.parentId ? toInt(req.body.parentId, 'parentId', { min: 1 }) : null;
    if (parentId) {
      const [[parent]] = await pool.execute('SELECT id FROM question_categories WHERE id = ?', [parentId]);
      if (!parent) throw new HttpError(400, '父级分类不存在');
    }

    const id = await tx(async (conn) => {
      const [created] = await conn.execute(
        'INSERT INTO question_categories (parent_id, code, sort_order, status) VALUES (?, ?, ?, ?)',
        [parentId, code, toInt(req.body?.sortOrder ?? 0, 'sortOrder'),
          assertEnum(req.body?.status, ['active', 'disabled'], 'status') || 'active']
      );
      await writeTranslations({
        table: 'question_category_translations', foreignKey: 'category_id', id: created.insertId,
        fields: CATEGORY_FIELDS, values: translations, runner: conn
      });
      return created.insertId;
    });
    ok(res, { id }, 'created');
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[category]] = await pool.execute('SELECT id FROM question_categories WHERE id = ?', [id]);
    if (!category) throw new HttpError(404, '分类不存在');

    const code = normalizeText(req.body?.code);
    if (code) {
      const [[clash]] = await pool.execute('SELECT id FROM question_categories WHERE code = ? AND id <> ?', [code, id]);
      if (clash) throw new HttpError(409, `分类编码 ${code} 已被占用`);
    }
    let parentId;
    if (req.body?.parentId !== undefined) {
      parentId = req.body.parentId ? toInt(req.body.parentId, 'parentId', { min: 1 }) : null;
      if (parentId === id) throw new HttpError(400, '父级分类不能是自己');
    }
    const translations = readTranslationPayload(req.body, CATEGORY_FIELDS, '分类名称');

    await tx(async (conn) => {
      await conn.execute(
        `UPDATE question_categories SET code = COALESCE(?, code), parent_id = ?,
                sort_order = COALESCE(?, sort_order), status = COALESCE(?, status)
         WHERE id = ?`,
        [
          code,
          parentId === undefined ? null : parentId,
          req.body?.sortOrder === undefined ? null : toInt(req.body.sortOrder, 'sortOrder'),
          assertEnum(req.body?.status, ['active', 'disabled'], 'status') ?? null,
          id
        ]
      );
      await writeTranslations({
        table: 'question_category_translations', foreignKey: 'category_id', id,
        fields: CATEGORY_FIELDS, values: translations, runner: conn
      });
    });
    ok(res, null, 'updated');
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[used]] = await pool.execute('SELECT COUNT(*) count FROM questions WHERE category_id = ?', [id]);
    if (used.count > 0) throw new HttpError(409, `该分类下还有 ${used.count} 道题目，请先转移或删除`);
    const [result] = await pool.execute('DELETE FROM question_categories WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, '分类不存在');
    ok(res, null, 'deleted');
  })
);

// ---------------------------------------------------------------- 题库

const QUESTION_FIELDS = ['title', 'content', 'analysis'];
const OPTION_FIELDS = ['content'];

/** 校验并规整题目表单（三语字段一并带上，落库时按语言 upsert）。 */
function readQuestionBody(body, { partial = false } = {}) {
  const payload = {};

  if (body?.levelId !== undefined) payload.level_id = toInt(body.levelId, 'levelId', { min: 1 });
  if (body?.categoryId !== undefined) payload.category_id = toInt(body.categoryId, 'categoryId', { min: 1 });
  if (body?.questionType !== undefined) payload.question_type = assertEnum(body.questionType, QUESTION_TYPES, 'questionType');
  if (body?.difficulty !== undefined) payload.difficulty = assertEnum(body.difficulty, DIFFICULTIES, 'difficulty');
  if (body?.status !== undefined) payload.status = assertEnum(body.status, CONTENT_STATUS, 'status');
  if (body?.score !== undefined) payload.score = toDecimal(body.score, 'score');

  if (!partial) {
    for (const required of ['level_id', 'category_id']) {
      if (payload[required] === undefined) throw new HttpError(400, `${required} 不能为空`);
    }
  }

  payload.translations = readTranslationPayload(body, QUESTION_FIELDS, '题目');
  if (!partial && !payload.translations) throw new HttpError(400, 'translations 不能为空');

  if (body?.options !== undefined) {
    if (!Array.isArray(body.options)) throw new HttpError(400, 'options 必须是数组');
    payload.options = body.options.map((option, index) => {
      const key = normalizeText(option?.optionKey) || String.fromCharCode(65 + index);
      if (!/^[A-Z0-9]{1,10}$/.test(key)) throw new HttpError(400, `选项 ${index + 1} 的 optionKey 非法`);
      return {
        option_key: key,
        is_correct: option?.isCorrect ? 1 : 0,
        sort_order: option?.sortOrder === undefined ? index : toInt(option.sortOrder, 'sortOrder'),
        translations: option?.translations || null
      };
    });

    const keys = payload.options.map((option) => option.option_key);
    if (new Set(keys).size !== keys.length) throw new HttpError(400, '选项 key 不能重复');
    if (payload.options.length && !payload.options.some((option) => option.is_correct)) {
      throw new HttpError(400, '至少要有一个正确选项');
    }
  } else if (!partial) {
    throw new HttpError(400, 'options 不能为空');
  }

  return payload;
}

/** 选项按 option_key 增量同步：保留未变选项的 id，避免 user_answers.selected_option_ids 变成悬空引用。 */
async function syncOptions(conn, questionId, options) {
  const [existing] = await conn.execute(
    'SELECT id, option_key FROM question_options WHERE question_id = ?', [questionId]
  );
  const existingByKey = new Map(existing.map((row) => [row.option_key, row.id]));
  const incomingKeys = new Set(options.map((option) => option.option_key));

  for (const option of options) {
    const currentId = existingByKey.get(option.option_key);
    let optionId = currentId;
    if (currentId) {
      await conn.execute(
        'UPDATE question_options SET is_correct = ?, sort_order = ? WHERE id = ?',
        [option.is_correct, option.sort_order, currentId]
      );
    } else {
      const [created] = await conn.execute(
        'INSERT INTO question_options (question_id, option_key, is_correct, sort_order) VALUES (?, ?, ?, ?)',
        [questionId, option.option_key, option.is_correct, option.sort_order]
      );
      optionId = created.insertId;
    }
    await writeTranslations({
      table: 'question_option_translations', foreignKey: 'option_id', id: optionId,
      fields: OPTION_FIELDS, values: option.translations, runner: conn
    });
  }

  const removed = existing.filter((row) => !incomingKeys.has(row.option_key)).map((row) => row.id);
  if (removed.length) {
    await conn.execute(
      `DELETE FROM question_options WHERE id IN (${removed.map(() => '?').join(', ')})`, removed
    );
  }
}

router.get(
  '/questions',
  asyncHandler(async (req, res) => {
    const lang = listLang(req);
    const { page, pageSize } = pageParams(req.query);
    const t = translationJoin({
      table: 'question_translations', foreignKey: 'question_id', alias: 'qt', primaryAlias: 'q', lang
    });
    const lt = translationJoin({
      table: 'level_translations', foreignKey: 'level_id', alias: 'lt', primaryAlias: 'q', lang
    });
    const ct = translationJoin({
      table: 'question_category_translations', foreignKey: 'category_id', alias: 'ct', primaryAlias: 'q', lang
    });

    const conditions = [];
    const filterParams = [];
    const push = (sql, ...values) => {
      conditions.push(sql);
      filterParams.push(...values);
    };

    const keyword = likeValue(req.query.keyword);
    if (keyword) push(`(${t.pick('title')} LIKE ? OR ${t.pick('content')} LIKE ?)`, keyword, keyword);
    if (req.query.levelId) push('q.level_id = ?', toInt(req.query.levelId, 'levelId', { min: 1 }));
    if (req.query.categoryId) push('q.category_id = ?', toInt(req.query.categoryId, 'categoryId', { min: 1 }));
    if (req.query.questionType) push('q.question_type = ?', assertEnum(req.query.questionType, QUESTION_TYPES, 'questionType'));
    if (req.query.difficulty) push('q.difficulty = ?', assertEnum(req.query.difficulty, DIFFICULTIES, 'difficulty'));
    if (req.query.status) push('q.status = ?', assertEnum(req.query.status, CONTENT_STATUS, 'status'));

    const data = await queryPage({
      columns: `q.id, q.level_id, q.category_id, q.question_type, q.difficulty, q.score, q.status,
                q.created_at, q.updated_at,
                ${t.pick('title')} AS title,
                ${lt.pick('name')} AS level_name,
                ${ct.pick('name')} AS category_name,
                (SELECT COUNT(*) FROM question_options qo WHERE qo.question_id = q.id) AS option_count`,
      from: `FROM questions q ${t.sql} ${lt.sql} ${ct.sql}`,
      conditions,
      params: [...t.params, ...lt.params, ...ct.params, ...filterParams],
      orderBy: pickSort('questions', req.query.sort, SORTS.questions.id),
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[question]] = await pool.execute(
      `SELECT id, level_id, category_id, question_type, difficulty, score, audio_url, image_url, status, created_at, updated_at
       FROM questions WHERE id = ?`,
      [id]
    );
    if (!question) throw new HttpError(404, '题目不存在');

    question.translations = await readTranslations({
      table: 'question_translations', foreignKey: 'question_id', id, fields: QUESTION_FIELDS
    });

    const [options] = await pool.execute(
      'SELECT id, option_key, is_correct, sort_order FROM question_options WHERE question_id = ? ORDER BY sort_order, id',
      [id]
    );
    for (const option of options) {
      option.translations = await readTranslations({
        table: 'question_option_translations', foreignKey: 'option_id', id: option.id, fields: OPTION_FIELDS
      });
      option.is_correct = Boolean(option.is_correct);
    }
    question.options = options;
    ok(res, question);
  })
);

router.post(
  '/questions',
  asyncHandler(async (req, res) => {
    const payload = readQuestionBody(req.body);
    // 校验外键，避免 500 变成一句看不懂的 SQL 报错
    for (const [column, label] of [['level_id', '等级'], ['category_id', '分类']]) {
      const table = column === 'level_id' ? 'levels' : 'question_categories';
      const [[row]] = await pool.execute(`SELECT id FROM ${table} WHERE id = ?`, [payload[column]]);
      if (!row) throw new HttpError(400, `${label}不存在`);
    }

    const id = await tx(async (conn) => {
      const [created] = await conn.execute(
        `INSERT INTO questions (level_id, category_id, question_type, difficulty, score, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.level_id,
          payload.category_id,
          payload.question_type || 'single_choice',
          payload.difficulty || 'easy',
          payload.score ?? 1,
          payload.status || 'published',
          req.user.id
        ]
      );
      await writeTranslations({
        table: 'question_translations', foreignKey: 'question_id', id: created.insertId,
        fields: QUESTION_FIELDS, values: payload.translations, runner: conn
      });
      await syncOptions(conn, created.insertId, payload.options);
      return created.insertId;
    });
    ok(res, { id }, 'created');
  })
);

router.put(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[question]] = await pool.execute('SELECT id FROM questions WHERE id = ?', [id]);
    if (!question) throw new HttpError(404, '题目不存在');

    const payload = readQuestionBody(req.body, { partial: true });

    await tx(async (conn) => {
      await conn.execute(
        `UPDATE questions SET level_id = COALESCE(?, level_id), category_id = COALESCE(?, category_id),
                question_type = COALESCE(?, question_type), difficulty = COALESCE(?, difficulty),
                score = COALESCE(?, score), status = COALESCE(?, status)
         WHERE id = ?`,
        [
          payload.level_id ?? null, payload.category_id ?? null, payload.question_type ?? null,
          payload.difficulty ?? null, payload.score ?? null, payload.status ?? null, id
        ]
      );
      await writeTranslations({
        table: 'question_translations', foreignKey: 'question_id', id,
        fields: QUESTION_FIELDS, values: payload.translations, runner: conn
      });
      if (payload.options) await syncOptions(conn, id, payload.options);
    });
    ok(res, null, 'updated');
  })
);

router.delete(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    // paper_questions / question_options / translations 都是 ON DELETE CASCADE
    const [result] = await pool.execute('DELETE FROM questions WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, '题目不存在');
    ok(res, null, 'deleted');
  })
);

// ---------------------------------------------------------------- 试卷

const PAPER_FIELDS = ['title', 'description'];

router.get(
  '/papers',
  asyncHandler(async (req, res) => {
    const lang = listLang(req);
    const { page, pageSize } = pageParams(req.query);
    const t = translationJoin({
      table: 'paper_translations', foreignKey: 'paper_id', alias: 'pt', primaryAlias: 'p', lang
    });
    const lt = translationJoin({
      table: 'level_translations', foreignKey: 'level_id', alias: 'lt', primaryAlias: 'p', lang
    });

    const conditions = [];
    const filterParams = [];
    const keyword = likeValue(req.query.keyword);
    if (keyword) {
      conditions.push(`${t.pick('title')} LIKE ?`);
      filterParams.push(keyword);
    }
    if (req.query.paperType) {
      conditions.push('p.paper_type = ?');
      filterParams.push(assertEnum(req.query.paperType, PAPER_TYPES, 'paperType'));
    }
    if (req.query.status) {
      conditions.push('p.status = ?');
      filterParams.push(assertEnum(req.query.status, CONTENT_STATUS, 'status'));
    }
    if (req.query.levelId) {
      conditions.push('p.level_id = ?');
      filterParams.push(toInt(req.query.levelId, 'levelId', { min: 1 }));
    }

    const data = await queryPage({
      columns: `p.id, p.paper_type, p.level_id, p.total_score, p.duration_minutes, p.status, p.created_at, p.updated_at,
                ${t.pick('title')} AS title, ${t.pick('description')} AS description,
                ${lt.pick('name')} AS level_name,
                (SELECT COUNT(*) FROM paper_questions pq WHERE pq.paper_id = p.id) AS question_count,
                (SELECT COUNT(*) FROM study_records r WHERE r.paper_id = p.id) AS record_count`,
      from: `FROM papers p ${t.sql} ${lt.sql}`,
      conditions,
      params: [...t.params, ...lt.params, ...filterParams],
      orderBy: pickSort('papers', req.query.sort, SORTS.papers.id),
      page,
      pageSize
    });
    ok(res, data);
  })
);

router.get(
  '/papers/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[paper]] = await pool.execute(
      'SELECT id, paper_type, level_id, total_score, duration_minutes, status, created_at, updated_at FROM papers WHERE id = ?',
      [id]
    );
    if (!paper) throw new HttpError(404, '试卷不存在');

    paper.translations = await readTranslations({
      table: 'paper_translations', foreignKey: 'paper_id', id, fields: PAPER_FIELDS
    });

    // 题目列表**故意不分页**：这是组卷编辑器的输入，而 PUT /papers/:id/questions
    // 是「整体替换」。只给一页的话，保存时会把没显示出来的题目全部删掉 —— 那是数据丢失，
    // 不是少看几条。列表页 /papers 已分页，这里面试卷最多几十题，可控。
    const lang = listLang(req);
    const [questions] = await pool.execute(
      `SELECT pq.id, pq.question_id, pq.sort_order, pq.score,
              COALESCE(qt.title, qz.title) AS title, q.question_type, q.difficulty
       FROM paper_questions pq
       JOIN questions q ON q.id = pq.question_id
       LEFT JOIN question_translations qt ON qt.question_id = q.id AND qt.language_code = ?
       LEFT JOIN question_translations qz ON qz.question_id = q.id AND qz.language_code = ?
       WHERE pq.paper_id = ? ORDER BY pq.sort_order, pq.id`,
      [lang, PRIMARY_LANGUAGE, id]
    );
    paper.questions = questions;
    ok(res, paper);
  })
);

/** 组卷：整体替换 paper_questions，按数组顺序写 sort_order。 */
async function replacePaperQuestions(conn, paperId, questions) {
  if (!Array.isArray(questions)) throw new HttpError(400, 'questions 必须是数组');

  await conn.execute('DELETE FROM paper_questions WHERE paper_id = ?', [paperId]);
  if (!questions.length) return;

  const ids = questions.map((item) => toInt(item?.questionId ?? item?.id, 'questionId', { min: 1 }));
  const [found] = await conn.execute(
    `SELECT id FROM questions WHERE id IN (${ids.map(() => '?').join(', ')})`, ids
  );
  const foundIds = new Set(found.map((row) => row.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length) throw new HttpError(400, `题目不存在：${missing.join(', ')}`);

  let total = 0;
  for (const [index, item] of questions.entries()) {
    const score = toDecimal(item?.score, 'score', 1);
    total += score;
    await conn.execute(
      'INSERT INTO paper_questions (paper_id, question_id, sort_order, score) VALUES (?, ?, ?, ?)',
      [paperId, ids[index], item?.sortOrder === undefined ? index : toInt(item.sortOrder, 'sortOrder'), score]
    );
  }
  await conn.execute('UPDATE papers SET total_score = ? WHERE id = ?', [Math.round(total * 100) / 100, paperId]);
}

router.post(
  '/papers',
  asyncHandler(async (req, res) => {
    const translations = readTranslationPayload(req.body, PAPER_FIELDS, '试卷标题');
    if (!translations) throw new HttpError(400, 'translations 不能为空');

    const levelId = req.body?.levelId ? toInt(req.body.levelId, 'levelId', { min: 1 }) : null;
    const id = await tx(async (conn) => {
      const [created] = await conn.execute(
        'INSERT INTO papers (paper_type, level_id, total_score, duration_minutes, status) VALUES (?, ?, ?, ?, ?)',
        [
          assertEnum(req.body?.paperType, PAPER_TYPES, 'paperType') || 'practice',
          levelId,
          toDecimal(req.body?.totalScore, 'totalScore'),
          toInt(req.body?.durationMinutes ?? 0, 'durationMinutes'),
          assertEnum(req.body?.status, CONTENT_STATUS, 'status') || 'published'
        ]
      );
      await writeTranslations({
        table: 'paper_translations', foreignKey: 'paper_id', id: created.insertId,
        fields: PAPER_FIELDS, values: translations, runner: conn
      });
      if (req.body?.questions !== undefined) await replacePaperQuestions(conn, created.insertId, req.body.questions);
      return created.insertId;
    });
    ok(res, { id }, 'created');
  })
);

router.put(
  '/papers/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[paper]] = await pool.execute('SELECT id FROM papers WHERE id = ?', [id]);
    if (!paper) throw new HttpError(404, '试卷不存在');

    const translations = readTranslationPayload(req.body, PAPER_FIELDS, '试卷标题');
    const levelId = req.body?.levelId === undefined
      ? undefined
      : (req.body.levelId ? toInt(req.body.levelId, 'levelId', { min: 1 }) : null);

    await tx(async (conn) => {
      await conn.execute(
        `UPDATE papers SET paper_type = COALESCE(?, paper_type), level_id = ?, total_score = COALESCE(?, total_score),
                duration_minutes = COALESCE(?, duration_minutes), status = COALESCE(?, status)
         WHERE id = ?`,
        [
          assertEnum(req.body?.paperType, PAPER_TYPES, 'paperType') ?? null,
          levelId === undefined ? null : levelId,
          req.body?.totalScore === undefined ? null : toDecimal(req.body.totalScore, 'totalScore'),
          req.body?.durationMinutes === undefined ? null : toInt(req.body.durationMinutes, 'durationMinutes'),
          assertEnum(req.body?.status, CONTENT_STATUS, 'status') ?? null,
          id
        ]
      );
      await writeTranslations({
        table: 'paper_translations', foreignKey: 'paper_id', id, fields: PAPER_FIELDS, values: translations, runner: conn
      });
      if (req.body?.questions !== undefined) await replacePaperQuestions(conn, id, req.body.questions);
    });
    ok(res, null, 'updated');
  })
);

router.put(
  '/papers/:id/questions',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[paper]] = await pool.execute('SELECT id FROM papers WHERE id = ?', [id]);
    if (!paper) throw new HttpError(404, '试卷不存在');
    await tx((conn) => replacePaperQuestions(conn, id, req.body?.questions));
    ok(res, null, 'updated');
  })
);

router.delete(
  '/papers/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [[used]] = await pool.execute('SELECT COUNT(*) count FROM study_records WHERE paper_id = ?', [id]);
    if (used.count > 0) throw new HttpError(409, `已有 ${used.count} 条成绩记录引用该试卷，不能删除`);
    const [result] = await pool.execute('DELETE FROM papers WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, '试卷不存在');
    ok(res, null, 'deleted');
  })
);

export default router;
