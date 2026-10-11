import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMigrations } from '../src/utils/migrate.js';
import { assertDatabaseName } from '../src/config/databaseName.js';

function createConnection({ lockAcquired = 1, applied = [] } = {}) {
  let released = false;
  const state = { applied, released: () => released, statements: [] };
  const connection = {
    async query(sql, params = []) {
      state.statements.push(sql);
      if (sql.includes('GET_LOCK')) return [[{ acquired: lockAcquired }]];
      if (sql.includes('RELEASE_LOCK')) {
        released = true;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT id, checksum')) return [state.applied];
      if (sql.startsWith('UPDATE schema_migrations SET checksum')) {
        const row = state.applied.find((item) => item.id === params[1]);
        if (row) row.checksum = params[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO schema_migrations')) {
        state.applied.push({ id: params[0], description: params[1], checksum: params[2] });
        return [{ affectedRows: 1 }];
      }
      if (sql === 'BROKEN DDL') throw new Error('DDL failed');
      if (sql.includes('information_schema.COLUMNS')) return [[{ count: 1 }]];
      return [{ affectedRows: 0 }];
    }
  };
  state.connection = connection;
  return state;
}

const migration = { id: '001_test', description: 'test migration', checksum: 'a'.repeat(64), up: async () => ['test'] };

test('database names are safe SQL identifiers', () => {
  assert.equal(assertDatabaseName('school_chinese_exam_practice_test'), 'school_chinese_exam_practice_test');
  for (const invalid of ['school-chinese-exam-practice', 'x`; DROP DATABASE app;--', 'a'.repeat(65), '']) {
    assert.throws(() => assertDatabaseName(invalid), /DB_NAME may contain only/);
  }
});

test('migration runner records and skips unchanged migrations', async () => {
  const state = createConnection();
  await applyMigrations(state.connection, [migration]);
  await applyMigrations(state.connection, [migration]);
  assert.equal(state.applied.length, 1);
  assert.equal(state.statements.filter((sql) => sql === 'BROKEN DDL').length, 0);
  assert.equal(state.released(), true);
});

test('migration failures are not recorded and advisory lock is released', async () => {
  const state = createConnection();
  await assert.rejects(
    applyMigrations(state.connection, [{ ...migration, up: async (conn) => conn.query('BROKEN DDL') }]),
    /DDL failed/
  );
  assert.equal(state.applied.length, 0);
  assert.equal(state.released(), true);
});

test('migration runner backfills legacy checksums and rejects drift, unknown ids, duplicates and lock timeout', async () => {
  const legacy = createConnection({ applied: [{ id: migration.id, checksum: null }] });
  await applyMigrations(legacy.connection, [migration]);
  assert.equal(legacy.applied[0].checksum, migration.checksum);

  const drift = createConnection({ applied: [{ id: migration.id, checksum: 'b'.repeat(64) }] });
  await assert.rejects(applyMigrations(drift.connection, [migration]), /checksum mismatch/);

  const unknown = createConnection({ applied: [{ id: '999_removed', checksum: 'c'.repeat(64) }] });
  await assert.rejects(applyMigrations(unknown.connection, [migration]), /unknown migration/);

  const duplicate = createConnection();
  await assert.rejects(applyMigrations(duplicate.connection, [migration, migration]), /must be unique/);

  const timeout = createConnection({ lockAcquired: 0 });
  await assert.rejects(applyMigrations(timeout.connection, [migration]), /Timed out/);
  assert.equal(timeout.released(), false);
});
