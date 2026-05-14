import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const docsDir = path.join(root, 'docs', 'softcopyright');
const pdfDir = path.join(root, '软著', '马来西亚留学生汉语练习平台V1.0', 'pdf');
const archiveScreens = path.join(root, '软著', '马来西亚留学生汉语练习平台V1.0', 'images', 'screenshots');
const archiveDiagrams = path.join(root, '软著', '马来西亚留学生汉语练习平台V1.0', 'images', 'diagrams');
const softwareName = '马来西亚留学生汉语练习平台';
const version = 'V1.0';
const port = 9444;

const sourceFiles = [
  'admin/src/server.js',
  'admin/src/app.js',
  'admin/src/config/db.js',
  'admin/src/middleware/auth.js',
  'admin/src/middleware/role.js',
  'admin/src/middleware/requestLogger.js',
  'admin/src/routes/auth.js',
  'admin/src/routes/learning.js',
  'admin/src/routes/admin.js',
  'admin/src/utils/errors.js',
  'admin/src/utils/response.js',
  'admin/src/utils/logger.js',
  'admin/src/utils/initDb.js',
  'admin/src/utils/seedUsers.js',
  'admin/sql/schema.sql',
  'admin/sql/seed.sql',
  'fronter/src/main.js',
  'fronter/src/App.vue',
  'fronter/src/router/index.js',
  'fronter/src/api/client.js',
  'fronter/src/stores/auth.js',
  'fronter/src/i18n/index.js',
  'fronter/src/views/Home.vue',
  'fronter/src/views/Login.vue',
  'fronter/src/views/Register.vue',
  'fronter/src/views/PracticeList.vue',
  'fronter/src/views/PracticeDetail.vue',
  'fronter/src/views/Records.vue',
  'fronter/src/views/WrongBook.vue',
  'fronter/src/views/Profile.vue',
  'fronter/src/views/Dashboard.vue',
  'fronter/src/views/AdminTable.vue',
  'fronter/src/assets/style.css',
  'admin/package.json',
  'fronter/package.json',
  '.gitignore',
  'README.md'
];

const requirements = [
  ['FR-01 用户登录', '学生和管理员可通过用户名与密码登录，后台签发 JWT，前端保存登录状态并依据角色展示页面入口。', '登录页面', '/login', '/api/auth/login', 'users', 'login_trilingual.png'],
  ['FR-02 学生注册', '学生可填写账号、密码、姓名、邮箱、电话、学号、国籍和语言信息完成注册。', '注册页面', '/register', '/api/auth/register', 'users', 'register_trilingual.png'],
  ['FR-03 学生首页导航', '登录学生可在首页进入练习、错题本、成绩记录和个人中心，导航栏保留语言切换和退出入口。', '学生首页', '/', '前端路由', 'localStorage、users', 'home_trilingual.png'],
  ['FR-04 练习列表', '学生可查看已发布练习，列表展示试卷标题、说明、等级、题数和总分，内容随语言切换。', '练习列表', '/practice', '/api/learning/papers', 'papers、paper_translations、levels', 'practice_list_trilingual.png'],
  ['FR-05 在线答题', '学生进入试卷后逐题阅读题干、选项、分类和难度，选择答案后进入下一题或提交。', '答题详情', '/practice/1', '/api/learning/papers/:id', 'questions、question_options', 'practice_detail_trilingual.png'],
  ['FR-06 成绩记录', '学生提交后可查看历史练习标题、题数、正确数、错误数、得分和提交时间。', '成绩记录', '/records', '/api/learning/records', 'study_records、user_answers', 'records_trilingual.png'],
  ['FR-07 错题本', '系统根据答题结果维护错题数据，学生可查看错题复习入口、错误次数和解析信息。', '错题本', '/wrong-book', '/api/learning/wrong-questions', 'wrong_questions', 'wrong_book_trilingual.png'],
  ['FR-08 个人资料', '学生可维护姓名、邮箱、电话、国籍和语言偏好，后台按当前登录用户更新资料。', '个人中心', '/profile', '/api/auth/profile', 'users', 'profile_trilingual.png'],
  ['FR-09 管理看板', '管理员可查看学生数、题目数、练习数、答题记录和平均分等平台指标。', '管理台看板', '/admin', '/api/admin/stats', 'users、questions、papers、study_records', 'admin_dashboard_trilingual.png'],
  ['FR-10 学生管理查看', '管理员可查看用户编号、用户名、姓名、角色、学号、国籍、语言和状态。', '学生管理列表', '/admin/users', '/api/admin/users', 'users', 'admin_users_trilingual.png'],
  ['FR-11 题库管理查看', '管理员可查看题目标题、等级、分类、题型、难度、分值和状态。', '题库管理列表', '/admin/questions', '/api/admin/questions', 'questions、question_translations', 'admin_questions_trilingual.png'],
  ['FR-12 练习试卷查看', '管理员可查看练习试卷的类型、题目数量、总分、时长和发布状态。', '练习试卷列表', '/admin/papers', '/api/admin/papers', 'papers、paper_questions', 'admin_papers_trilingual.png'],
  ['FR-13 成绩管理查看', '管理员可查看全量学习记录，包括学生、练习、题数、正确数、错误数、分数和提交时间。', '成绩记录管理', '/admin/records', '/api/admin/records', 'study_records、users', 'admin_records_trilingual.png']
];

const modules = [
  ['认证与权限模块', '学生、管理员', '登录、注册、个人资料、JWT 校验、角色守卫', '/login、/register、/profile、/api/auth/*', 'users'],
  ['学生练习模块', '学生', '练习列表、试卷详情、逐题答题、提交判分', '/practice、/practice/:id、/api/learning/papers*', 'papers、questions、question_options'],
  ['成绩记录模块', '学生、管理员', '个人成绩查看、管理端全量成绩查看', '/records、/admin/records', 'study_records、user_answers'],
  ['错题复习模块', '学生', '错题收集、错误次数、解决状态、解析查看', '/wrong-book、/api/learning/wrong-questions', 'wrong_questions'],
  ['国际化模块', '学生、管理员', '中文、英文、马来语界面与题库内容切换', '顶部语言选择、lang 查询参数', 'translation 系列表'],
  ['管理看板模块', '管理员', '学生数、题目数、练习数、记录数、平均分统计', '/admin、/api/admin/stats', 'users、questions、papers、study_records'],
  ['题库与试卷管理查看模块', '管理员', '题库列表、练习试卷列表、题目和试卷基础状态查看', '/admin/questions、/admin/papers', 'questions、papers、paper_questions'],
  ['日志与运维模块', '运维人员', '请求日志、错误日志、数据库初始化、种子数据写入', 'logger.js、requestLogger.js、initDb.js', 'logs/app.log、schema.sql、seed.sql']
];

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function redact(text) {
  return text
    .replace(/Java@c1024/g, '***')
    .replace(/admin123456/g, '***')
    .replace(/student123456/g, '***')
    .replace(/dev_secret/g, '***')
    .replace(/[A-Z0-9._%+-]+@example\.local/gi, '***@***')
    .replace(/localhost:\d+/g, '***');
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function image(file, caption, cls = '') {
  return `<figure class="${cls}"><img src="${esc(file)}"><figcaption>${esc(caption)}</figcaption></figure>`;
}

function diagram(file) {
  return `../assets/diagrams/${file}`;
}

function screen(file) {
  return `../assets/screenshots_trilingual/${file}`;
}

function docCss() {
  return `<style>
@page { size: A4; margin: 18mm 14mm 18mm; }
body { font-family: "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; color:#202124; font-size:12px; line-height:1.62; }
h1 { text-align:center; font-size:25px; margin:8px 0 18px; letter-spacing:0; }
h2 { font-size:17px; margin:18px 0 8px; padding-bottom:4px; border-bottom:1.2px solid #2f3a45; page-break-after:avoid; }
h3 { font-size:14px; margin:13px 0 6px; page-break-after:avoid; }
p { margin:5px 0; text-align:justify; }
.cover { height:210mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; page-break-after:always; }
.cover .title { font-size:30px; font-weight:700; margin-bottom:18px; }
.cover .sub { font-size:18px; margin:4px 0; }
.muted { color:#5f6368; }
.summary { border-left:4px solid #49657d; padding:8px 12px; background:#f7f9fb; margin:10px 0; }
table { width:100%; border-collapse:collapse; margin:8px 0 12px; font-size:10.2px; border-top:1.4px solid #111; border-bottom:1.4px solid #111; page-break-inside:auto; }
thead { display:table-header-group; }
th { border-bottom:1px solid #111; text-align:left; font-weight:700; }
th,td { padding:4px 6px; vertical-align:top; }
figure { margin:10px 0 16px; text-align:center; page-break-inside:avoid; }
figure img { max-width:100%; object-fit:contain; }
figure.diagram img { max-height:170mm; }
figure.screen img { width:100%; max-height:155mm; border:1px solid #d0d7de; }
figcaption { margin-top:5px; font-size:10.5px; color:#333; text-align:center; }
.req-shot { page-break-before:auto; }
.toc p { margin:3px 0; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
</style>`;
}

function codeCss() {
  return `<style>
@page { size:A4; margin:17mm 13mm 16mm; }
body { font-family:"Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; color:#111; font-size:11.2px; line-height:1.5; }
h1 { text-align:center; font-size:22px; margin:8px 0 14px; }
h2 { font-size:15px; margin:13px 0 6px; border-bottom:1px solid #333; padding-bottom:3px; page-break-after:avoid; }
h3 { font-size:12px; margin:9px 0 4px; page-break-after:avoid; }
p { margin:3px 0; text-align:justify; }
table { width:100%; border-collapse:collapse; margin:7px 0 10px; font-size:9.5px; border-top:1.3px solid #111; border-bottom:1.3px solid #111; }
th { border-bottom:1px solid #111; }
th,td { padding:3px 5px; text-align:left; vertical-align:top; }
pre { margin:5px 0 12px; padding:7px 9px; border:1px solid #d8dee4; background:#fbfbfb; white-space:pre-wrap; word-break:break-word; font-family:"Noto Sans Mono CJK SC", "Noto Sans CJK SC", Consolas, monospace; font-size:9.9px; line-height:1.34; page-break-inside:auto; }
.file-meta { background:#f6f8fa; border-left:3px solid #49657d; padding:5px 8px; margin:4px 0 5px; }
.cover { height:200mm; display:flex; flex-direction:column; justify-content:center; align-items:center; page-break-after:always; text-align:center; }
.cover .title { font-size:28px; font-weight:700; margin-bottom:18px; }
</style>`;
}

function htmlWrap(title, css, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>${css}</head><body>${body}</body></html>`;
}

function designHtml() {
  const reqRows = requirements.map(([id, desc, page, route, api, tableName]) => [id, desc, page, route, api, tableName]);
  const reqSections = requirements.map(([id, desc, page, route, api, tableName, shot], index) => `
    <h3>${index + 1}. ${esc(id)}：${esc(page)}</h3>
    <p>${esc(desc)}该功能对应访问路径 ${esc(route)}，主要接口或路由为 ${esc(api)}，核心数据对象为 ${esc(tableName)}。下图采用中文、英文、马来语三语并排方式展示同一功能页面，便于核验国际化状态、页面布局一致性和业务字段展示效果。</p>
    ${image(screen(shot), `图 8-${index + 1} ${page}三语并排运行截图`, 'screen req-shot')}
  `).join('\n');

  const body = `
    <section class="cover">
      <div class="title">${softwareName}软件设计说明书</div>
      <div class="sub">软件版本：${version}</div>
      <div class="sub">文档类型：软件著作权登记材料</div>
      <div class="sub muted">前台目录：fronter　后台目录：admin</div>
    </section>
    <h1>${softwareName}软件设计说明书</h1>
    <div class="summary">本文档重新优化了版式结构、表格排版、图示位置和三语运行截图呈现方式。所有 H5 运行截图均按中文、英文、马来语三列并排展示，并按需求功能逐项插入。</div>

    <h2>1 引言</h2>
    <h3>1.1 编写目的</h3>
    <p>${softwareName}用于马来西亚留学生汉语练习与教学管理，本文档说明软件需求、模块、架构、流程、数据、接口、部署、安全和验证情况。文档中的运行截图来自真实启动的 H5 前台与后台管理界面，图示依据已核验源码、路由、接口和数据库脚本生成。</p>
    <h3>1.2 适用范围</h3>
    <p>软件包含学生端与管理端。学生端支持注册登录、三语界面、练习列表、在线答题、成绩记录、错题本和个人中心；管理端支持数据看板、学生管理查看、题库管理查看、练习试卷查看和成绩记录管理查看。后台提供认证、学习练习和管理查询 API，数据库负责用户、题库、试卷、成绩、错题和翻译数据存储。</p>

    <h2>2 需求分析</h2>
    <h3>2.1 功能需求清单</h3>
    ${table(['编号', '需求说明', '页面', '路由', '接口或入口', '数据对象'], reqRows)}
    <h3>2.2 非功能需求</h3>
    ${table(['类别', '要求', '实现依据'], [
      ['权限安全', '登录用户通过 JWT 访问受保护资源，管理员接口需要角色校验。', 'auth.js、role.js、router.beforeEach'],
      ['国际化', '界面文案和题库内容支持中文、英文、马来语。', 'i18n/index.js、*_translations 数据表、lang 查询参数'],
      ['数据一致性', '答题提交涉及学习记录、用户答案和错题本多表写入，需要事务保护。', 'tx 函数、/api/learning/papers/:id/submit'],
      ['运行审计', '后台记录请求路径、状态、耗时和异常信息，并脱敏敏感字段。', 'logger.js、requestLogger.js'],
      ['部署可维护', '前后台独立目录、独立 package 脚本，数据库可初始化。', 'admin、fronter、schema.sql、seed.sql']
    ])}

    <h2>3 系统概述</h2>
    <h3>3.1 用户角色与用例</h3>
    ${image(diagram('01_use_case.svg'), '图 3-1 横向用例图：学生与管理员两个角色并列展示，并连接到各自可访问的功能用例。该图用于说明软件的角色边界、权限范围和功能归属。', 'diagram')}
    <h3>3.2 模块结构表</h3>
    ${table(['模块', '服务角色', '核心职责', '页面或接口', '数据对象'], modules)}

    <h2>4 总体设计</h2>
    <h3>4.1 系统架构</h3>
    ${image(diagram('02_architecture.svg'), '图 4-1 系统架构图：前台 fronter、后台 admin 与 MySQL 数据库构成三层结构，前台负责页面、路由、国际化和 API 调用，后台负责认证、练习、管理、日志和数据库事务。', 'diagram')}
    <h3>4.2 部署结构</h3>
    ${image(diagram('03_deployment.svg'), '图 4-2 部署图：浏览器加载前端静态资源后调用后台 JSON API，后台通过连接池访问 MySQL，并将运行日志写入日志文件。部署地址在材料中按规则脱敏。', 'diagram')}

    <h2>5 详细设计</h2>
    <h3>5.1 答题流程设计</h3>
    ${image(diagram('04_practice_flow.svg'), '图 5-1 答题业务流程图：学生登录后选择练习、逐题作答、提交答案，后台计算分数并写入成绩、答案和错题本数据。该流程对应系统最核心的学习闭环。', 'diagram')}
    <h3>5.2 提交时序设计</h3>
    ${image(diagram('05_submit_sequence.svg'), '图 5-2 提交答案时序图：页面提交答案后，API Client 调用 learning 路由，后台在事务中查询正确答案、计算分数、写入记录并更新错题本，然后返回结果给前台。', 'diagram')}

    <h2>6 数据设计</h2>
    <h3>6.1 数据关系</h3>
    ${image(diagram('06_er.svg'), '图 6-1 ER 图：用户、题库、试卷、学习记录、用户答案和错题本共同支撑练习、判分、成绩回看和错题复习。', 'diagram')}
    <h3>6.2 数据表说明</h3>
    ${table(['表名', '核心字段', '字段用途和约束说明'], [
      ['users', 'id、username、password、role、student_no、language、status', '保存学生和管理员账号，username 唯一，role 区分 student/admin，status 控制账号可用状态。'],
      ['levels / level_translations', 'code、sort_order、language_code、name、description', '保存 HSK 和校园汉语等级，多语言表按 language_code 提供三语展示。'],
      ['question_categories / translations', 'parent_id、code、language_code、name', '保存拼音、词汇、语法、阅读等题目分类及多语言名称。'],
      ['questions / question_translations', 'level_id、category_id、question_type、difficulty、score、title、content、analysis', '保存题目主数据、题干、内容和解析，题目从属于等级和分类。'],
      ['question_options / translations', 'question_id、option_key、is_correct、sort_order、content', '保存选项、顺序和正确答案标记，选项内容支持三语。'],
      ['papers / paper_translations', 'paper_type、level_id、total_score、duration_minutes、title、description', '保存练习试卷基础信息和多语言标题说明。'],
      ['paper_questions', 'paper_id、question_id、sort_order、score', '维护试卷与题目的多对多关系和题目分值。'],
      ['study_records', 'user_id、paper_id、correct_count、wrong_count、total_score、duration_seconds', '保存学生每次提交的汇总成绩。'],
      ['user_answers', 'user_id、question_id、study_record_id、selected_option_ids、is_correct、score', '保存学生每题作答明细。'],
      ['wrong_questions', 'user_id、question_id、wrong_count、resolved、last_wrong_at', '保存错题次数、解决状态和最近出错时间。']
    ])}

    <h2>7 接口设计</h2>
    ${table(['接口', '方法', '角色', '功能说明'], [
      ['/api/health', 'GET', '公开', '服务健康检查。'],
      ['/api/auth/register', 'POST', '公开', '学生注册并写入 users。'],
      ['/api/auth/login', 'POST', '公开', '校验账号密码并返回 JWT。'],
      ['/api/auth/profile', 'GET/PUT', '登录用户', '查询或更新个人资料。'],
      ['/api/learning/papers', 'GET', '公开', '查询已发布练习列表。'],
      ['/api/learning/papers/:id', 'GET', '学生', '查询试卷详情、题目和选项。'],
      ['/api/learning/papers/:id/submit', 'POST', '学生', '提交答案、判分、写入成绩和错题。'],
      ['/api/learning/records', 'GET', '学生', '查询个人成绩记录。'],
      ['/api/learning/wrong-questions', 'GET', '学生', '查询个人错题本。'],
      ['/api/admin/stats', 'GET', '管理员', '查询管理台统计指标。'],
      ['/api/admin/users', 'GET', '管理员', '查询用户列表。'],
      ['/api/admin/questions', 'GET', '管理员', '查询题库列表。'],
      ['/api/admin/papers', 'GET', '管理员', '查询练习试卷列表。'],
      ['/api/admin/records', 'GET', '管理员', '查询全量成绩记录。']
    ])}

    <h2>8 功能截图与三语界面</h2>
    <p>本章按需求功能逐项放置运行截图。每张图均由同一页面的中文、英文、马来语界面横向合成，截图经过等比缩放，保证页面整体结构可见且不拉伸变形。</p>
    ${reqSections}

    <h2>9 运行与部署设计</h2>
    <p>后台位于 admin 目录，提供 npm run db:init、npm run seed:users、npm run dev 和 npm start。前台位于 fronter 目录，提供 npm run dev、npm run build 和 npm run preview。数据库初始化脚本位于 admin/sql，前端生产构建输出为静态资源，可交由 Web 服务托管。接口地址、主机信息和数据库连接信息在文档中均按脱敏规则处理。</p>

    <h2>10 安全、日志与异常处理</h2>
    <p>系统使用 bcryptjs 对密码进行哈希存储，登录成功后生成 JWT。前端路由根据登录态和角色控制页面访问，后台中间件对接口进行令牌校验和角色校验。日志模块记录 HTTP 请求状态、路径、耗时和用户标识，错误处理中记录异常信息，并对 authorization、password、token 等字段进行脱敏，降低运行日志泄露风险。</p>

    <h2>11 测试与验证</h2>
    <p>已完成数据库初始化、种子用户写入、前端生产构建、接口 smoke test、数据库结构核验和浏览器运行截图采集。数据库核验结果为 17 张表齐全、23 个外键存在、试卷题目无孤儿关联，题库三语翻译数据完整。接口验证覆盖学生登录、练习列表、试卷详情、答题提交、成绩记录、管理员登录、管理统计和用户列表。</p>

    <h2>12 结论</h2>
    <p>${softwareName}已经形成学生端学习练习与管理端教学查看两条主线。系统模块边界明确，数据关系完整，三语界面和题库内容可运行验证，后台日志与权限控制已接入，能够满足当前软件著作权登记材料的软件设计说明要求。</p>
  `;
  return htmlWrap(`${softwareName}软件设计说明书`, docCss(), body);
}

function describeFile(file) {
  if (file.includes('/routes/auth')) return '注册、登录、个人资料查询和资料更新接口。';
  if (file.includes('/routes/learning')) return '等级、分类、练习列表、试卷详情、答题提交、成绩记录和错题本接口。';
  if (file.includes('/routes/admin')) return '管理台统计、用户列表、题库列表、试卷列表和成绩记录列表接口。';
  if (file.includes('/middleware/auth')) return 'JWT 解析和登录态校验中间件。';
  if (file.includes('/middleware/role')) return '管理员角色授权中间件。';
  if (file.includes('/middleware/requestLogger')) return 'HTTP 请求状态、耗时和用户标识日志中间件。';
  if (file.includes('/utils/logger')) return '日志文件写入、控制台输出和敏感字段脱敏工具。';
  if (file.includes('/config/db')) return 'MySQL 连接池配置和事务封装。';
  if (file.endsWith('schema.sql')) return '数据库和业务表结构定义脚本。';
  if (file.endsWith('seed.sql')) return '等级、分类、试卷、题目、选项和三语内容初始化脚本。';
  if (file.includes('/router/')) return '前台路由和权限守卫定义。';
  if (file.includes('/api/client')) return 'HTTP 请求、JSON 载荷和 Authorization 请求头封装。';
  if (file.includes('/i18n/')) return '三语界面文案和语言状态维护。';
  if (file.endsWith('.vue')) return 'Vue 前台或管理端页面组件。';
  if (file.endsWith('style.css')) return '前台页面通用样式。';
  return '项目运行、构建或说明配置。';
}

async function sourceHtml() {
  const rows = sourceFiles.map((file) => [file, file.startsWith('admin') ? '后台/数据层' : file.startsWith('fronter') ? '前台页面层' : '项目配置', describeFile(file)]);
  const sections = [];
  for (const file of sourceFiles) {
    const abs = path.join(root, file);
    const raw = redact(await fs.readFile(abs, 'utf8')).trimEnd();
    const numbered = raw.split(/\r?\n/).map((line, index) => `${String(index + 1).padStart(4, ' ')}  ${line}`).join('\n');
    sections.push(`
      <h2>文件：${esc(file)}</h2>
      <div class="file-meta">职责：${esc(describeFile(file))}<br>模块：${esc(file.startsWith('admin') ? '后台服务与数据层' : file.startsWith('fronter') ? '前台 H5 页面层' : '项目配置与说明')}</div>
      <pre>${esc(numbered)}</pre>
    `);
  }
  const body = `
    <section class="cover">
      <div class="title">${softwareName}源代码</div>
      <p>软件版本：${version}</p>
      <p>源码范围：admin、fronter、数据库脚本和项目配置</p>
    </section>
    <h1>${softwareName}源代码</h1>
    <h2>1 源代码属性结构说明</h2>
    <p>本源码稿由后台服务、前台 H5 页面、数据库脚本和项目配置组成。后台 admin 使用 Node.js、Express、mysql2、JWT、bcryptjs 实现认证、练习、管理、日志和数据库事务；前台 fronter 使用 Vue 3、Vue Router、Vite、CSS 和原生状态对象实现学生端、管理端和三语界面；数据库脚本创建并初始化用户、等级、分类、题库、试卷、成绩、错题和翻译数据。</p>
    <p>源码稿排除了 node_modules、dist、运行日志、浏览器缓存和第三方依赖源码。涉及密码、令牌、邮箱、主机地址和数据库口令的内容均在输出前进行了脱敏处理。为提高审阅可读性，源码正文按文件逐项列出，保留真实相对路径、文件职责、所属模块和带行号的源码正文。</p>
    <h2>2 目录与模块结构</h2>
    ${table(['文件路径', '所属层次', '文件职责'], rows)}
    <h2>3 源码正文</h2>
    ${sections.join('\n')}
  `;
  return htmlWrap(`${softwareName}源代码`, codeCss(), body);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  return {
    send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      ws.close();
    }
  };
}

async function printPdf(htmlFile, pdfFile, title) {
  const proc = spawn('/opt/google/chrome/chrome', [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--font-render-hinting=medium',
    'about:blank'
  ], { stdio: 'ignore' });
  try {
    await wait(1200);
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).catch(() => {});
    const targets = await json(`http://127.0.0.1:${port}/json`);
    const page = targets.find((target) => target.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `file://${htmlFile}` });
    await wait(1000);
    const result = await cdp.send('Page.printToPDF', {
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#555;">${softwareName} ${version}</div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#555;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      marginTop: 0.55,
      marginBottom: 0.55,
      marginLeft: 0.45,
      marginRight: 0.45,
      paperWidth: 8.27,
      paperHeight: 11.69
    });
    await fs.writeFile(pdfFile, Buffer.from(result.data, 'base64'));
    cdp.close();
  } finally {
    proc.kill('SIGTERM');
  }
}

async function syncArchiveAssets() {
  await fs.mkdir(archiveScreens, { recursive: true });
  const triDir = path.join(root, 'docs', 'assets', 'screenshots_trilingual');
  for (const file of await fs.readdir(triDir)) {
    await fs.copyFile(path.join(triDir, file), path.join(archiveScreens, file));
  }
  await fs.copyFile(path.join(root, 'docs', 'assets', 'diagrams', '01_use_case.svg'), path.join(archiveDiagrams, '01_use_case.svg'));
  await fs.copyFile(path.join(root, 'docs', 'assets', 'diagrams', '01_use_case.txt'), path.join(archiveDiagrams, '01_use_case.txt'));
}

async function main() {
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(pdfDir, { recursive: true });
  await syncArchiveAssets();
  const designPath = path.join(docsDir, '软件设计说明书.optimized.html');
  const sourcePath = path.join(docsDir, `${softwareName}源代码.optimized.html`);
  await fs.writeFile(designPath, designHtml(), 'utf8');
  await fs.writeFile(sourcePath, await sourceHtml(), 'utf8');
  await printPdf(designPath, path.join(pdfDir, '软件设计说明书.pdf'), '软件设计说明书');
  await printPdf(sourcePath, path.join(pdfDir, `${softwareName}源代码.pdf`), `${softwareName}源代码`);
  console.log(designPath);
  console.log(sourcePath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
