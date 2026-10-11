import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { assertDatabaseName } from '../config/databaseName.js';

function parseArgs(argv) {
  const args = { username: 'admin', passwordStdin: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--username' && argv[index + 1]) {
      args.username = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--password-stdin') {
      args.passwordStdin = true;
    } else {
      throw new Error(`Unsupported argument: ${argv[index]}`);
    }
  }
  return args;
}

async function readPassword() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function bootstrap() {
  if (process.env.CONFIRM_ADMIN_BOOTSTRAP !== '1') {
    throw new Error('Set CONFIRM_ADMIN_BOOTSTRAP=1 to explicitly authorize this one-time operation.');
  }

  const { username, passwordStdin } = parseArgs(process.argv.slice(2));
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
    throw new Error('Username must be 3-50 characters and use letters, digits, dot, dash or underscore.');
  }
  if (!passwordStdin) throw new Error('Pass the password through --password-stdin; command-line passwords are not accepted.');

  const password = await readPassword();
  if (password.length < 16 || password.length > 64) {
    throw new Error('Bootstrap password must contain 16-64 characters.');
  }

  const database = assertDatabaseName(process.env.PGDATABASE || 'school_chinese_exam_practice');
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    await connection.query("SELECT pg_advisory_lock(hashtext('exam-admin-bootstrap'), hashtext(?))", [database]);
    lockAcquired = true;
    lockAcquired = true;

    const [admins] = await connection.query(
      `SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1`
    );
    if (admins.length) throw new Error('An administrator already exists; bootstrap is disabled.');

    const [existing] = await connection.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length) throw new Error('The requested username is already in use.');

    const passwordHash = await bcrypt.hash(password, 10);
    await connection.execute(
      `INSERT INTO users (username, password, name, role, nationality, language, status)
       VALUES (?, ?, ?, 'admin', 'Malaysia', 'zh-CN', 'active')`,
      [username, passwordHash, username]
    );
  } finally {
    try {
      if (lockAcquired) await connection.query("SELECT pg_advisory_unlock(hashtext('exam-admin-bootstrap'), hashtext(?))", [database]);
    } finally {
      connection.release();
    }
  }

  console.log(`Initial administrator ${username} created. The supplied password was not echoed.`);
}

try {
  await bootstrap();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
