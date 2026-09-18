/**
 * 展示层格式化。
 *
 * 后端时间列 JSON 化后是 ISO(UTC) 串，这里按本地时区显示到分钟。
 */
const pad = (value) => String(value).padStart(2, '0');

export function fmtTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 秒数拆成「分 + 秒」，交给调用方按当前语言拼单位，避免单位写死在工具函数里。 */
export function splitDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}
