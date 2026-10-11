import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { assertDatabaseName } from '../src/config/databaseName.js';
import { assertSafeRestoreTarget, decryptDump, encryptDump, parseEncryptionKey } from '../src/utils/databaseSnapshot.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-3000); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${stderr.trim()}`)));
  });
}

const [command, ...args] = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? '' : args[index + 1] || '';
};
const database = assertDatabaseName(process.env.PGDATABASE || 'school_chinese_exam_practice');
const key = parseEncryptionKey(process.env.DB_BACKUP_ENCRYPTION_KEY);
const environment = { ...process.env, PGDATABASE: database };
const temp = await mkdtemp(path.join(os.tmpdir(), 'exam-pg-backup-'));
try {
  if (command === 'backup') {
    const outputDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backups');
    const destination = path.resolve(value('--destination') || path.join(outputDirectory, `${database}-${new Date().toISOString().replace(/[:.]/g, '-')}.scepg`));
    await mkdir(path.dirname(destination), { recursive: true });
    const dump = path.join(temp, 'database.dump');
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', dump], environment);
    await encryptDump({ source: dump, destination, key });
    console.log(`Encrypted PostgreSQL backup created: ${destination}`);
  } else if (command === 'restore') {
    const source = path.resolve(value('--source'));
    const targetDatabase = assertDatabaseName(value('--database') || database);
    const replace = args.includes('--replace');
    assertSafeRestoreTarget({ database: targetDatabase, sourceDatabase: database, replace });
    const dump = path.join(temp, 'restore.dump');
    await decryptDump({ source, destination: dump, key });
    await run('pg_restore', ['--list', dump], environment);
    await run('pg_restore', [
      '--exit-on-error', '--single-transaction', '--clean', '--if-exists', '--no-owner', '--no-acl',
      '--dbname', targetDatabase, dump
    ], { ...environment, PGDATABASE: targetDatabase });
    console.log(`Restored snapshot into isolated database ${targetDatabase}.`);
  } else {
    console.log('Usage: npm run db:backup [-- --destination <file>]');
    console.log('       npm run db:restore -- --source <file> --database <name_test> --replace');
    process.exitCode = command ? 2 : 0;
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
