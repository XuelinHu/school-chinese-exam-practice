import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const softwareName = '马来西亚留学生汉语练习平台';
const version = 'V1.0';

// 交付目录：按软著共同规则输出到项目根 softright/{text,pdf,images/diagrams,images/screenshots}
const deliveryDir = path.join(root, 'softright');
const textDir = path.join(deliveryDir, 'text');
const pdfDir = path.join(deliveryDir, 'pdf');
const diagramsDir = path.join(deliveryDir, 'images', 'diagrams');
const screenshotsDir = path.join(deliveryDir, 'images', 'screenshots');

// 只读素材来源：本轮采集的三语原始截图，以及 docs 下已有的设计图
const rawScreenshotsDir = path.join(root, 'docs', 'assets', 'screenshots_trilingual_raw');
const diagramSourceDirs = [
  path.join(root, 'docs', 'assets', 'diagrams'),
  path.join(root, 'docs', 'assets', 'diagrams_png')
];

// information.txt 为本轮定稿稿：脚本直接读回这份交付稿，不再在 JS 里维护第二份副本
const informationPath = path.join(textDir, 'information.txt');
// 内部事实索引属于内部记录，放在 .tmp/softright/ 下，不打包进交付目录
const inventoryPath = path.join(root, '.tmp', 'softright', 'inventory.json');
const factsSummaryPath = path.join(root, '.tmp', 'softright', '已核验事实摘要.md');

// 源码册收录的三条源码根目录，用于反向核对是否存在源码漏收
const sourceRoots = ['admin/src', 'admin/sql', 'fronter/src'];
const sourceExts = new Set(['.js', '.mjs', '.vue', '.sql', '.css', '.json']);
const skippedDirs = new Set(['node_modules', 'dist', 'logs', 'uploads']);

const sourceFiles = [
  // 后台入口、配置与中间件
  'admin/src/server.js',
  'admin/src/app.js',
  'admin/src/config/db.js',
  'admin/src/config/ai.js',
  'admin/src/config/uploads.js',
  'admin/src/middleware/auth.js',
  'admin/src/middleware/role.js',
  'admin/src/middleware/active.js',
  'admin/src/middleware/rateLimit.js',
  'admin/src/middleware/requestLogger.js',
  // 公共服务与学习接口
  'admin/src/routes/auth.js',
  'admin/src/routes/learning.js',
  // 管理台接口
  'admin/src/routes/admin.js',
  'admin/src/routes/adminContent.js',
  'admin/src/routes/adminAi.js',
  // 智能体服务
  'admin/src/routes/ai.js',
  'admin/src/services/ai/ollama.js',
  'admin/src/services/ai/tools.js',
  'admin/src/services/ai/agent.js',
  'admin/src/services/ai/settings.js',
  // 后台工具
  'admin/src/utils/errors.js',
  'admin/src/utils/response.js',
  'admin/src/utils/logger.js',
  'admin/src/utils/paginate.js',
  'admin/src/utils/translations.js',
  'admin/src/utils/migrate.js',
  'admin/src/utils/initDb.js',
  'admin/src/utils/seedUsers.js',
  // 数据库脚本
  'admin/sql/schema.sql',
  'admin/sql/seed.sql',
  'admin/sql/migrations/001_auth_ai.js',
  'admin/sql/migrations/002_token_version.js',
  // 前台入口与基础能力
  'fronter/src/main.js',
  'fronter/src/App.vue',
  'fronter/src/router/index.js',
  'fronter/src/api/client.js',
  'fronter/src/api/ai.js',
  'fronter/src/stores/auth.js',
  'fronter/src/i18n/index.js',
  'fronter/src/composables/usePagedTable.js',
  // 公共组件与后台布局
  'fronter/src/components/Pagination.vue',
  'fronter/src/components/AppModal.vue',
  'fronter/src/layouts/AdminLayout.vue',
  // 智能体组件与语音
  'fronter/src/components/agent/AgentWidget.vue',
  'fronter/src/components/agent/AgentChat.vue',
  'fronter/src/components/agent/AgentControls.vue',
  'fronter/src/components/agent/AgentModelPicker.vue',
  'fronter/src/components/agent/format.js',
  'fronter/src/components/agent/voice/useVoice.js',
  'fronter/src/components/agent/voice/speech.js',
  'fronter/src/components/agent/voice/androidBridge.js',
  // 学员端页面
  'fronter/src/views/Home.vue',
  'fronter/src/views/Login.vue',
  'fronter/src/views/Register.vue',
  'fronter/src/views/ForgotPassword.vue',
  'fronter/src/views/PracticeList.vue',
  'fronter/src/views/PracticeDetail.vue',
  'fronter/src/views/Records.vue',
  'fronter/src/views/WrongBook.vue',
  'fronter/src/views/Profile.vue',
  'fronter/src/views/Dashboard.vue',
  // 管理台页面
  'fronter/src/views/admin/AdminDashboard.vue',
  'fronter/src/views/admin/AdminStudents.vue',
  'fronter/src/views/admin/AdminQuestions.vue',
  'fronter/src/views/admin/AdminPapers.vue',
  'fronter/src/views/admin/AdminRecords.vue',
  'fronter/src/views/admin/AdminLevels.vue',
  'fronter/src/views/admin/AdminCategories.vue',
  'fronter/src/views/admin/AdminLoginLogs.vue',
  'fronter/src/views/admin/AdminOnline.vue',
  'fronter/src/views/admin/AdminAiSettings.vue',
  'fronter/src/views/admin/AdminAiSessions.vue',
  'fronter/src/views/admin/AdminAiLogs.vue',
  // 样式与运行配置
  'fronter/src/assets/style.css',
  'admin/package.json',
  'fronter/package.json'
];

// 截图说明的 key 与 docs/assets/screenshots_trilingual_raw/manifest.json 的页面 key 一致。
// 描述只写截图画面中真实可见的元素，以及已核对的接口、数据表事实。
const screenshotDescriptions = {
  login: '登录页面截图，访问路径为 /login，已采集中文、英文、马来语三种界面。顶栏左侧为软件名称，右侧为首页、登录、注册导航项和语言下拉框；卡片内为用户名字段、密码字段、「记住用户名」复选框和登录按钮，底部为「忘记密码?」与「注册」链接。该页面对应 /api/auth/login 接口，登录成功后由后台签发 JWT 并由前端保存登录态。',
  register: '注册页面截图，访问路径为 /register，已采集中文、英文、马来语三种界面。表单字段依次为用户名、密码、确认密码、姓名、邮箱、学号、国籍和语言，密码下方提示「密码至少 8 位，需包含字母和数字」，底部为注册按钮和登录链接。该页面对应 /api/auth/register 接口，注册信息写入 users 表，国籍与语言用于界面语言切换。',
  forgot_password: '找回密码页面截图，访问路径为 /forgot-password，已采集三语界面。表单字段为用户名、身份核验方式下拉框（图中为「用邮箱核验」）和邮箱，主按钮为「获取重置码」。该页对应 /api/auth/password/forgot 接口，后台生成 6 位重置码并以哈希写入 password_resets 表，重置码 10 分钟内有效且只能使用一次。',
  home: '学生首页截图，访问路径为 /，已采集中文、英文、马来语三种界面。顶部为软件名称与首页、练习、成绩、错题本、个人中心、退出等导航项；正文为练习、错题本、成绩三张入口卡片，练习卡片内列出 HSK1 / HSK2 / Campus Chinese 三个等级。右下角为「汉语学习助教」悬浮球。该页面是学生登录后的主入口，导航与卡片文案取自前端国际化资源。',
  practice_list: '练习列表页面截图，访问路径为 /practice，已采集中文、英文、马来语三种界面。页面以卡片列出已发布试卷，图中三张卡片为校园生活汉语练习、HSK2 基础语法练习和 HSK1 每日练习，卡片显示标题、说明、等级、题数和总分。该页面对应 /api/learning/papers 接口，标题与说明按 language_code 从翻译表读取。',
  practice_detail: '答题详情页面截图，访问路径为 /practice/1，已采集三语界面。页面标题为试卷名称并显示进度「1 / 5」；题目卡片显示分类与难度（图中为「拼音 · easy」）、题干和四个选项，底部为上一题与「下一题」按钮；右侧题号列表可点击跳题。调用 /api/learning/papers/:id 接口，题干、选项和解析按 language_code 读取。',
  records: '成绩记录页面截图，访问路径为 /records，已采集中文、英文、马来语三种界面。页面以表格展示个人练习历史，列依次为标题、题数、正确、错误、得分、提交时间，图中记录包含 HSK1 每日练习与 HSK2 基础语法练习。该页面对应 /api/learning/records 接口，数据来自 study_records 表，按提交时间返回当前学员的记录。',
  wrong_book: '错题本页面截图，访问路径为 /wrong-book，已采集中文、英文、马来语三种界面。页面以卡片列出待复习错题，每张卡片显示分类标签（图中为词汇、阅读、语法）、错误次数标签、题干和解析。该页面对应 /api/learning/wrong-questions 接口，错题与错误次数来自 wrong_questions 表，答对历史错题后可标记为已解决。',
  profile: '个人中心页面截图，访问路径为 /profile，已采集中文、英文、马来语三种界面。页面包含资料、修改密码、登录日志三张卡片：资料卡片显示头像、用户名、角色标签和上传头像按钮，并列出姓名、邮箱、电话、学号、国籍、语言字段；修改密码卡片含当前密码、新密码、确认密码；登录日志卡片以表格显示操作、状态、IP 地址和创建时间，支持翻页。',
  agent_modal: '智能体对话弹框截图，访问路径为 /，由页面右下角悬浮球点开，已采集三语界面。弹框标题为「汉语学习助教」，标题下方显示当前模型名 qwen3:14b，右上角为模型入口和关闭按钮；学员提问「我有哪些错题?」后，回答按题目、分类、等级、解析逐条列出 4 道错题。内容由后台工具 get_my_wrong_questions 查询数据库得到，经 SSE 流式返回。',
  admin_dashboard: '管理台数据看板截图，访问路径为 /admin。左侧菜单分为数据看板、学生管理、题库、智能体设置四组共 12 个菜单项；顶部统计卡片显示学生数、在线、题目数、练习数、答题记录和正确率，下方为近 7 日趋势、各等级表现，以及高频错题、最近答题两张表格。数据来自 /api/admin/stats 等接口，页面顶部显示当前登录管理员的角色徽标。',
  admin_students: '管理台学生管理截图，访问路径为 /admin/students。筛选区提供用户名搜索框和角色、状态、在线状态三个下拉框以及重置按钮；表格列为 ID、用户名、姓名、角色、状态、在线状态、答题记录、平均分、错题本、最近活跃、最近登录、登录次数和操作，操作列按账号状态提供编辑、重置密码、解锁、删除按钮；底部分页显示总条数、每页条数和页码。',
  admin_questions: '管理台题库管理截图，访问路径为 /admin/questions。页面提供新增按钮，筛选区包含搜索框和等级、分类、题型、难度、状态、排序下拉框；表格列为 id、标题、等级、分类、题型、难度、得分、选项数、状态、创建时间和操作，操作列提供编辑和删除按钮。图中列出 10 道题，题型均为单选，难度分为简单、中等、困难，状态均为已发布。',
  admin_papers: '管理台练习试卷截图，访问路径为 /admin/papers。页面提供新增按钮，筛选区包含搜索框和试卷类型、等级、状态、排序下拉框；表格列为 id、标题、试卷类型、等级、题数、练习次数、总分、时长（分钟）、状态和操作，操作列提供编辑、组卷、删除三个按钮。图中三份试卷的题数均为 5、总分均为 5.00，试卷类型分别为练习和每日。',
  admin_records: '管理台成绩记录截图，访问路径为 /admin/records。筛选区提供用户名搜索框、提交时间区间选择和重置按钮；表格列为序号、用户名、标题、正确、错误、得分、正确率、时长、提交时间和操作，正确率列同时显示进度条与百分比，操作列的明细按钮用于查看单次作答明细。该页面对应 /api/admin/records 接口，集中显示全部学员的答题结果。',
  admin_levels: '管理台等级管理截图，访问路径为 /admin/levels。页面提供新增按钮，筛选区包含搜索框、状态下拉框、排序下拉框和重置按钮；表格列为 id、编码、姓名、描述、排序、状态、题数和操作，操作列提供编辑和删除按钮。图中三个等级为 HSK1、HSK2、CAMPUS，题数分别为 5、3、2，名称与描述按语言保存在 level_translations 表。',
  admin_categories: '管理台分类管理截图，访问路径为 /admin/categories。页面提供新增按钮，筛选区包含搜索框、状态下拉框和排序下拉框以及重置按钮；表格列为 id、编码、姓名、分类、描述、排序、状态、题数和操作，操作列提供编辑和删除按钮。图中四个分类为拼音、词汇、语法、阅读，题数分别为 1、4、2、3，名称与描述保存在分类翻译表中。',
  admin_login_logs: '管理台登录日志截图，访问路径为 /admin/login-logs。筛选区包含用户名搜索框、操作、练习结果、创建时间区间和重置按钮；表格列为 ID、用户名、姓名、操作、练习结果、IP 地址、消息、创建时间和类型，图中记录的操作均为登录、练习结果均为成功，类型列区分浏览器访问与脚本访问；底部分页显示总条数、每页条数、页码和跳页输入框。',
  admin_online: '管理台在线状态截图，访问路径为 /admin/online。页面顶部三张统计卡片显示在线人数、学生数和后台管理人数，下方标注在线窗口（分钟）；筛选区包含在线窗口分钟数输入框、角色下拉框、用户名搜索框和重置按钮；表格列为 ID、用户名、姓名、角色、语言、状态、最近活跃、最近登录、登录次数、空闲分钟和在线状态，在线状态以圆点标记显示。',
  admin_ai_settings: '管理台智能体设置截图，访问路径为 /admin/ai/settings。页面顶部四张卡片显示服务状态、模型服务地址、在线窗口（分钟）和耗时；表单包含默认模型下拉框与加载、卸载、刷新模型三个按钮，启用场景的学员和管理员复选框，学员欢迎语与管理员欢迎语输入框，启用语音与自动播报复选框，工具数量与输入字符上限，底部为保存按钮。',
  admin_ai_sessions: '管理台智能体会话截图，路径 /admin/ai/sessions。筛选区含标题搜索框、类型筛选和重置按钮；表格列为序号、标题、用户名、类型、模型、消息数、创建时间、最近活跃和操作，操作列提供消息和删除按钮。图中会话标题多为学员提问原文，模型列出现 qwen3:14b、qwen2.5:0.5b。数据来自 ai_sessions、ai_messages 表。',
  admin_ai_logs: '管理台智能体调用日志截图，访问路径为 /admin/ai/logs。筛选区包含用户名搜索框、模型输入框、类型和状态下拉框以及重置按钮，顶部两张卡片显示平均耗时和失败次数；表格列为序号、用户名、类型、模型、工具、输入字符、输出字符、耗时、状态、创建时间和失败原因，工具列显示本次调用触发的后台工具名。数据来自 ai_call_logs 表。'
};

// 采集了中文、英文、马来语三语的页面；其余页面只采集中文
const trilingualPages = new Set([
  'login',
  'register',
  'forgot_password',
  'home',
  'practice_list',
  'practice_detail',
  'records',
  'wrong_book',
  'profile',
  'agent_modal'
]);

const diagramDescriptions = {
  '01_use_case': '用例图展示学生、管理员两个角色与系统功能之间的关系。学生侧覆盖注册、登录、找回密码与修改密码、个人资料与头像、语言切换、练习列表、在线答题、成绩记录、错题本和智能体问答；管理员侧覆盖数据看板、学生管理、题库与试卷维护、等级与分类维护、成绩记录与登录日志检索、在线状态，以及智能体设置、会话与调用日志查看。该图用于概括软件的角色边界和功能范围。',
  '02_architecture': '系统架构图展示 fronter 前台、admin 后台、MySQL 数据库和本机 Ollama 模型服务之间的分层关系。前台包含路由、国际化、认证状态、学生页面、管理台分页页面、智能体弹框与语音控件和 API 请求封装；后台包含 Express 应用、鉴权与限流中间件、日志模块、公共服务接口、学习接口、管理台接口、智能体接口和数据库连接池。该图用于说明系统主要技术构成和调用方向。',
  '03_deployment': '部署图说明用户浏览器、Web 前端运行环境、应用服务器、MySQL 数据库和本机 Ollama 运行时之间的部署关系。浏览器访问静态资源，Vue 前台调用后台 /api 接口并订阅 SSE 流式响应，后台通过连接池访问数据库、通过本机接口访问 Ollama，并写入 logs/app.log 日志文件；安卓环境中语音识别与合成由 WebView 原生桥接完成。该图用于描述系统运行支撑环境和服务间通信路径。',
  '04_practice_flow': '业务流程图描述学生从注册登录、进入练习列表、选择试卷、逐题作答到提交并生成成绩和错题记录的完整流程。流程中包含未全部作答时的提示分支、提交后的事务判分、错题更新与已解决标记逻辑，以及登录日志、最后活跃时间和令牌版本号在认证环节的校验。该图用于说明练习答题主链路和后台事务处理结果。',
  '05_submit_sequence': '提交时序图展示学生页面、API Client、learning 路由、事务处理和 MySQL 之间的调用顺序。页面提交答案后，后台查询正确选项、计算得分，并在同一事务中写入学习记录、用户答案和错题本数据，最后返回正确数、错误数和得分给页面展示；登录态由 JWT 中间件回查用户表比对令牌版本号。该图用于解释答题提交接口的协作过程。',
  '06_er': 'ER 图展示 users、levels、question_categories、questions、question_options、papers、paper_questions、study_records、user_answers、wrong_questions、favorite_questions 等核心数据表之间的关系，并覆盖本轮新增的 password_resets、login_logs、ai_sessions、ai_messages、ai_call_logs、system_settings 六张表。该图用于说明题库、试卷、答题记录、错题本、账号安全与智能体会话之间的数据关联，是数据设计章节的重要依据。'
};

function redact(text) {
  return text
    .replace(/Java@c1024/g, '***')
    .replace(/admin123456/g, '***')
    .replace(/student123456/g, '***')
    .replace(/[A-Z0-9._%+-]+@example\.local/gi, '***@***')
    .replace(/localhost:\d+/g, '***')
    .replace(/127\.0\.0\.1(:\d+)?/g, '***')
    .replace(/http:\/\/\*\*\*\/api/g, 'http://***/api')
    .replace(/dev_secret/g, '***');
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// 递归列出源码根目录下的自研源码，用于反向核对源码册是否漏收
async function listSourceFiles(dir, out = []) {
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) await listSourceFiles(relative, out);
    } else if (sourceExts.has(path.extname(entry.name))) {
      out.push(relative);
    }
  }
  return out;
}

// 启动校验：既报出「列入源码册但磁盘上不存在」的文件，也报出「磁盘上存在却未列入」的源码，避免源码册漏收或收进不存在的文件
async function verifySourceFiles() {
  const missing = [];
  for (const file of sourceFiles) {
    if (!(await fileExists(path.join(root, file)))) missing.push(file);
  }
  const listed = new Set(sourceFiles);
  const unlisted = [];
  for (const dir of sourceRoots) {
    for (const file of await listSourceFiles(dir)) {
      if (!listed.has(file)) unlisted.push(file);
    }
  }
  if (missing.length || unlisted.length) {
    const lines = ['源码册文件校验未通过：'];
    if (missing.length) lines.push(`  列入源码册但磁盘上不存在（${missing.length} 个）：${missing.join('、')}`);
    if (unlisted.length) lines.push(`  磁盘上存在但未列入源码册（${unlisted.length} 个）：${unlisted.join('、')}`);
    throw new Error(lines.join('\n'));
  }
}

// 逐页解析原始截图：三语页面要求 zh / en / ms 三张齐全，其余页面要求 zh 一张，并反向核对有无未写说明的截图
async function resolveScreenshots() {
  const resolved = {};
  const missing = [];
  for (const page of Object.keys(screenshotDescriptions)) {
    const langs = trilingualPages.has(page) ? ['zh', 'en', 'ms'] : ['zh'];
    resolved[page] = [];
    for (const lang of langs) {
      const file = `${page}_${lang}.png`;
      if (await fileExists(path.join(rawScreenshotsDir, file))) resolved[page].push(file);
      else missing.push(file);
    }
  }
  const described = new Set(Object.values(resolved).flat());
  const undescribed = (await fs.readdir(rawScreenshotsDir)).filter((file) => file.endsWith('.png') && !described.has(file));
  if (missing.length || undescribed.length) {
    const lines = ['原始截图校验未通过：'];
    if (missing.length) lines.push(`  缺少截图（${missing.length} 张）：${missing.join('、')}`);
    if (undescribed.length) lines.push(`  存在截图但没有对应说明（${undescribed.length} 张）：${undescribed.join('、')}`);
    throw new Error(lines.join('\n'));
  }
  return resolved;
}

// 逐张解析设计图：优先取 docs/assets/diagrams 下的编辑源，其次同名位图，再退到 docs/assets/diagrams_png
async function resolveDiagrams() {
  const resolved = {};
  const missing = [];
  for (const key of Object.keys(diagramDescriptions)) {
    for (const dir of diagramSourceDirs) {
      for (const ext of ['.svg', '.png']) {
        const source = path.join(dir, `${key}${ext}`);
        if (await fileExists(source)) {
          resolved[key] = { source, file: `${key}${ext}`, fallback: dir !== diagramSourceDirs[0] };
          break;
        }
      }
      if (resolved[key]) break;
    }
    if (!resolved[key]) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`设计图校验未通过，未找到以下图（${missing.length} 张）：${missing.join('、')}`);
  }
  return resolved;
}

async function ensureDirs() {
  for (const dir of [textDir, pdfDir, diagramsDir, screenshotsDir]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// information.txt 是本轮定稿稿，也是唯一事实来源：直接读回它的内容，脚本内不再维护第二份会漂移的副本
async function informationTxt() {
  return fs.readFile(informationPath, 'utf8');
}

// 不再生成每图 TXT：按 softcopyright-visuals 技能约定，文件/页面/证据/说明/脱敏与检查结果
// 统一记入共用素材索引（.tmp/softright/inventory.json）。设计说明书的图题由
// render_optimized_softcopyright.mjs 的 screenshotNotes 生成，删除每图 TXT 不会丢失描述文字；
// 下方 screenshotDescriptions 现在只保留键名，用于与原始采集清单 manifest.json 对齐校验。
async function copyAssets(screenshots, diagrams) {
  for (const files of Object.values(screenshots)) {
    for (const file of files) {
      await fs.copyFile(path.join(rawScreenshotsDir, file), path.join(screenshotsDir, file));
    }
  }
  for (const { source, file } of Object.values(diagrams)) {
    await fs.copyFile(source, path.join(diagramsDir, file));
  }

  // 共同规则要求交付的运行截图是「原图的脱敏中性灰度副本」。
  // Node 侧没有可用的图像库，而技能规则本就要求辅助脚本用 Python 3.10+，故交给 PIL 处理。
  const { execFileSync } = await import('node:child_process');
  execFileSync('python3', [path.join(root, 'scripts', 'grayscale_pngs.py'), screenshotsDir], { stdio: 'inherit' });
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
    '本源码由后台 admin、前台 fronter 和数据库脚本三部分组成。后台使用 Node.js、Express、mysql2 和 MySQL 连接池提供账号公共服务、学习练习、管理台分页查询、智能体会话、语音桥接支撑、日志记录和数据库迁移能力；前台使用 Vue 3、Vue Router 和 Vite 提供学生端练习页面、公共服务页面、管理端后台布局与分页表格页面、智能体弹框与语音交互组件、三语国际化界面和 API 调用封装；数据库脚本负责创建用户、等级、分类、题库、试卷、答题记录、错题本、登录日志、密码重置、智能体会话与系统设置等业务表。',
    '',
    '选入源码稿的范围包括 admin/src、admin/sql、fronter/src 以及两个 package.json 中与系统运行直接相关的配置。已排除 node_modules、dist、package-lock、日志文件、上传文件和第三方依赖源码。源码中涉及密码、令牌、邮箱、主机地址和数据库连接敏感值均已脱敏。',
    '',
    '## 三级目录结构',
    '',
    '- admin/src：后台应用入口、路由、中间件、配置、智能体服务和工具模块',
    '- admin/sql：数据库建表脚本、增量迁移脚本和演示题库初始化脚本',
    '- fronter/src：前台入口、路由、状态、国际化、公共组件、智能体组件、后台布局和页面组件',
    '- package.json：前后台运行脚本和依赖配置',
    ''
  ];
  let lineCount = 0;
  for (const file of sourceFiles) {
    const abs = path.join(root, file);
    const code = redact(await fs.readFile(abs, 'utf8'));
    lineCount += code.replace(/\n$/, '').split('\n').length;
    const moduleName = file.startsWith('admin/sql') ? '数据库脚本模块' : file.startsWith('admin') ? '后台服务模块' : file.startsWith('fronter') ? '前台页面模块' : '项目配置模块';
    lines.push(`## 文件：${file}`, '');
    lines.push(`文件职责：${describeFile(file)}`);
    lines.push(`所属模块：${moduleName}`, '');
    lines.push('```' + languageOf(file));
    lines.push(code.trimEnd());
    lines.push('```', '');
  }
  // 收录数量由本脚本按实际读入的文件统计，不写死在文案里
  lines.splice(11, 0, `本源码稿共收录 ${sourceFiles.length} 个文件，按换行统计合计 ${lineCount} 行。`);
  return { markdown: lines.join('\n'), files: sourceFiles.length, lines: lineCount };
}

function describeFile(file) {
  if (file.includes('/routes/auth')) return '提供注册、登录、退出、找回密码、修改密码、个人资料、头像上传和本人登录日志接口。';
  if (file.includes('/routes/learning')) return '提供等级、分类、练习列表、试卷详情、答题提交、成绩记录和错题本接口。';
  if (file.includes('/routes/adminContent')) return '提供管理台等级、分类、题库和试卷的分页查询与增删改接口，并维护三语翻译字段。';
  if (file.includes('/routes/adminAi')) return '提供管理台智能体设置、模型刷新、会话与调用日志的分页查询接口。';
  if (file.includes('/routes/admin')) return '提供管理台数据看板、学生管理、成绩记录、登录日志和在线状态接口。';
  if (file.includes('/routes/ai')) return '提供智能体健康检查、模型列表与装卸、场景配置、SSE 流式问答和会话管理接口。';
  if (file.includes('/services/ai/ollama')) return '封装本地 Ollama 的模型列举、装载卸载、对话推理和能力探测调用。';
  if (file.includes('/services/ai/tools')) return '定义面向本平台业务的数据库查询工具，为智能体提供真实学情数据。';
  if (file.includes('/services/ai/agent')) return '实现场景化系统提示词、工具调用循环、降级路由和流式事件编排。';
  if (file.includes('/services/ai/settings')) return '读写智能体运行参数，并提供模型列表缓存与回落策略。';
  if (file.includes('/middleware/auth')) return '解析 JWT 并回查用户表比对令牌版本号，完成接口登录态校验与吊销。';
  if (file.includes('/middleware/role')) return '按用户角色限制管理员接口访问。';
  if (file.includes('/middleware/active')) return '按节流策略刷新用户活跃时间，支撑在线状态统计。';
  if (file.includes('/middleware/rateLimit')) return '提供内存滑动窗口限流，保护登录、改密和智能体接口。';
  if (file.includes('/middleware/requestLogger')) return '记录 HTTP 请求状态、路径、耗时和用户标识。';
  if (file.includes('/utils/logger')) return '提供控制台和文件双写的日志工具，并脱敏敏感字段。';
  if (file.includes('/utils/paginate')) return '统一分页参数解析与分页查询封装，并内联校验后的 LIMIT 取值。';
  if (file.includes('/utils/translations')) return '封装三语翻译表的关联读取与按语言增量写入，避免覆盖其他语种内容。';
  if (file.includes('/utils/migrate')) return '按版本号顺序执行数据库迁移脚本并记录已应用版本，保证升级幂等。';
  if (file.includes('/config/db')) return '配置 MySQL 连接池和事务封装。';
  if (file.includes('/config/ai')) return '读取并归一化智能体相关环境变量配置。';
  if (file.includes('/config/uploads')) return '定义头像等上传文件的存放目录、类型白名单和大小限制。';
  if (file.endsWith('schema.sql')) return '创建系统所需数据库、业务表、唯一约束和外键。';
  if (file.endsWith('seed.sql')) return '写入等级、分类、试卷、题目、选项和多语言演示题库。';
  if (file.includes('migrations/002')) return '为用户表补充令牌版本号字段，使改密、重置密码和停用账号能立即吊销已签发的令牌。';
  if (file.includes('migrations/')) return '为已部署数据库增量补充字段和智能体相关业务表。';
  if (file.includes('router')) return '定义前台页面路由、后台嵌套路由和登录、管理员访问守卫。';
  if (file.includes('api/client')) return '封装前台 HTTP JSON 请求、原始字节上传、查询串拼接和 SSE 流式读取。';
  if (file.includes('api/ai')) return '封装智能体接口调用与流式事件订阅。';
  if (file.includes('i18n')) return '维护中文、英文、马来语界面文案和语言切换状态。';
  if (file.includes('composables/usePagedTable')) return '封装后台分页表格的查询、筛选、防抖搜索与翻页逻辑。';
  if (file.includes('components/Pagination')) return '实现通用分页控件，提供页码、每页条数和总数展示。';
  if (file.includes('components/AppModal')) return '实现通用弹框容器，供后台编辑表单与智能体对话复用。';
  if (file.includes('layouts/AdminLayout')) return '实现管理台侧边栏布局、菜单分组和窄屏抽屉导航。';
  if (file.includes('agent/format')) return '把模型回答中的行内 Markdown 标记转换为 HTML 片段，先转义再替换标记以避免注入。';
  if (file.includes('voice/useVoice')) return '编排语音识别与语音播报能力，按运行环境选择原生桥或浏览器接口。';
  if (file.includes('voice/speech')) return '封装浏览器语音识别与语音合成，并清洗播报文本。';
  if (file.includes('voice/androidBridge')) return '探测安卓、Capacitor 与 iOS 原生语音桥并注册回调。';
  if (file.includes('agent/')) return '实现智能体悬浮入口、对话弹框、模型选择与语音控制界面。';
  if (file.includes('views/admin/')) return '实现管理台分页查询页面的筛选栏、数据表格与编辑弹框。';
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

// 已核验事实摘要属于内部记录：内容全部取自 .tmp/softright/inventory.json，脚本不新增事实
async function factsSummary(inventory, sourceStats) {
  const lines = ['# 已核验事实摘要', '', `生成时间：由 scripts/generate_softcopyright_materials.mjs 依据 .tmp/softright/inventory.json 生成`, ''];
  const push = (text) => lines.push(`- ${text}`);
  const meta = inventory.meta || {};
  push(`软件名称：${meta.softwareName || softwareName}；简称：${meta.shortName || '待确认'}；版本号：${meta.version || version}；交付目录：${meta.deliveryDir || 'softright/'}`);
  const technical = (inventory.fingerprint || {}).technical || {};
  if (technical.stack) push(`技术栈：前台 ${technical.stack.frontend}；后台 ${technical.stack.backend}；数据库 ${technical.stack.database}；智能体 ${technical.stack.agent}；语音 ${technical.stack.voice}`);
  if (technical.ports) push(`端口：前台 ${technical.ports.frontend}，后台 ${technical.ports.backend}，Ollama ${technical.ports.ollama}`);
  if (Array.isArray(inventory.tables)) push(`数据库：${inventory.tables.length} 张表（${inventory.tables.join('、')}）`);
  if (inventory.api) {
    const byFile = Object.entries(inventory.api.byFile || {}).map(([file, count]) => `${file} ${count} 个`).join('，');
    push(`接口：共 ${inventory.api.total} 个（${byFile}）；分页返回结构为 ${inventory.api.paginationContract}`);
  }
  if (inventory.pages) {
    push(`页面：公开 ${inventory.pages.public.join('、')}；学员 ${inventory.pages.student.join('、')}`);
    push(`管理台菜单：${inventory.pages.adminMenus.join('、')}`);
    push(`全局：${inventory.pages.global}`);
  }
  if (Array.isArray(inventory.modules)) {
    push(`模块：${inventory.modules.map((module) => `${module.id} ${module.name}`).join('；')}`);
  }
  if (Array.isArray((inventory.fingerprint || {}).business?.states)) {
    push(`业务状态：${inventory.fingerprint.business.states.join('；')}`);
  }
  if (Array.isArray((inventory.fingerprint || {}).evidence?.runtime)) {
    push(`运行证据：${inventory.fingerprint.evidence.runtime.join('；')}`);
  }
  if (sourceStats) {
    // 收录数量由脚本按实际读入的文件统计，可能与索引中的历史记录存在差异，以实际收录为准
    push(`本次源码册实际收录：${sourceStats.files} 个文件，按换行统计合计 ${sourceStats.lines} 行`);
  }
  const recorded = inventory.sourceStats;
  if (recorded) push(`索引记录的自研源码量：${recorded.files} 个文件、${recorded.lines} 行，配置 ${recorded.configFiles} 个文件、${recorded.configLines} 行（统计口径见 ${recorded.note || '索引说明'}）`);
  if (Array.isArray(inventory.conflicts)) {
    for (const conflict of inventory.conflicts) push(`待核对：${conflict}`);
  }
  if (Array.isArray(inventory.toConfirm)) {
    for (const item of inventory.toConfirm) push(`待确认：${item}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  await verifySourceFiles();
  const screenshots = await resolveScreenshots();
  const diagrams = await resolveDiagrams();
  await ensureDirs();

  // information.txt 已位于交付目录，读回后写回同一路径，保证交付稿内容与脚本输出一致
  const info = await informationTxt();
  await fs.writeFile(informationPath, info, 'utf8');

  const source = await sourceMarkdown();
  await fs.writeFile(path.join(textDir, `${softwareName}源代码.md`), source.markdown, 'utf8');
  // 设计说明书（HTML/MD/PDF）统一由 scripts/render_optimized_softcopyright.mjs 生成：
  // 两个脚本都写 text/软件设计说明书.md 时，交付稿内容会随执行顺序变化。
  // 本脚本只负责 information.txt 与源码册。

  const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
  await fs.mkdir(path.dirname(factsSummaryPath), { recursive: true });
  await fs.writeFile(factsSummaryPath, await factsSummary(inventory, source), 'utf8');

  await copyAssets(screenshots, diagrams);

  const screenshotCount = Object.values(screenshots).reduce((total, files) => total + files.length, 0);
  console.log(JSON.stringify({
    textDir,
    pdfDir,
    diagramsDir,
    screenshotsDir,
    factsSummaryPath,
    源码册文件数: source.files,
    源码册行数: source.lines,
    截图页面数: Object.keys(screenshots).length,
    截图张数: screenshotCount,
    设计图: Object.fromEntries(Object.entries(diagrams).map(([key, item]) => [key, item.fallback ? `${item.file}（取自 ${path.relative(root, item.source)}）` : item.file]))
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
