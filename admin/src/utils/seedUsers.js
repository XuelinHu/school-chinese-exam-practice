import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { logger } from './logger.js';

const users = [
  ['admin', 'admin123456', '系统管理员', 'admin', 'admin@example.local', 'Malaysia'],
  ['student', 'student123456', 'Amin', 'student', 'student@example.local', 'Malaysia'],
  ['nurul', 'student123456', 'Nurul Aisyah', 'student', 'nurul@example.local', 'Malaysia'],
  ['weijie', 'student123456', 'Tan Wei Jie', 'student', 'weijie@example.local', 'Malaysia'],
  ['siti', 'student123456', 'Siti Mariam', 'student', 'siti@example.local', 'Malaysia'],
  ['raj', 'student123456', 'Raj Kumar', 'student', 'raj@example.local', 'Malaysia']
];

for (const [username, password, name, role, email, nationality] of users) {
  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    `INSERT INTO users (username, password, name, email, role, nationality, language, status)
     VALUES (?, ?, ?, ?, ?, ?, 'zh-CN', 'active')
     ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name), role=VALUES(role), email=VALUES(email), nationality=VALUES(nationality), status='active'`,
    [username, hash, name, email, role, nationality]
  );
}

const [studentRows] = await pool.execute(
  `SELECT id, username FROM users WHERE username IN ('student', 'nurul', 'weijie', 'siti', 'raj')`
);
const userId = Object.fromEntries(studentRows.map((user) => [user.username, user.id]));

const records = [
  [101, userId.student, 1, 5, 3, 2, 3, 245, '2026-05-10 09:20:00'],
  [102, userId.student, 2, 5, 4, 1, 4, 312, '2026-05-12 14:05:00'],
  [103, userId.nurul, 1, 5, 5, 0, 5, 198, '2026-05-11 10:30:00'],
  [104, userId.weijie, 3, 5, 4, 1, 4, 260, '2026-05-12 16:40:00'],
  [105, userId.siti, 2, 5, 2, 3, 2, 420, '2026-05-13 11:15:00'],
  [106, userId.raj, 3, 5, 3, 2, 3, 338, '2026-05-13 19:25:00']
].filter((record) => record[1]);

for (const record of records) {
  await pool.execute(
    `INSERT INTO study_records (id, user_id, paper_id, total_questions, correct_count, wrong_count, total_score, duration_seconds, started_at, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(?, INTERVAL ? SECOND), ?)
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), paper_id=VALUES(paper_id), total_questions=VALUES(total_questions),
       correct_count=VALUES(correct_count), wrong_count=VALUES(wrong_count), total_score=VALUES(total_score),
       duration_seconds=VALUES(duration_seconds), started_at=VALUES(started_at), submitted_at=VALUES(submitted_at)`,
    [...record, record[7], record[8]]
  );
}

const wrongQuestions = [
  [userId.student, 2, 2, 0, '2026-05-12 14:05:00'],
  [userId.student, 6, 1, 0, '2026-05-12 14:05:00'],
  [userId.siti, 7, 3, 0, '2026-05-13 11:15:00'],
  [userId.raj, 10, 1, 0, '2026-05-13 19:25:00']
].filter((item) => item[0]);

for (const item of wrongQuestions) {
  await pool.execute(
    `INSERT INTO wrong_questions (user_id, question_id, wrong_count, resolved, last_wrong_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE wrong_count=VALUES(wrong_count), resolved=VALUES(resolved), last_wrong_at=VALUES(last_wrong_at)`,
    item
  );
}

logger.info('Seed users ready for admin and student accounts');
await pool.end();
