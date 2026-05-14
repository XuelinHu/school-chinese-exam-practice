import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const logDir = process.env.LOG_DIR || path.join(root, 'logs');
const logFile = path.join(logDir, 'app.log');

function ensureLogDir() {
  fs.mkdirSync(logDir, { recursive: true });
}

function mask(value) {
  if (value == null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text
    .replace(/(authorization["']?\s*[:=]\s*["']?Bearer\s+)[^"',\s]+/gi, '$1***')
    .replace(/(password["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***')
    .replace(/(token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***');
}

function write(level, message, meta) {
  const timestamp = new Date().toISOString();
  const extra = meta === undefined ? '' : ` ${mask(meta)}`;
  const line = `[${timestamp}] [${level}] ${message}${extra}`;
  ensureLogDir();
  fs.appendFileSync(logFile, `${line}\n`, 'utf8');

  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message, meta) {
    write('INFO', message, meta);
  },
  warn(message, meta) {
    write('WARN', message, meta);
  },
  error(message, meta) {
    write('ERROR', message, meta);
  }
};

export { logFile };
