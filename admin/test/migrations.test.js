import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDatabaseName } from '../src/config/databaseName.js';
import { assertDemoSeedAllowed } from '../src/utils/demoSeedGuard.js';

process.env.PGPASSWORD ||= 'unit-migration-test-only';
const { applyMigrations } = await import('../src/utils/migrate.js');

function createConnection(applied = []) {
  const state = { applied, released: false, statements: [] };
  const connection = {
    async query(sql, params = []) {
      state.statements.push(sql);
      if (sql.startsWith('SELECT id, checksum')) return [state.applied];
      if (sql.startsWith('INSERT INTO schema_migrations')) {
        state.applied.push({ id: params[0], description: params[1], checksum: params[2] });
      }
      if (sql === 'BROKEN DDL') throw new Error('DDL failed');
      return [[], { affectedRows: 1 }];
    },
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() { state.released = true; }
  };
  return { state, connection };
}

const migration = { id: '001_test', description: 'test migration', sql: 'SELECT 1' };

test('database names are safe SQL identifiers', () => {
  assert.equal(assertDatabaseName('school_chinese_exam_practice_test'), 'school_chinese_exam_practice_test');
  for (const invalid of ['school-chinese-exam-practice', 'x`; DROP DATABASE app;--', 'a'.repeat(65), '']) {
    assert.throws(() => assertDatabaseName(invalid), /PGDATABASE may contain only/);
  }
});

test('demo seeding requires opt-in, isolated database, and unique strong role passwords', () => {
  const env = {
    ALLOW_DEMO_SEED: '1', PGDATABASE: 'school_chinese_exam_practice_test',
    SEED_ADMIN_PASSWORD: 'Admin-Password-2026!A', SEED_CONTENT_PASSWORD: 'Content-Password-2026!B',
    SEED_TEACHER_PASSWORD: 'Teacher-Password-2026!C', SEED_STUDENT_PASSWORD: 'Student-Password-2026!D'
  };
  assert.deepEqual(assertDemoSeedAllowed(env), {
    admin: env.SEED_ADMIN_PASSWORD, content: env.SEED_CONTENT_PASSWORD,
    teacher: env.SEED_TEACHER_PASSWORD, student: env.SEED_STUDENT_PASSWORD
  });
  assert.throws(() => assertDemoSeedAllowed({ ...env, ALLOW_DEMO_SEED: '0' }), /ALLOW_DEMO_SEED/);
  assert.throws(() => assertDemoSeedAllowed({ ...env, PGDATABASE: 'school_chinese_exam_practice' }), /restricted/);
  assert.throws(() => assertDemoSeedAllowed({ ...env, SEED_ADMIN_PASSWORD: 'too-short' }), /at least 16/);
  assert.throws(() => assertDemoSeedAllowed({ ...env, SEED_STUDENT_PASSWORD: env.SEED_ADMIN_PASSWORD }), /different/);
});

test('migration runner records and skips unchanged migrations', async () => {
  const { state, connection } = createConnection();
  await applyMigrations({ connection, database: 'school_chinese_exam_practice_test', migrations: [migration] });
  await applyMigrations({ connection, database: 'school_chinese_exam_practice_test', migrations: [migration] });
  assert.equal(state.applied.length, 1);
  assert.equal(state.released, false);
  assert.equal(state.statements.filter((sql) => sql === 'SELECT 1').length, 1);
});

test('migration failures are not recorded and release owned connections', async () => {
  const { state, connection } = createConnection();
  const pool = { async getConnection() { return connection; } };
  await assert.rejects(applyMigrations({ pool, database: 'exam_test', migrations: [{ ...migration, sql: 'BROKEN DDL' }] }), /DDL failed/);
  assert.equal(state.applied.length, 0);
  assert.equal(state.released, true);
});

test('migration runner rejects checksum drift and unknown migration ids', async () => {
  const drift = createConnection([{ id: migration.id, checksum: 'b'.repeat(64) }]);
  await assert.rejects(applyMigrations({ connection: drift.connection, database: 'exam_test', migrations: [migration] }), /checksum mismatch/);
  const unknown = createConnection([{ id: '999_removed', checksum: 'c'.repeat(64) }]);
  await assert.rejects(applyMigrations({ connection: unknown.connection, database: 'exam_test', migrations: [migration] }), /unknown migration/);
});
