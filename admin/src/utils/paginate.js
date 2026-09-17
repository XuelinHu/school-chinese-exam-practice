import { pool } from '../config/db.js';

const MAX_PAGE_SIZE = 100;

/**
 * 解析并钳制分页参数。
 *
 * 注意：LIMIT/OFFSET 不能走 `pool.execute` 的 `?` 占位 —— mysql2 的预处理语句
 * 会抛 `Incorrect arguments to mysqld_stmt_execute`。因此这里返回的 pageSize/offset
 * 只允许是 Number.isInteger 校验并钳制过的值，由调用方直接内联进 SQL。
 */
export function pageParams(query = {}, { defaultSize = 10, maxSize = MAX_PAGE_SIZE } = {}) {
  const limit = Math.min(Math.max(Number(maxSize) || MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const rawPage = Number.parseInt(query.page, 10);
  const rawSize = Number.parseInt(query.pageSize ?? query.page_size, 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, limit) : defaultSize;

  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** 统一的分页响应体。 */
export function paged(list, total, page, pageSize) {
  const count = Number(total) || 0;
  const size = Number(pageSize) || 1;
  return {
    list: list || [],
    total: count,
    page: Number(page) || 1,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(count / size))
  };
}

/**
 * 构造 `WHERE ...` 子句。conditions 只允许来自服务端硬编码的白名单片段，
 * 值一律通过 params 以 `?` 传入。
 */
export function whereClause(conditions = []) {
  const active = conditions.filter(Boolean);
  return active.length ? `WHERE ${active.join(' AND ')}` : '';
}

/**
 * 分页查询：先 COUNT 再取数。
 *
 * `from` 里不要带 GROUP BY（会让 COUNT 失真）；需要聚合列时用相关子查询写在 columns 中。
 *
 * @param {object} options
 * @param {string} options.columns   SELECT 后的列清单
 * @param {string} options.from      `FROM ... JOIN ...`
 * @param {string[]} [options.conditions] 白名单条件片段（不含 WHERE 关键字）
 * @param {any[]} [options.params]   与 conditions 中的 `?` 一一对应
 * @param {string} [options.orderBy] 服务端白名单排序片段
 * @param {number} options.page
 * @param {number} options.pageSize
 */
export async function queryPage({ columns, from, conditions = [], params = [], orderBy = '', page = 1, pageSize = 10 }) {
  const where = whereClause(conditions);

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total ${from} ${where}`, params);

  const limit = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, MAX_PAGE_SIZE) : 10;
  const offset = Number.isInteger(page) && page > 0 ? (page - 1) * limit : 0;
  const order = orderBy ? `ORDER BY ${orderBy}` : '';

  const [rows] = await pool.execute(
    `SELECT ${columns} ${from} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return paged(rows, total, page, limit);
}

/** `LIKE` 参数值，转义用户输入中的通配符，避免 `%` 被当成模式。 */
export function likeValue(keyword) {
  const text = String(keyword ?? '').trim();
  if (!text) return null;
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
