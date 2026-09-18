/**
 * 003_public_module — 公共模块（账号与系统类表）重设计。
 *
 * 背景：账号与系统类表是两端共用的地基，本轮新增了「教师」与「内容管理员」
 * 两种角色，并发现删除用户会连带清空其全部学习数据。趁数据量还小一次理清。
 *
 * 六项改动：
 *  1. users.role 扩为四值，承载双端角色。
 *  2. users.deleted_at 软删除 —— **本轮最高危缺陷**：users 上的外键全是
 *     ON DELETE CASCADE，删一个学员会连删 study_records / wrong_questions /
 *     favorite_questions / ai_sessions(+ai_messages) / password_resets，
 *     误删不可恢复。改为软删除后这些数据仍在，可人工恢复。
 *     （username 的 UNIQUE 约束保持不变：软删后用户名不释放，这是有意的 ——
 *     释放会让人冒用已注销学员的账号。）
 *  3. ai_call_logs.scene 与 ai_sessions.scene 对齐成 ENUM，同一语义不再两种类型。
 *  4. study_records 补 (user_id, submitted_at)：学员成绩页与教师查看页的主查询
 *     是「按人取、按时间倒序」，只有外键的单列索引时必须 filesort。
 *  5. wrong_questions 补 (user_id, resolved, last_wrong_at)：错题本固定按
 *     「未解决优先 + 最近错优先」排序。
 *  6. users.language 保持 VARCHAR：改成 ENUM 会与 system_settings 和 i18n 的
 *     既有取值耦合，收益不抵风险；改为在 schema 注释里写明合法值。
 *
 * 全部幂等，可重复执行；不 DROP 任何列或表，存量数据一律保留。
 */

const addColumnIfMissing = async (conn, table, column, definition) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].count > 0) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
};

const addIndexIfMissing = async (conn, table, index, definition) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  if (rows[0].count > 0) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` ${definition}`);
  return true;
};

/**
 * 幂等改类型。
 *
 * 比较只用**类型部分**：`information_schema.COLUMN_TYPE` 存的就只是类型
 * （形如 `enum('student','teacher')`，小写、不含 NOT NULL / DEFAULT），
 * 拿带属性的完整定义去比会永远不等，于是每次启动都重跑一遍 DDL。
 * 属性部分（是否可空、默认值）单独比。
 */
const setColumnType = async (conn, table, column, typeDef, attrs, changed, label) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE type, IS_NULLABLE nullable, COLUMN_DEFAULT def
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows.length) return;                   // 表或列不存在，交给 schema.sql

  const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const expectNullable = /NOT NULL/i.test(attrs) ? 'NO' : 'YES';
  const expectDefault = /DEFAULT\s+NULL/i.test(attrs) ? null : (attrs.match(/DEFAULT\s+('([^']*)'|\S+)/i)?.[2] ?? null);

  const same = norm(rows[0].type) === norm(typeDef)
    && rows[0].nullable === expectNullable
    && (rows[0].def ?? null) === expectDefault;
  if (same) return;

  await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${typeDef} ${attrs}`.trim());
  changed.push(label);
};

// ENUM 取值顺序 = 权限从低到高：先用户端（学员、教师），再管理端（内容管理员、超管）。
// 只增不删：存量行落在 student/admin 上，两种取值都还在，数据不会受影响。
const ROLE_ENUM = "ENUM('student','teacher','admin','content_admin')";
const ROLE_ATTRS = "NOT NULL DEFAULT 'student'";

export default {
  id: '003_public_module',
  description: 'redesign account/system tables: staff roles, soft delete, aligned scene enum, hot-path indexes',

  async up(conn) {
    const changed = [];

    // 1. 角色扩为四值
    await setColumnType(conn, 'users', 'role', ROLE_ENUM, ROLE_ATTRS, changed, 'users.role -> 4 roles');

    // 2. 软删除
    if (await addColumnIfMissing(conn, 'users', 'deleted_at', 'DATETIME NULL DEFAULT NULL')) {
      changed.push('users.deleted_at');
    }
    if (await addIndexIfMissing(conn, 'users', 'idx_users_deleted', '(deleted_at)')) {
      changed.push('idx_users_deleted');
    }

    // 3. 场景类型对齐（ai_sessions.scene 是 ENUM('student','admin')，日志表却用 VARCHAR）
    await setColumnType(conn, 'ai_call_logs', 'scene', "ENUM('student','admin')", 'NULL DEFAULT NULL', changed, 'ai_call_logs.scene -> ENUM');

    // 4/5. 热路径索引
    if (await addIndexIfMissing(conn, 'study_records', 'idx_study_records_user_time', '(user_id, submitted_at)')) {
      changed.push('idx_study_records_user_time');
    }
    if (await addIndexIfMissing(conn, 'wrong_questions', 'idx_wrong_questions_user_state', '(user_id, resolved, last_wrong_at)')) {
      changed.push('idx_wrong_questions_user_state');
    }

    return changed;
  }
};
