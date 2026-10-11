import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env') });

export function requiredSeedPassword(name) {
  const password = process.env[name];
  if (typeof password !== 'string' || !password) {
    throw new Error(`${name} must be set in admin/.env.`);
  }
  return password;
}
