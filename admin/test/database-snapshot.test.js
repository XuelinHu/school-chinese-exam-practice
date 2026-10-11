import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertSafeRestoreTarget, decryptDump, encryptDump, parseEncryptionKey } from '../src/utils/databaseSnapshot.js';

test('backup key and isolated restore target are validated', () => {
  assert.equal(parseEncryptionKey('a'.repeat(64)).length, 32);
  assert.throws(() => parseEncryptionKey('short'), /64 hexadecimal/);
  assert.doesNotThrow(() => assertSafeRestoreTarget({ database: 'exam_copy_test', sourceDatabase: 'exam', replace: true }));
  assert.throws(() => assertSafeRestoreTarget({ database: 'exam', sourceDatabase: 'exam', replace: true }), /_test/);
  assert.throws(() => assertSafeRestoreTarget({ database: 'exam_copy_test', sourceDatabase: 'exam_copy_test', replace: true }), /differ/);
  assert.throws(() => assertSafeRestoreTarget({ database: 'exam_copy_test', sourceDatabase: 'exam', replace: false }), /--replace/);
});

test('encrypted PostgreSQL dumps authenticate and refuse overwrite', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'exam-pg-dump-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.dump');
  const encrypted = path.join(directory, 'backup.scepg');
  const restored = path.join(directory, 'restored.dump');
  const tampered = path.join(directory, 'tampered.scepg');
  const key = parseEncryptionKey('b'.repeat(64));
  const contents = Buffer.from('isolated custom postgres archive bytes');
  await writeFile(source, contents);
  await encryptDump({ source, destination: encrypted, key });
  await assert.rejects(encryptDump({ source, destination: encrypted, key }), /EEXIST/);
  await decryptDump({ source: encrypted, destination: restored, key });
  assert.deepEqual(await readFile(restored), contents);
  const bytes = await readFile(encrypted);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(tampered, bytes);
  await assert.rejects(decryptDump({ source: tampered, destination: path.join(directory, 'bad.dump'), key }));
});
