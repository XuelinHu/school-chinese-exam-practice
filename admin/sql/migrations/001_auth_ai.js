/**
 * 001_auth_ai — 公共服务（头像/登录态/找回密码）与智能体（会话/消息/调用日志/系统设置）。
 *
 * 用 JS 而非纯 SQL 编写：MySQL 8 不支持 `ADD COLUMN IF NOT EXISTS`，需要先查
 * information_schema 再决定是否 ALTER，这样对「全新建库」和「已有旧库」都幂等。
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
  await conn.query(`ALTER TABLE \`${table}\` ADD ${definition}`);
  return true;
};

export default {
  id: '001_auth_ai',
  description: 'auth public services + ai agent tables',

  async up(conn) {
    const changed = [];

    // ---- users: 头像、登录态、失败锁定 ----
    const userColumns = [
      ['avatar_url', 'VARCHAR(500) NULL'],
      ['last_active_at', 'DATETIME NULL'],
      ['last_login_at', 'DATETIME NULL'],
      ['login_count', 'INT NOT NULL DEFAULT 0'],
      ['failed_login_count', 'INT NOT NULL DEFAULT 0'],
      ['locked_until', 'DATETIME NULL']
    ];
    for (const [column, definition] of userColumns) {
      if (await addColumnIfMissing(conn, 'users', column, definition)) changed.push(`users.${column}`);
    }
    if (await addIndexIfMissing(conn, 'users', 'idx_users_last_active', 'INDEX idx_users_last_active (last_active_at)')) {
      changed.push('idx_users_last_active');
    }

    // ---- 找回密码 ----
    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_resets_user (user_id, expires_at),
        CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NULL,
        username VARCHAR(50),
        action ENUM('login','logout','register','change_password','reset_password') NOT NULL,
        success TINYINT(1) NOT NULL DEFAULT 1,
        ip VARCHAR(64),
        user_agent VARCHAR(500),
        message VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_logs_created (created_at),
        INDEX idx_login_logs_user (user_id, created_at),
        INDEX idx_login_logs_action (action, success),
        CONSTRAINT fk_login_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ---- 智能体会话 ----
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_sessions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        scene ENUM('student','admin') NOT NULL DEFAULT 'student',
        title VARCHAR(200) NOT NULL DEFAULT '新会话',
        model VARCHAR(120),
        message_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ai_sessions_user (user_id, updated_at),
        INDEX idx_ai_sessions_scene (scene, updated_at),
        CONSTRAINT fk_ai_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        session_id BIGINT NOT NULL,
        role ENUM('system','user','assistant','tool') NOT NULL,
        content MEDIUMTEXT,
        tool_name VARCHAR(120),
        tool_args TEXT,
        model VARCHAR(120),
        latency_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_messages_session (session_id, id),
        CONSTRAINT fk_ai_messages_session FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_call_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NULL,
        session_id BIGINT NULL,
        scene VARCHAR(20),
        model VARCHAR(120),
        tool_names VARCHAR(500),
        prompt_chars INT NOT NULL DEFAULT 0,
        completion_chars INT NOT NULL DEFAULT 0,
        latency_ms INT NOT NULL DEFAULT 0,
        status ENUM('ok','error') NOT NULL DEFAULT 'ok',
        error VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_call_logs_created (created_at),
        INDEX idx_ai_call_logs_model (model, created_at),
        INDEX idx_ai_call_logs_status (status, created_at),
        CONSTRAINT fk_ai_call_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_ai_call_logs_session FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ---- 系统设置（键值对）----
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(80) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    return changed;
  }
};
