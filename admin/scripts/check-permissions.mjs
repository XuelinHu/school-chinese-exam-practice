/**
 * 角色矩阵断言：4 个演示账号 × 管理端/教学端/学员端接口，逐条核对期望状态码。
 * 期望值来自 README「角色与权限」，不是从当前行为反推的 ——
 * 改权限时先改这张表，跑不过就说明代码与文档不一致。
 *
 * 前置：后端已启动（npm run dev），且已执行过 npm run seed:users。
 * 用法：npm run check:permissions
 */
const BASE = process.env.CHECK_BASE || 'http://127.0.0.1:8033/api';

const ACCOUNTS = {
  admin: 'admin123456',
  content: 'content123456',
  teacher: 'teacher123456',
  student: 'student123456'
};

// [方法, 路径, 各角色期望状态码]  200=通过 403=拒绝
const CASES = [
  // ── 内容菜单：超管 + 内容管理员
  ['GET', '/admin/questions?page=1&pageSize=5', { admin: 200, content: 200, teacher: 403, student: 403 }],
  ['GET', '/admin/papers?page=1&pageSize=5', { admin: 200, content: 200, teacher: 403, student: 403 }],
  ['GET', '/admin/levels?page=1&pageSize=5', { admin: 200, content: 200, teacher: 403, student: 403 }],
  ['GET', '/admin/categories?page=1&pageSize=5', { admin: 200, content: 200, teacher: 403, student: 403 }],
  // ── 仅超管
  ['GET', '/admin/users?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/records?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/login-logs?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/online?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/stats', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/ai/sessions?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  ['GET', '/admin/ai/logs?page=1&pageSize=5', { admin: 200, content: 403, teacher: 403, student: 403 }],
  // ── 教学查看区：教师 + 超管
  ['GET', '/teaching/students?page=1&pageSize=5', { admin: 200, content: 403, teacher: 200, student: 403 }],
  ['GET', '/teaching/students/2', { admin: 200, content: 403, teacher: 200, student: 403 }],
  ['GET', '/teaching/students/2/records?page=1&pageSize=5', { admin: 200, content: 403, teacher: 200, student: 403 }],
  ['GET', '/teaching/students/2/wrong-questions?page=1&pageSize=5', { admin: 200, content: 403, teacher: 200, student: 403 }],
  // ── 学员端（任何登录用户）
  ['GET', '/learning/records?page=1&pageSize=5', { admin: 200, content: 200, teacher: 200, student: 200 }],
  ['GET', '/learning/wrong-questions?page=1&pageSize=5', { admin: 200, content: 200, teacher: 200, student: 200 }],
  ['GET', '/learning/papers?page=1&pageSize=5', { admin: 200, content: 200, teacher: 200, student: 200 }],
  // ── 教学区不得存在写方法（方法不允许 / 未实现都算合格，绝不能是 2xx）
  ['POST', '/teaching/students', { admin: 404, content: 403, teacher: 404, student: 403 }],
  ['DELETE', '/teaching/students/2', { admin: 404, content: 403, teacher: 404, student: 403 }],
  ['PUT', '/teaching/students/2', { admin: 404, content: 403, teacher: 404, student: 403 }]
];

const tokens = {};
for (const [username, password] of Object.entries(ACCOUNTS)) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json();
  if (!body?.data?.token) {
    console.error(`LOGIN FAILED for ${username}:`, JSON.stringify(body).slice(0, 200));
    process.exit(1);
  }
  tokens[username] = body.data.token;
}

let failures = 0;
for (const [method, path, expect] of CASES) {
  const got = {};
  for (const username of Object.keys(ACCOUNTS)) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens[username]}`, 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}'
    });
    got[username] = res.status;
    await res.arrayBuffer();  // 排空响应体，避免连接堆积
  }
  const bad = Object.keys(expect).filter((role) => got[role] !== expect[role]);
  if (bad.length) {
    failures += 1;
    console.log(`FAIL ${method} ${path}`);
    for (const role of bad) console.log(`       ${role}: expected ${expect[role]}, got ${got[role]}`);
  } else {
    console.log(`ok   ${method} ${path.split('?')[0]}`);
  }
}

console.log(failures ? `\n${failures} case(s) FAILED` : `\nAll ${CASES.length} cases passed`);
process.exit(failures ? 1 : 0);
