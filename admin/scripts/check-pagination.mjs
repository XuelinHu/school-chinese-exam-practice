/**
 * 分页信封断言：每个列表端点都必须返回 { list, total, page, pageSize, totalPages }，
 * 且 list.length <= pageSize。组卷和考试详情中的题目集合也必须逐页读取。
 *
 * 新增列表端点时把它加进 CASES；漏加不会报错，但 README 的「分页覆盖范围」会失真。
 *
 * 前置：后端已启动（npm run dev），且已执行过 npm run seed:users。
 * 用法：npm run check:pagination
 */
import { requiredSeedPassword } from './testCredentials.mjs';

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

const adminToken = await token('admin', requiredSeedPassword('SEED_ADMIN_PASSWORD'));
const studentToken = await token('student', requiredSeedPassword('SEED_STUDENT_PASSWORD'));
const teacherToken = await token('teacher', requiredSeedPassword('SEED_TEACHER_PASSWORD'));
const teachingStudentsResponse = await fetch(`${BASE}/teaching/students?page=1&pageSize=100`, {
  headers: { Authorization: `Bearer ${teacherToken}` }
});
const teachingStudents = (await teachingStudentsResponse.json()).data?.list || [];
const teachingStudentId = teachingStudents.find((user) => user.username === 'student')?.id;
if (!teachingStudentId) throw new Error('Could not find the seeded student account in the teaching list');

// [说明, 路径, token]
const CASES = [
  ['学员端 试卷', '/learning/papers?page=1&pageSize=1', studentToken],
  ['学员端 成绩', '/learning/records?page=1&pageSize=1', studentToken],
  ['学员端 错题', '/learning/wrong-questions?page=1&pageSize=1', studentToken],
  ['学员端 等级选项', '/learning/levels?page=1&pageSize=1', studentToken],
  ['学员端 分类选项', '/learning/categories?page=1&pageSize=1', studentToken],
  ['教学 学员列表', '/teaching/students?page=1&pageSize=1', teacherToken],
  ['教学 成绩记录', `/teaching/students/${teachingStudentId}/records?page=1&pageSize=1`, teacherToken],
  ['教学 错题', `/teaching/students/${teachingStudentId}/wrong-questions?page=1&pageSize=1`, teacherToken],
  ['后台 学生管理', '/admin/users?page=1&pageSize=1', adminToken],
  ['后台 成绩记录', '/admin/records?page=1&pageSize=1', adminToken],
  ['后台 登录日志', '/admin/login-logs?page=1&pageSize=1', adminToken],
  ['后台 在线状态', '/admin/online?page=1&pageSize=1', adminToken],
  ['后台 题库', '/admin/questions?page=1&pageSize=1', adminToken],
  ['后台 试卷', '/admin/papers?page=1&pageSize=1', adminToken],
  ['后台 等级', '/admin/levels?page=1&pageSize=1', adminToken],
  ['后台 分类', '/admin/categories?page=1&pageSize=1', adminToken],
  ['后台 智能体会话', '/admin/ai/sessions?page=1&pageSize=1', adminToken],
  ['后台 调用日志', '/admin/ai/logs?page=1&pageSize=1', adminToken]
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

// 小页长让种子数据能覆盖分页；所有多页端点都需确认第二页内容发生变化。
for (const [label, path, bearer] of CASES) {
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

// 组卷器和考试详情先读题目分页信封，再比对第 2 页。客户端必须逐页汇总后才可整体提交/作答。
async function checkNestedQuestions(label, path, bearer) {
  const auth = { Authorization: `Bearer ${bearer}` };
  const first = (await (await fetch(`${BASE}${path}&page=1&pageSize=1`, { headers: auth })).json()).data;
  const page = first?.questions;
  if (!page || !Array.isArray(page.list) || page.page !== 1 || page.pageSize !== 1 || page.list.length > 1) {
    fail(label, 'questions 未返回分页信封');
    return;
  }
  if (page.totalPages > 1) {
    const second = (await (await fetch(`${BASE}${path}&page=2&pageSize=1`, { headers: auth })).json()).data?.questions;
    if (!second?.list?.length || page.list[0]?.id === second.list[0]?.id) {
      fail(`${label} 第二页`, '题目跨页内容缺失或重复');
      return;
    }
    console.log(`ok   ${label} 题目第 2 页内容与第 1 页不同`);
  } else {
    console.log(`skip ${label} 题目第二页比对：数据不足一页以上`);
  }
}

const adminPapers = (await (await fetch(`${BASE}/admin/papers?page=1&pageSize=1`, {
  headers: { Authorization: `Bearer ${adminToken}` }
})).json()).data;
if (adminPapers?.list?.[0]?.id) {
  await checkNestedQuestions('后台组卷器', `/admin/papers/${adminPapers.list[0].id}?lang=zh-CN`, adminToken);
} else {
  console.log('skip 后台组卷器题目分页：没有试卷');
}

const studentPapers = (await (await fetch(`${BASE}/learning/papers?page=1&pageSize=1`, {
  headers: { Authorization: `Bearer ${studentToken}` }
})).json()).data;
if (studentPapers?.list?.[0]?.id) {
  await checkNestedQuestions('学员考试', `/learning/papers/${studentPapers.list[0].id}?lang=zh-CN`, studentToken);
} else {
  console.log('skip 学员考试题目分页：没有已发布试卷');
}

console.log(failures ? `\n${failures} 项未通过` : '\n全部通过');
process.exit(failures ? 1 : 0);
