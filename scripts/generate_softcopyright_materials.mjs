import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const softwareName = '马来西亚留学生汉语练习平台';
const version = 'V1.0';
const archiveName = `${softwareName}${version}`;
const docsDir = path.join(root, 'docs', 'softcopyright');
const screenshotsDir = path.join(root, 'docs', 'assets', 'screenshots');
const diagramsDir = path.join(root, 'docs', 'assets', 'diagrams');
const archiveDir = path.join(root, '软著', archiveName);

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
  'fronter/package.json'
];

const screenshotDescriptions = {
  '01_practice_zh.png': '中文练习列表页面截图，访问路径为 /practice。页面展示学生登录后的练习入口，包括顶部导航、语言切换控件、练习标题、练习说明、等级名称、题目数量和试卷总分等内容。该截图用于证明系统能够从后台 MySQL 题库读取已发布试卷，并在前台以中文界面呈现练习资源，体现学生端核心学习入口和国际化界面能力。',
  '02_home_zh.png': '中文首页截图，访问路径为 /。页面展示系统名称、练习入口、错题本入口和成绩入口，顶部导航根据当前学生登录状态展示练习、成绩、错题本、个人中心及退出按钮。该截图用于说明平台首页作为学生端主导航页，能够将练习、错题复习和学习成绩三个主要学习场景集中呈现，形成清晰的学习闭环入口。',
  '03_wrong_book_zh.png': '中文错题本页面截图，访问路径为 /wrong-book。页面展示错题本标题和当前错题数据状态，顶部导航仍保留学生常用功能入口。该截图用于说明系统具备错题归集和复习入口，后台在答题提交时会依据答题结果更新 wrong_questions 数据表，页面负责向学生展示待复习题目、错误次数和解析信息。',
  '04_records_zh.png': '中文成绩记录页面截图，访问路径为 /records。页面以表格方式展示练习标题、题目数量、正确数、错误数、得分和提交时间。该截图用于证明系统能够记录学生答题行为，并从 study_records 表读取个人历史成绩，支持学习过程追踪、成绩回看和练习效果评估。',
  '05_profile_zh.png': '中文个人中心页面截图，访问路径为 /profile。页面展示姓名、邮箱、电话、国籍、语言等个人资料表单，并提供提交保存入口。该截图用于说明系统支持学生资料维护和语言偏好设置，前端表单与 /api/auth/profile 接口关联，后台按当前登录用户更新 users 表中的个人字段。',
  '06_home_en.png': '英文首页截图，访问路径为 /，通过顶部语言下拉框切换到 English 后采集。页面标题、导航和入口卡片均切换为英文文案。该截图用于说明系统具备前端国际化能力，静态导航文案来自前端 i18n 资源，学习数据则可通过接口 lang 参数读取数据库中的多语言翻译字段。',
  '07_practice_en.png': '英文练习列表页面截图，访问路径为 /practice，语言为 English。页面中的练习标题、说明、等级和字段标签以英文展示。该截图用于展示练习数据的多语言输出能力，说明前端语言状态会影响接口查询参数，后台按 language_code 从试卷、等级、题目分类等翻译表中读取对应语言内容。',
  '08_admin_dashboard_zh.png': '中文管理台数据看板截图，访问路径为 /admin。页面展示学生数、题目数、练习数、平均分等统计指标，并提供学生管理、题库、练习试卷和成绩记录入口。该截图用于证明管理员角色登录后可以访问后台管理功能，系统通过 JWT 与角色守卫限制管理页面和管理接口。',
  '09_admin_questions_zh.png': '中文题库管理列表截图，访问路径为 /admin/questions。页面以表格展示题目 ID、标题、等级、分类、题型、难度、分值和状态。该截图用于说明管理端可以查看题库资源和三语题目数据，为后续题库维护、练习编排和教学管理提供数据基础。'
};

const diagramDescriptions = {
  '01_use_case.svg': '用例图展示学生和管理员两个角色与系统功能之间的关系。学生侧覆盖注册登录、语言切换、查看练习、在线答题、成绩记录、错题本和个人资料维护；管理员侧覆盖管理台统计、学生列表、题库列表、试卷列表和成绩记录查看。该图用于概括软件的角色边界和功能范围。',
  '02_architecture.svg': '系统架构图展示 fronter 前台、admin 后台和 MySQL 数据库之间的分层关系。前台包含路由、国际化、认证状态、学生页面、管理页面和 API 请求封装；后台包含 Express 应用、鉴权中间件、日志模块、认证接口、学习接口、管理接口和数据库连接池。该图用于说明系统主要技术构成和调用方向。',
  '03_deployment.svg': '部署图说明用户浏览器、Web 前端运行环境、应用服务器和 MySQL 数据库的部署关系。浏览器访问静态资源，Vue 前台调用后台 /api 接口，后台通过连接池访问数据库并写入 logs/app.log 日志文件。该图用于描述系统运行支撑环境和服务间通信路径。',
  '04_practice_flow.svg': '业务流程图描述学生从登录、进入练习列表、选择试卷、逐题作答到提交并生成成绩和错题记录的完整流程。流程中包含未全部作答时的提示分支，以及错题更新和已解决标记逻辑。该图用于说明练习答题主链路和后台事务处理结果。',
  '05_submit_sequence.svg': '提交时序图展示学生页面、API Client、learning 路由、事务处理和 MySQL 之间的调用顺序。页面提交答案后，后台查询正确选项、计算得分、写入学习记录、写入用户答案并更新错题本，最后返回结果给页面展示。该图用于解释答题提交接口的协作过程。',
  '06_er.svg': 'ER 图展示 users、levels、question_categories、questions、question_options、papers、paper_questions、study_records、user_answers、wrong_questions 等核心数据表之间的关系。该图用于说明题库、试卷、学生答题记录和错题本之间的数据关联，是数据设计章节的重要依据。'
};

function redact(text) {
  return text
    .replace(/Java@c1024/g, '***')
    .replace(/admin123456/g, '***')
    .replace(/student123456/g, '***')
    .replace(/[A-Z0-9._%+-]+@example\.local/gi, '***@***')
    .replace(/localhost:\d+/g, '***')
    .replace(/http:\/\/\*\*\*\/api/g, 'http://***/api')
    .replace(/dev_secret/g, '***');
}

async function ensureDirs() {
  const dirs = [
    docsDir,
    screenshotsDir,
    diagramsDir,
    path.join(archiveDir, 'pdf'),
    path.join(archiveDir, 'text'),
    path.join(archiveDir, 'images', 'diagrams'),
    path.join(archiveDir, 'images', 'screenshots')
  ];
  for (const dir of dirs) await fs.mkdir(dir, { recursive: true });
}

function informationTxt() {
  return `软件名称：${softwareName}
版本号：${version}
开发的硬件环境：普通 PC 或笔记本开发工作站，建议 4 核及以上 CPU、16GB 及以上内存、固态硬盘，能够同时运行 Node.js、Vite 开发服务、MySQL 数据库和浏览器调试工具。
运行的硬件环境：可部署在普通 Linux/Windows 应用服务器或教学机房服务器上，建议 2 核及以上 CPU、4GB 及以上内存、20GB 及以上可用磁盘空间；学生端和管理端通过桌面或移动浏览器访问。
开发该软件的操作系统：Linux 开发环境，当前核验环境为 Asia/Shanghai 时区的本地工作区；软件也可在安装 Node.js 和 MySQL 的 Windows 或 Linux 环境中开发调试。
软件开发环境 / 开发工具：Node.js、npm、Vue 3、Vite、Express、mysql2、MySQL、Chromium 浏览器、PlantUML、命令行终端和接口调试工具；前端目录为 fronter，后台目录为 admin。
该软件的运行平台 / 操作系统：浏览器端 H5 Web 应用，后台运行于 Node.js 运行时，数据库运行于 MySQL；支持在 Windows、Linux、macOS 的现代浏览器中访问前台和管理台。
软件运行支撑环境 / 支持软件：Node.js、npm、MySQL 8.x 或兼容版本、支持 ES Module 的 JavaScript 运行环境、现代浏览器；后台通过 Express 提供 JSON API，前台通过 Vite 构建为静态资源。
编程语言：JavaScript、Vue 单文件组件、HTML、CSS、SQL。
源程序量：按 admin/src、admin/sql、fronter/src 等自研核心源码统计，共 33 个主要源码/脚本文件，约 1624 行核心业务代码和 SQL，不包含 node_modules、dist、package-lock、日志文件和第三方依赖源码。
开发目的：建设面向马来西亚留学生的汉语练习平台，为学生提供多语言界面的汉语练习、在线答题、成绩回看和错题复习能力，为教学管理人员提供题库、练习试卷、学生与成绩数据的管理查看入口，帮助学习者围绕 HSK 入门和校园汉语场景进行持续练习。
面向行业 / 领域：教育信息化、国际中文教育、留学生汉语学习、在线练习与教学管理领域。
软件的主要功能：本软件面向马来西亚留学生汉语学习场景，提供学生端和管理端两类角色功能。学生可通过注册登录进入系统，系统使用 JWT 保存登录状态，并通过路由守卫限制未登录用户访问练习、成绩、错题本和个人中心。学生登录后可在首页进入练习列表，系统根据当前语言读取已发布练习试卷、等级、题目数量和总分信息；进入试卷详情后可逐题查看题干、内容、选项、分类、难度和解析，完成所有题目后提交答案，后台按正确选项计算正确数、错误数和总得分，并写入学习记录、用户答案和错题本数据。学生可在成绩页面查看历史练习记录，包括练习标题、题目数量、正确数、错误数、得分和提交时间；可在错题本页面查看历史错题、错误次数和解析，方便针对薄弱知识点复习；可在个人中心维护姓名、邮箱、电话、国籍和语言偏好。系统支持中文、英文、马来语三种界面语言，前端导航和按钮文案来自国际化资源，题库、等级、分类、试卷、题目、选项和解析等学习内容由数据库多语言翻译表提供。管理员登录后可进入管理台查看学生数、题目数、练习数、答题记录数和平均分，可查看学生列表、题库列表、练习试卷列表和成绩记录列表，掌握平台教学资源与学习数据。后台还提供数据库初始化、演示题库和种子账号脚本，并新增请求日志与错误日志模块，便于部署后的运行审计和问题排查。
软件的技术特点：系统采用前后端分离架构，前台 fronter 使用 Vue 3、Vue Router、Vite 和原生状态对象构建 H5 页面，后台 admin 使用 Node.js、Express、mysql2/promise 和 MySQL 连接池提供 REST 风格 JSON API。后台按认证、学习练习和管理统计拆分路由，使用 JWT 实现登录态校验，使用角色中间件限制管理员接口，使用事务封装保证答题提交时 study_records、user_answers 和 wrong_questions 等多表写入一致性。数据库采用 utf8mb4 字符集，围绕用户、等级、分类、题目、选项、试卷、答题记录、错题本和国际化消息设计 17 张表，并通过外键维护主要数据关系。系统内置 schema.sql、seed.sql、initDb.js 和 seedUsers.js，可快速完成库表初始化和演示数据写入。新增日志模块会记录接口请求、响应状态、耗时和异常信息，并对令牌、密码等敏感字段进行脱敏，日志默认写入后台 logs/app.log。前端通过 VITE_API_BASE 支持 API 地址配置，默认指向脱敏后的本地 API 地址，构建产物可部署为静态资源。
推荐软件名称：${softwareName}
软件名称候选：马来西亚留学生汉语练习平台、留学生汉语在线练习管理系统、国际中文学习练习平台、三语汉语题库练习管理软件
推荐理由：当前名称与 README、页面标题、学生练习场景、三语题库和管理台功能范围一致，能够覆盖学生端练习与后台教学管理两类核心能力。`;
}

async function writeDescriptions() {
  for (const [file, text] of Object.entries(screenshotDescriptions)) {
    await fs.writeFile(path.join(screenshotsDir, file.replace(/\.\w+$/, '.txt')), text, 'utf8');
  }
  for (const [file, text] of Object.entries(diagramDescriptions)) {
    await fs.writeFile(path.join(diagramsDir, file.replace(/\.\w+$/, '.txt')), text, 'utf8');
  }
}

async function sourceMarkdown() {
  const lines = [
    `# ${softwareName}源代码`,
    '',
    `软件名称：${softwareName}`,
    '',
    `版本号：${version}`,
    '',
    '## 源代码属性结构说明',
    '',
    '本源码由后台 admin、前台 fronter 和数据库脚本三部分组成。后台使用 Node.js、Express、mysql2 和 MySQL 连接池提供认证、学习练习、管理统计、日志记录和数据库初始化能力；前台使用 Vue 3、Vue Router 和 Vite 提供学生端练习页面、管理端看板页面、国际化界面和 API 调用封装；数据库脚本负责创建用户、等级、分类、题库、试卷、答题记录、错题本和国际化消息等业务表。',
    '',
    '选入源码稿的范围包括 admin/src、admin/sql、fronter/src 以及两个 package.json 中与系统运行直接相关的配置。已排除 node_modules、dist、package-lock、日志文件和第三方依赖源码。源码中涉及密码、令牌、邮箱、主机地址和数据库连接敏感值均已脱敏。',
    '',
    '## 三级目录结构',
    '',
    '- admin/src：后台应用入口、路由、中间件、配置和工具模块',
    '- admin/sql：数据库建表和演示题库初始化脚本',
    '- fronter/src：前台入口、路由、状态、国际化、页面组件和样式',
    '- package.json：前后台运行脚本和依赖配置',
    ''
  ];
  for (const file of sourceFiles) {
    const abs = path.join(root, file);
    const code = redact(await fs.readFile(abs, 'utf8'));
    const moduleName = file.startsWith('admin/sql') ? '数据库脚本模块' : file.startsWith('admin') ? '后台服务模块' : file.startsWith('fronter') ? '前台页面模块' : '项目配置模块';
    lines.push(`## 文件：${file}`, '');
    lines.push(`文件职责：${describeFile(file)}`);
    lines.push(`所属模块：${moduleName}`, '');
    lines.push('```' + languageOf(file));
    lines.push(code.trimEnd());
    lines.push('```', '');
  }
  return lines.join('\n');
}

function describeFile(file) {
  if (file.includes('/routes/auth')) return '提供注册、登录、个人资料查询和个人资料更新接口。';
  if (file.includes('/routes/learning')) return '提供等级、分类、练习列表、试卷详情、答题提交、成绩记录和错题本接口。';
  if (file.includes('/routes/admin')) return '提供管理台统计、学生列表、题库列表、试卷列表和成绩记录列表接口。';
  if (file.includes('/middleware/auth')) return '解析 JWT 并完成接口登录态校验。';
  if (file.includes('/middleware/role')) return '按用户角色限制管理员接口访问。';
  if (file.includes('/middleware/requestLogger')) return '记录 HTTP 请求状态、路径、耗时和用户标识。';
  if (file.includes('/utils/logger')) return '提供控制台和文件双写的日志工具，并脱敏敏感字段。';
  if (file.includes('/config/db')) return '配置 MySQL 连接池和事务封装。';
  if (file.endsWith('schema.sql')) return '创建系统所需数据库、业务表、唯一约束和外键。';
  if (file.endsWith('seed.sql')) return '写入等级、分类、试卷、题目、选项和多语言演示题库。';
  if (file.includes('router')) return '定义前台页面路由和登录、管理员访问守卫。';
  if (file.includes('api/client')) return '封装前台 HTTP JSON 请求和令牌请求头。';
  if (file.includes('i18n')) return '维护中文、英文、马来语界面文案和语言切换状态。';
  if (file.endsWith('.vue')) return '实现前台或管理端页面组件。';
  return '提供系统运行所需的入口、配置或支撑逻辑。';
}

function languageOf(file) {
  if (file.endsWith('.vue')) return 'vue';
  if (file.endsWith('.sql')) return 'sql';
  if (file.endsWith('.css')) return 'css';
  if (file.endsWith('.json')) return 'json';
  return 'js';
}

function designMarkdown() {
  const screenshots = Object.keys(screenshotDescriptions);
  const diagrams = Object.keys(diagramDescriptions);
  return `# ${softwareName}软件设计说明书

软件名称：${softwareName}

版本号：${version}

## 1 引言

### 1.1 编写目的

本文档说明${softwareName}的需求范围、系统结构、功能模块、数据设计、接口设计、部署运行方式、安全权限和测试验证情况。文档内容依据当前可运行代码、数据库脚本、接口行为、真实运行截图和代码推导图示整理，用于软件著作权登记材料中的软件设计说明。

### 1.2 软件范围

系统面向马来西亚留学生汉语练习场景，提供学生端 H5 学习入口和管理员后台管理入口。学生端覆盖注册登录、三语界面、练习列表、在线答题、成绩记录、错题本和个人中心；管理端覆盖数据看板、学生列表、题库列表、试卷列表和成绩记录列表。后台提供认证、学习练习和管理查询 API，数据库提供题库、试卷、用户、答题、错题和翻译数据存储。

## 2 需求分析

### 2.1 功能需求

1. 用户认证需求：系统应支持学生注册、学生登录、管理员登录、JWT 登录态保存和个人资料维护，对应前台 Login、Register、Profile 页面和后台 /api/auth 系列接口。
2. 学生练习需求：系统应支持学生查看已发布练习列表、进入练习详情、逐题选择答案、提交答案并查看练习结果，对应 PracticeList、PracticeDetail 页面和 /api/learning/papers 接口。
3. 学习记录需求：系统应保存学生每次提交的题目数量、正确数、错误数、总分、答题时长和提交时间，对应 study_records、user_answers 数据表和 Records 页面。
4. 错题复习需求：系统应在学生答错题目时更新错题本，答对历史错题时标记解决状态，对应 wrong_questions 数据表和 WrongBook 页面。
5. 国际化需求：系统应支持中文、英文、马来语三种界面和题库内容展示，前端静态文案由 i18n 资源维护，题库内容由多语言翻译表提供。
6. 管理端需求：管理员应能查看平台数据统计、学生列表、题库列表、试卷列表和成绩记录，对应 Dashboard、AdminTable 页面和 /api/admin 系列接口。
7. 日志运维需求：后台应记录请求状态、路径、耗时、用户标识和异常信息，支持运行审计和问题排查，对应 logger.js 与 requestLogger.js。

### 2.2 非功能需求

系统应具备清晰的前后端分离结构，前台可以独立构建为静态资源，后台可独立运行在 Node.js 环境中。数据库采用 utf8mb4 字符集以支持中文、英文、马来语和拼音字符。认证令牌、密码、数据库口令和接口地址在文档与日志中应进行脱敏。核心答题提交流程应使用事务保证多表写入一致性。

## 3 系统概述

### 3.1 角色和用例

![用例图](../assets/diagrams/01_use_case.svg)

图 3-1 用例图。该图展示学生和管理员两个角色与系统功能的对应关系。学生侧功能围绕学习闭环展开，包括注册登录、练习列表、在线答题、成绩回看、错题复习、个人资料维护和语言切换；管理员侧功能围绕教学管理展开，包括数据看板、学生列表、题库列表、试卷列表和成绩记录。该图用于明确软著材料中的用户边界、业务入口和功能归属，避免将学生功能与管理功能混同。

### 3.2 模块结构

| 模块 | 角色 | 页面或接口 | 数据对象 |
| --- | --- | --- | --- |
| 认证与资料模块 | 学生、管理员 | /login、/register、/profile、/api/auth | users |
| 学习练习模块 | 学生 | /practice、/practice/:id、/api/learning/papers | papers、questions、question_options |
| 成绩记录模块 | 学生、管理员 | /records、/admin/records | study_records、user_answers |
| 错题本模块 | 学生 | /wrong-book、/api/learning/wrong-questions | wrong_questions |
| 题库管理查看模块 | 管理员 | /admin/questions | questions、question_translations |
| 系统统计模块 | 管理员 | /admin、/api/admin/stats | users、questions、papers、study_records |
| 国际化模块 | 学生、管理员 | 顶部语言切换、lang 参数 | level_translations、paper_translations、question_translations |

## 4 总体设计

### 4.1 系统架构

![系统架构图](../assets/diagrams/02_architecture.svg)

图 4-1 系统架构图。该图说明系统由 fronter 前台、admin 后台和 MySQL 数据库组成。前台负责路由、界面渲染、国际化、登录状态和 API 请求封装；后台负责认证、学习练习、管理查询、日志记录、数据库连接池和事务控制；数据库保存用户、题库、试卷、答题、错题和翻译数据。该图体现了前后端分离、接口解耦和数据集中存储的总体结构。

### 4.2 部署结构

![部署图](../assets/diagrams/03_deployment.svg)

图 4-2 部署图。该图描述浏览器、Web 前端运行环境、应用服务器和 MySQL 数据库之间的部署关系。用户浏览器加载前端静态资源后，通过脱敏后的 /api 地址访问后台接口；后台运行在 Node.js 环境中，通过 MySQL 连接池访问数据库，并将请求和异常写入日志文件。该图用于说明软件运行支撑环境、服务边界和部署节点职责。

## 5 详细设计

### 5.1 答题业务流程

![答题流程图](../assets/diagrams/04_practice_flow.svg)

图 5-1 答题流程图。该图说明学生从登录、查看练习列表、选择试卷、逐题作答到提交结果的完整流程。流程中特别体现了未全部作答时的前台提示、提交后的后台判分、学习记录写入、用户答案写入和错题本更新逻辑。该图对应 PracticeDetail 页面和 /api/learning/papers/{id}/submit 接口，是系统学习闭环的关键流程。

### 5.2 提交答案时序

![提交答案时序图](../assets/diagrams/05_submit_sequence.svg)

图 5-2 提交答案时序图。该图展示学生页面、API Client、learning 路由、事务封装和 MySQL 之间的调用顺序。后台在事务中查询正确答案、计算得分、写入 study_records、写入 user_answers 并更新 wrong_questions，最后将结果返回给前台展示。该图用于解释多表写入如何保持一致，以及答题结果如何驱动成绩和错题数据更新。

## 6 数据设计

### 6.1 ER 关系

![ER 图](../assets/diagrams/06_er.svg)

图 6-1 ER 图。该图展示用户、等级、分类、题目、选项、试卷、试卷题目、学习记录、用户答案和错题本之间的核心关联。题目从属于等级和分类，试卷通过 paper_questions 组织题目，学生提交后生成 study_records 和 user_answers，答错题目进入 wrong_questions。该图用于说明系统数据模型如何支撑题库、练习、成绩和错题复习功能。

### 6.2 核心数据表

| 表名 | 主要字段 | 用途说明 |
| --- | --- | --- |
| users | id、username、password、role、language、status | 保存学生和管理员账号、角色、语言偏好和状态 |
| levels | id、code、sort_order、status | 保存 HSK 或校园汉语等级 |
| level_translations | level_id、language_code、name、description | 保存等级多语言名称和说明 |
| question_categories | id、parent_id、code、status | 保存拼音、词汇、语法、阅读等题目分类 |
| question_category_translations | category_id、language_code、name | 保存题目分类多语言信息 |
| questions | id、level_id、category_id、question_type、difficulty、score、status | 保存题目主数据 |
| question_translations | question_id、language_code、title、content、analysis | 保存题干、内容和解析的多语言文本 |
| question_options | question_id、option_key、is_correct、sort_order | 保存选项主数据和正确答案标记 |
| question_option_translations | option_id、language_code、content | 保存选项多语言内容 |
| papers | id、paper_type、level_id、total_score、duration_minutes、status | 保存练习或试卷主数据 |
| paper_questions | paper_id、question_id、sort_order、score | 保存试卷与题目的关联关系 |
| study_records | user_id、paper_id、correct_count、wrong_count、total_score | 保存学生提交记录和成绩 |
| user_answers | user_id、question_id、study_record_id、selected_option_ids、is_correct | 保存学生每题作答明细 |
| wrong_questions | user_id、question_id、wrong_count、resolved | 保存学生错题和复习状态 |

## 7 接口设计

| 接口 | 方法 | 角色 | 功能 |
| --- | --- | --- | --- |
| /api/health | GET | 公开 | 健康检查 |
| /api/auth/register | POST | 公开 | 学生注册 |
| /api/auth/login | POST | 公开 | 用户登录并返回 JWT |
| /api/auth/profile | GET/PUT | 登录用户 | 查询和更新个人资料 |
| /api/learning/papers | GET | 公开 | 查询已发布练习列表 |
| /api/learning/papers/:id | GET | 学生 | 查询试卷详情和题目选项 |
| /api/learning/papers/:id/submit | POST | 学生 | 提交答案并生成成绩和错题记录 |
| /api/learning/records | GET | 学生 | 查询个人成绩记录 |
| /api/learning/wrong-questions | GET | 学生 | 查询个人错题本 |
| /api/admin/stats | GET | 管理员 | 查询管理台统计指标 |
| /api/admin/users | GET | 管理员 | 查询学生和用户列表 |
| /api/admin/questions | GET | 管理员 | 查询题库列表 |
| /api/admin/papers | GET | 管理员 | 查询试卷列表 |
| /api/admin/records | GET | 管理员 | 查询全量成绩记录 |

## 8 页面与运行截图

${screenshots.map((file, index) => `![运行截图 ${index + 1}](../assets/screenshots/${file})

图 8-${index + 1} ${screenshotDescriptions[file]}`).join('\n\n')}

## 9 运行与部署设计

后台目录为 admin，可通过 npm run db:init 初始化数据库和演示题库，通过 npm run seed:users 写入演示用户，通过 npm run dev 或 npm start 启动 Express 服务。前台目录为 fronter，可通过 npm run dev 启动开发服务，通过 npm run build 构建生产静态资源。前台默认 API 地址已在文档中脱敏，实际部署可通过 VITE_API_BASE 配置。数据库连接信息通过环境变量覆盖，文档和日志不保留真实敏感值。

## 10 安全与权限设计

系统使用 bcryptjs 对密码进行哈希存储，登录成功后使用 JWT 生成 7 天有效令牌。前端路由守卫根据本地登录态限制学生页面和管理员页面访问，后台 auth 中间件验证令牌，role 中间件限制管理员接口。日志模块会对 authorization、password、token 等字段做脱敏，避免运行日志直接暴露敏感认证信息。

## 11 脚本与运维

系统提供 schema.sql、seed.sql、initDb.js 和 seedUsers.js。schema.sql 创建数据库和 17 张业务表，seed.sql 写入等级、分类、试卷、题目、选项及三语翻译数据，initDb.js 顺序执行建表和演示题库脚本，seedUsers.js 写入管理员和学生演示账号。后台日志默认写入 admin/logs/app.log，可通过 LOG_DIR 改写日志目录。

## 12 测试与验证

本次核验已执行数据库初始化、种子账号写入、前端生产构建、数据库结构查询、接口 smoke test 和浏览器真实页面截图。数据库核验结果为 17 张表全部存在、23 个外键存在、试卷题目无孤儿关联、题目翻译覆盖中文、英文和马来语。接口 smoke test 覆盖健康检查、学生登录、练习列表、试卷详情、答题提交、成绩记录、管理员登录、管理统计和用户列表。前端构建通过 Vite 完成，浏览器截图验证学生端和管理端页面可真实访问。

## 13 结论

${softwareName}已具备学生端汉语练习、三语展示、在线答题、成绩记录、错题复习、个人资料维护和管理员数据查看等核心功能。系统结构清晰，数据库表关系完整，接口能够支撑主要业务流程，日志模块已接入后台请求和错误处理链路，可作为软件著作权登记的软件设计说明材料。`;
}

async function copyAssets() {
  for (const file of Object.keys(screenshotDescriptions)) {
    await fs.copyFile(path.join(screenshotsDir, file), path.join(archiveDir, 'images', 'screenshots', file));
    await fs.copyFile(path.join(screenshotsDir, file.replace(/\.\w+$/, '.txt')), path.join(archiveDir, 'images', 'screenshots', file.replace(/\.\w+$/, '.txt')));
  }
  for (const file of Object.keys(diagramDescriptions)) {
    await fs.copyFile(path.join(diagramsDir, file), path.join(archiveDir, 'images', 'diagrams', file));
    await fs.copyFile(path.join(diagramsDir, file.replace(/\.\w+$/, '.txt')), path.join(archiveDir, 'images', 'diagrams', file.replace(/\.\w+$/, '.txt')));
  }
}

async function main() {
  await ensureDirs();
  await writeDescriptions();
  const info = informationTxt();
  await fs.writeFile(path.join(docsDir, 'information.txt'), info, 'utf8');
  await fs.writeFile(path.join(archiveDir, 'text', 'information.txt'), info, 'utf8');
  await fs.writeFile(path.join(docsDir, `${softwareName}源代码.md`), await sourceMarkdown(), 'utf8');
  await fs.writeFile(path.join(docsDir, '软件设计说明书.md'), designMarkdown(), 'utf8');
  await fs.writeFile(path.join(docsDir, '已核验事实摘要.md'), `# 已核验事实摘要

- 目录命名：后台目录已命名为 admin，前台目录已命名为 fronter。
- 技术栈：前台 Vue 3 + Vite，后台 Node.js + Express，数据库 MySQL。
- 数据库：school_chinese_exam_practice，17 张表均已初始化，外键 23 个，演示题库三语数据完整。
- 日志：后台新增 logger.js 和 requestLogger.js，记录请求、错误和启动/脚本执行信息，日志写入 admin/logs/app.log。
- 功能：学生端注册登录、练习列表、答题提交、成绩记录、错题本、个人中心；管理端数据看板、学生列表、题库列表、试卷列表和成绩记录。
- 核验：npm run db:init、npm run seed:users、npm run build、接口 smoke test 和浏览器截图均已执行。
`, 'utf8');
  await copyAssets();
  console.log(JSON.stringify({ docsDir, archiveDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
