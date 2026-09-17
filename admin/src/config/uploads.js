import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 上传根目录，默认 admin/uploads，可用 ADMIN_UPLOAD_DIR 覆盖。 */
export const uploadDir = process.env.ADMIN_UPLOAD_DIR
  ? path.resolve(process.env.ADMIN_UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');

export const avatarDir = path.join(uploadDir, 'avatars');

/** 对外访问前缀，与 app.js 中的 express.static 挂载点保持一致。 */
export const UPLOAD_URL_PREFIX = '/uploads';

/**
 * 按魔数识别图片类型，不信任客户端传来的 Content-Type。
 * @returns {{ext: string, mime: string}|null}
 */
export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}
