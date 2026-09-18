CREATE DATABASE IF NOT EXISTS school_chinese_exam_practice DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_chinese_exam_practice;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(120),
  phone VARCHAR(30),
  -- 用户端 student/teacher，管理端 content_admin/admin（见 middleware/role.js）
  role ENUM('student','teacher','admin','content_admin') NOT NULL DEFAULT 'student',
  student_no VARCHAR(50),
  nationality VARCHAR(80),
  -- 合法取值 zh-CN / en-US / ms-MY，与 i18n 和 system_settings 共用一套码。
  -- 有意保持 VARCHAR 而非 ENUM：改 ENUM 会与另两处的既有取值耦合。
  language VARCHAR(20) DEFAULT 'zh-CN',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  avatar_url VARCHAR(500),
  last_active_at DATETIME,
  last_login_at DATETIME,
  login_count INT NOT NULL DEFAULT 0,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME,
  -- 令牌吊销版本号：改密/被重置/被停用时自增，旧 JWT 立即失效
  token_version INT NOT NULL DEFAULT 0,
  -- 软删除：非空即视为已删除。users 上的外键都是 ON DELETE CASCADE，
  -- 物理删除会连删成绩、错题、收藏与会话，所以删除一律走这里。
  deleted_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_last_active (last_active_at),
  INDEX idx_users_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS levels (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS level_translations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  level_id BIGINT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  UNIQUE KEY uk_level_lang (level_id, language_code),
  CONSTRAINT fk_level_translations_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  parent_id BIGINT,
  code VARCHAR(60) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES question_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS question_category_translations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  category_id BIGINT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  UNIQUE KEY uk_category_lang (category_id, language_code),
  CONSTRAINT fk_category_translations_category FOREIGN KEY (category_id) REFERENCES question_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  level_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  question_type ENUM('single_choice','multiple_choice','true_false','fill_blank') NOT NULL DEFAULT 'single_choice',
  difficulty ENUM('easy','normal','hard') NOT NULL DEFAULT 'easy',
  score DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  audio_url VARCHAR(500),
  image_url VARCHAR(500),
  status ENUM('published','draft','disabled') NOT NULL DEFAULT 'published',
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_level FOREIGN KEY (level_id) REFERENCES levels(id),
  CONSTRAINT fk_questions_category FOREIGN KEY (category_id) REFERENCES question_categories(id),
  CONSTRAINT fk_questions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS question_translations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  analysis TEXT,
  UNIQUE KEY uk_question_lang (question_id, language_code),
  CONSTRAINT fk_question_translations_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  option_key VARCHAR(10) NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_question_option_key (question_id, option_key),
  CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_option_translations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  option_id BIGINT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  content VARCHAR(500) NOT NULL,
  UNIQUE KEY uk_option_lang (option_id, language_code),
  CONSTRAINT fk_option_translations_option FOREIGN KEY (option_id) REFERENCES question_options(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS papers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paper_type ENUM('practice','exam','daily') NOT NULL DEFAULT 'practice',
  level_id BIGINT,
  total_score DECIMAL(8,2) NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 0,
  status ENUM('published','draft','disabled') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_papers_level FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS paper_translations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paper_id BIGINT NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(500),
  UNIQUE KEY uk_paper_lang (paper_id, language_code),
  CONSTRAINT fk_paper_translations_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paper_questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  paper_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  score DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  UNIQUE KEY uk_paper_question (paper_id, question_id),
  CONSTRAINT fk_paper_questions_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_paper_questions_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  paper_id BIGINT,
  total_questions INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  wrong_count INT NOT NULL DEFAULT 0,
  total_score DECIMAL(8,2) NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  started_at DATETIME,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 成绩页与教学查看页都是「按人取、按时间倒序」，单列外键索引会退化成 filesort
  INDEX idx_study_records_user_time (user_id, submitted_at),
  CONSTRAINT fk_study_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_study_records_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_answers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  paper_id BIGINT,
  study_record_id BIGINT,
  selected_option_ids VARCHAR(255),
  answer_text TEXT,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_answers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL,
  CONSTRAINT fk_answers_record FOREIGN KEY (study_record_id) REFERENCES study_records(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS wrong_questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  wrong_count INT NOT NULL DEFAULT 1,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  last_wrong_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_wrong_user_question (user_id, question_id),
  -- 错题本固定按「未解决优先 + 最近错优先」排序
  INDEX idx_wrong_questions_user_state (user_id, resolved, last_wrong_at),
  CONSTRAINT fk_wrong_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wrong_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorite_questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_favorite_user_question (user_id, question_id),
  CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorite_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS i18n_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  module VARCHAR(80) NOT NULL,
  message_key VARCHAR(120) NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  message_value VARCHAR(1000) NOT NULL,
  UNIQUE KEY uk_i18n_message (module, message_key, language_code)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_resets_user (user_id, expires_at),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  session_id BIGINT NULL,
  -- 与 ai_sessions.scene 同类型，同一语义不留两种定义
  scene ENUM('student','admin'),
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
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
