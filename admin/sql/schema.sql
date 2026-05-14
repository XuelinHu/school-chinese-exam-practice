CREATE DATABASE IF NOT EXISTS school_chinese_exam_practice DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_chinese_exam_practice;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(120),
  phone VARCHAR(30),
  role ENUM('student','admin') NOT NULL DEFAULT 'student',
  student_no VARCHAR(50),
  nationality VARCHAR(80),
  language VARCHAR(20) DEFAULT 'zh-CN',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
