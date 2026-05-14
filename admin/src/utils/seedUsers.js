import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { logger } from './logger.js';

const users = [
  ['admin', 'admin123456', '系统管理员', 'admin', 'admin@example.local', 'Malaysia'],
  ['student', 'student123456', 'Amin', 'student', 'student@example.local', 'Malaysia']
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

logger.info('Seed users ready for admin and student accounts');
await pool.end();
