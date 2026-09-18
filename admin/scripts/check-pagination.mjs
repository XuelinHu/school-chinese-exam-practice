/**
 * 分页信封断言：每个列表端点都必须返回 { list, total, page, pageSize, totalPages }，
 * 且 list.length <= pageSize。字典表端点（/learning/levels、/learning/categories）
 * 是**有意例外**，这里单独断言它们仍是裸数组。
 *
 * 新增列表端点时把它加进 CASES；漏加不会报错，但 README 的「分页覆盖范围」会失真。
 *
 * 前置：后端已启动（npm run dev），且已执行过 npm run seed:users。
 * 用法：npm run check:pagination
 */
const BASE = process.env.CHECK_BASE || 'http://127.0.0.1:8033/api';

async function token(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json();
  if (!body?.data?.token) throw new Error(`login failed for ${username}`);
  return body.data.token;
}

const adminToken = await token('admin', 'admin123456');
const studentToken = await token('student', 'student123456');
const teacherToken = await token('teacher', 'teacher123456');

// [说明, 路径, token]
const CASES = [
  ['学员端 试卷', '/learning/papers?page=1&pageSize=5', studentToken],
  ['学员端 成绩', '/learning/records?page=1&pageSize=5', studentToken],
  ['学员端 错题', '/learning/wrong-questions?page=1&pageSize=5', studentToken],
  ['教学 学员列表', '/teaching/students?page=1&pageSize=5', teacherToken],
  ['教学 成绩记录', '/teaching/students/2/records?page=1&pageSize=5', teacherToken],
  ['教学 错题', '/teaching/students/2/wrong-questions?page=1&pageSize=5', teacherToken],
  ['后台 学生管理', '/admin/users?page=1&pageSize=5', adminToken],
  ['后台 成绩记录', '/admin/records?page=1&pageSize=5', adminToken],
  ['后台 登录日志', '/admin/login-logs?page=1&pageSize=5', adminToken],
  ['后台 在线状态', '/admin/online?page=1&pageSize=5', adminToken],
  ['后台 题库', '/admin/questions?page=1&pageSize=5', adminToken],
  ['后台 试卷', '/admin/papers?page=1&pageSize=5', adminToken],
  ['后台 等级', '/admin/levels?page=1&pageSize=5', adminToken],
  ['后台 分类', '/admin/categories?page=1&pageSize=5', adminToken],
  ['后台 智能体会话', '/admin/ai/sessions?page=1&pageSize=5', adminToken],
  ['后台 调用日志', '/admin/ai/logs?page=1&pageSize=5', adminToken]
];

const FIELDS = ['list', 'total', 'page', 'pageSize', 'totalPages'];
let failures = 0;

function fail(label, detail) {
  failures += 1;
  console.log(`FAIL ${label}\n       ${detail}`);
}

for (const [label, path, bearer] of CASES) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${bearer}` } });
  const body = await res.json();
  if (res.status !== 200) {
    fail(label, `status ${res.status}: ${body?.message}`);
    continue;
  }
  const data = body.data ?? {};
  const missing = FIELDS.filter((field) => data[field] === undefined);
  if (missing.length) {
    fail(label, `缺少信封字段 ${missing.join(', ')}（实际键：${Object.keys(data).join(', ')}）`);
    continue;
  }
  if (!Array.isArray(data.list)) {
    fail(label, `list 不是数组：${typeof data.list}`);
    continue;
  }
  if (data.list.length > data.pageSize) {
    fail(label, `list.length=${data.list.length} > pageSize=${data.pageSize}`);
    continue;
  }
  console.log(`ok   ${label.padEnd(16)} total=${String(data.total).padStart(4)} page=${data.page}/${data.totalPages} 本页 ${data.list.length} 条`);
}

// 第二页必须与第一页不同（否则说明 page 参数没生效，只是把第一页重复返回）
for (const [label, path, bearer] of CASES.slice(0, 3)) {
  const [first, second] = await Promise.all([1, 2].map(async (page) => {
    const res = await fetch(`${BASE}${path.replace('page=1', `page=${page}`)}`, {
      headers: { Authorization: `Bearer ${bearer}` }
    });
    return (await res.json()).data;
  }));
  if (!first.total) {
    console.log(`skip ${label} 第二页比对：无数据`);
    continue;
  }
  const idsOf = (data) => (data.list ?? []).map((row) => row.id).join(',');
  if (first.totalPages > 1 && idsOf(first) === idsOf(second)) {
    fail(`${label} 第二页`, '两页内容完全相同，page 参数未生效');
  } else if (first.totalPages > 1) {
    console.log(`ok   ${label} 第二页内容与第一页不同`);
  } else {
    console.log(`skip ${label} 第二页比对：数据不足一页以上（totalPages=${first.totalPages}）`);
  }
}

// 成绩明细：answers 必须是分页信封而不是裸数组
const records = await (await fetch(`${BASE}/admin/records?page=1&pageSize=5`, {
  headers: { Authorization: `Bearer ${adminToken}` }
})).json();
const recordId = records.data?.list?.[0]?.id;
if (recordId) {
  const detail = await (await fetch(`${BASE}/admin/records/${recordId}?page=1&pageSize=2`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })).json();
  const answers = detail.data?.answers;
  if (!answers || Array.isArray(answers)) {
    fail('成绩明细 answers', `仍是${Array.isArray(answers) ? '裸数组' : '缺失'}，未变成分页信封`);
  } else {
    const missing = FIELDS.filter((field) => answers[field] === undefined);
    if (missing.length) fail('成绩明细 answers', `缺少 ${missing.join(', ')}`);
    else console.log(`ok   ${'成绩明细 answers'.padEnd(16)} total=${answers.total} page=${answers.page}/${answers.totalPages} 本页 ${answers.list.length} 条`);
  }
} else {
  console.log('skip 成绩明细 answers：库里没有成绩记录');
}

// 有意例外：字典表保持裸数组，供 <select> 一次性填充
for (const [label, path, bearer] of [
  ['字典 等级', '/learning/levels', studentToken],
  ['字典 分类', '/learning/categories', studentToken]
]) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${bearer}` } });
  const data = (await res.json()).data;
  if (Array.isArray(data)) console.log(`ok   ${label.padEnd(16)} 裸数组（有意例外）${data.length} 行`);
  else fail(label, '字典表被改成信封了，会破坏下拉框');
}

console.log(failures ? `\n${failures} 项未通过` : '\n全部通过');
process.exit(failures ? 1 : 0);
