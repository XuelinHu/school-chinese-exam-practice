import { pool } from '../config/db.js';
import { HttpError } from './errors.js';

/**
 * 三语内容读写。
 *
 * 翻译表都有 `(外键, language_code)` 唯一键，因此统一走 `INSERT ... ON DUPLICATE KEY UPDATE`。
 *
 * **约定：编辑题目/试卷/等级/分类时必须保留三语字段。** 后台表单按语言分 Tab 提交，
 * 这里只更新请求里真正带了内容的语言；某个语言整体为空则原样保留，
 * 避免"管理员只改中文，英文和马来文被清空"。
 */

export const LANGUAGES = ['zh-CN', 'en-US', 'ms-MY'];
export const PRIMARY_LANGUAGE = 'zh-CN';

export function normalizeLanguage(value, fallback = PRIMARY_LANGUAGE) {
  return LANGUAGES.includes(value) ? value : fallback;
}

/** 读取一条记录的全部语言，返回 `{ 'zh-CN': { name, description }, ... }`。 */
export async function readTranslations({ table, foreignKey, id, fields, runner = pool }) {
  const [rows] = await runner.execute(
    `SELECT language_code, ${fields.join(', ')} FROM ${table} WHERE ${foreignKey} = ?`,
    [id]
  );
  const result = {};
  for (const row of rows) {
    result[row.language_code] = Object.fromEntries(fields.map((field) => [field, row[field]]));
  }
  return result;
}

/** 判断这个语言分支是否值得写库（全空视为"没填"，跳过）。 */
function hasContent(fields, payload) {
  return fields.some((field) => {
    const value = payload?.[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

/**
 * 按语言 upsert 译文。
 *
 * @param {object} options
 * @param {object} options.values `{ 'zh-CN': { name: '...' }, 'en-US': {...} }`；缺省的语言不动
 * @param {object} [options.runner] 事务连接，缺省用连接池
 */
export async function writeTranslations({ table, foreignKey, id, fields, values, runner = pool }) {
  if (!values || typeof values !== 'object') return;

  const updates = fields.map((field) => `${field} = VALUES(${field})`).join(', ');
  const columns = [foreignKey, 'language_code', ...fields];

  for (const [language, payload] of Object.entries(values)) {
    if (!LANGUAGES.includes(language) || !payload || typeof payload !== 'object') continue;
    if (!hasContent(fields, payload)) continue;

    await runner.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${updates}`,
      [id, language, ...fields.map((field) => normalizeText(payload[field]))]
    );
  }
}

export function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** 新建记录时主语言必须有内容，否则列表页会因为 JOIN 不上而看不到它。 */
export function assertPrimaryTranslation(values, fields, label = '中文') {
  if (!hasContent(fields, values?.[PRIMARY_LANGUAGE])) {
    throw new HttpError(400, `${label}内容不能为空（至少填写主语言字段）`);
  }
}

/**
 * 列表页展示用的 JOIN 片段：当前语言优先，缺失时回落中文。
 *
 * 用 LEFT JOIN 而非 JOIN —— 否则只填了中文的记录在英文界面的后台里会凭空消失。
 *
 * @returns {{ sql: string, params: any[] }} 供 `queryPage` 的 from/params 使用，
 *   `?` 参数必须排在条件参数之前（from 在 where 前面）。
 */
export function translationJoin({ table, foreignKey, alias, primaryAlias, lang }) {
  const parent = `${primaryAlias}.id`;
  return {
    sql: `LEFT JOIN ${table} ${alias} ON ${alias}.${foreignKey} = ${parent} AND ${alias}.language_code = ?
          LEFT JOIN ${table} ${alias}z ON ${alias}z.${foreignKey} = ${parent} AND ${alias}z.language_code = '${PRIMARY_LANGUAGE}'`,
    params: [lang],
    /** 供 SELECT / WHERE / ORDER BY 使用的取值表达式：当前语言优先，回落中文。 */
    pick: (field) => `COALESCE(${alias}.${field}, ${alias}z.${field})`
  };
}
