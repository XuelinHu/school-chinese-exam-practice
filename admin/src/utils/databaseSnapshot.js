import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('SCEPG001');
const HEADER_SIZE = MAGIC.length + 12 + 16;

export function parseEncryptionKey(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('DB_BACKUP_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.');
  }
  return Buffer.from(value, 'hex');
}

export function assertSafeRestoreTarget({ database, sourceDatabase, replace }) {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(String(database || ''))) throw new Error('Restore target database name is invalid.');
  if (!String(database).toLowerCase().endsWith('_test')) throw new Error('Restore target must end in _test.');
  if (database === sourceDatabase) throw new Error('Restore target must differ from the source database.');
  if (replace !== true) throw new Error('Restore requires explicit confirmation with --replace.');
}

export async function encryptDump({ source, destination, key }) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const header = Buffer.concat([MAGIC, nonce, Buffer.alloc(16)]);
  const output = await open(destination, 'wx', 0o600);
  try {
    await output.write(header, 0, header.length, 0);
    await output.close();
    await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: 'a' }));
    const handle = await open(destination, 'r+');
    try {
      await handle.write(cipher.getAuthTag(), 0, 16, MAGIC.length + 12);
      await handle.sync();
    } finally { await handle.close(); }
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
}

export async function decryptDump({ source, destination, key }) {
  const handle = await open(source, 'r');
  try {
    const header = Buffer.alloc(HEADER_SIZE);
    const read = await handle.read(header, 0, HEADER_SIZE, 0);
    if (read.bytesRead !== HEADER_SIZE || !header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('Unsupported or invalid PostgreSQL backup.');
    }
    const nonce = header.subarray(MAGIC.length, MAGIC.length + 12);
    const tag = header.subarray(MAGIC.length + 12);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(source, { start: HEADER_SIZE }), decipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } catch (error) {
    await unlink(destination).catch(() => {});
    if (/authenticate|bad decrypt/i.test(error.message)) throw new Error('Backup authentication failed.');
    throw error;
  } finally { await handle.close(); }
}
