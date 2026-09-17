import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const deliveryDir = path.join(root, 'softright');
const textDir = path.join(deliveryDir, 'text');
const pdfDir = path.join(deliveryDir, 'pdf');
const shotDir = path.join(deliveryDir, 'images', 'screenshots');
const diagramDir = path.join(deliveryDir, 'images', 'diagrams');
/** 合成脚本（scripts/combine_trilingual_screenshots.py）的镜像输出目录。 */
const rawShotDir = path.join(root, 'docs', 'assets', 'screenshots_trilingual');
const rawDiagramDir = path.join(root, 'docs', 'assets', 'diagrams_png');
const softwareName = '马来西亚留学生汉语练习平台';
const version = 'V1.0';
const chromeBin = process.env.CHROME_BIN || '/opt/google/chrome/chrome';

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
  // 清单与 generate_softcopyright_materials.mjs 的 sourceFiles 保持一致（76 项）。
  // 曾误加 .gitignore 与 README.md，使源码册变成 78 个文件 12162 行，与 information.txt
  // 申报的「76 个文件约 12047 行」对不上；两者都非程序源码，README 还带外部徽章图片链接。
  'fronter/src/assets/style.css',
  'admin/package.json',
  'fronter/package.json'
];

/**
 * 功能需求清单。字段依次为：
 * 编号与名称、需求描述、页面名称、访问路径、接口或入口、核心数据对象、截图键。
 */
const requirements = [
  ['FR-01 用户登录', '学生与管理员使用用户名和密码登录，后台校验账号状态、锁定状态与密码哈希后签发有效期为 7 天的令牌，载荷包含用户编号、用户名、角色与令牌版本号；登录成功更新最后登录时间并累计登录次数，失败按规则计数。', '登录页面', '/login', 'POST /api/auth/login', 'users、login_logs', 'login_trilingual.png'],
  ['FR-02 学生注册', '学生填写用户名、密码、姓名、邮箱、电话、学号、国籍与界面语言完成自助建档，密码经 bcrypt 哈希后写入用户表，用户名唯一，注册动作写入登录日志。', '注册页面', '/register', 'POST /api/auth/register', 'users、login_logs', 'register_trilingual.png'],
  ['FR-03 退出登录', '用户在导航栏点击退出，前台清除本地令牌与用户信息并回到登录页，后台写入一条行动类型为 logout 的登录日志。', '顶部导航退出入口', '/（导航栏）', 'POST /api/auth/logout', 'login_logs', 'home_trilingual.png'],
  ['FR-04 修改密码', '登录用户提交当前密码与新密码，后台校验当前密码正确、新密码与旧密码不同后重新哈希写库，并自增令牌版本号，使包括本机在内的全部已签发令牌立即失效，用户需重新登录。', '个人中心', '/profile', 'POST /api/auth/change-password', 'users、login_logs', 'profile_trilingual.png'],
  ['FR-05 找回密码', '忘记密码的学生用用户名配合绑定邮箱或学号核验身份，核验通过后后台签发 6 位数字重置码，以哈希形式存入密码重置表，有效期 10 分钟且只能使用一次；重置成功后同样自增令牌版本号。身份不匹配时统一返回同一句提示，不暴露账号是否存在。', '找回密码页面', '/forgot-password', 'POST /api/auth/password/forgot、POST /api/auth/password/reset', 'users、password_resets、login_logs', 'forgot_password_trilingual.png'],
  ['FR-06 个人资料维护', '学生查看并修改姓名、邮箱、电话、国籍与界面语言，后台按当前登录用户更新用户表，邮箱需通过格式校验，语言取值限定在中文、英文、马来语三种之内。', '个人中心', '/profile', 'GET /api/auth/profile、PUT /api/auth/profile', 'users', 'profile_trilingual.png'],
  ['FR-07 头像上传', '学生从个人中心上传头像，后台按请求体魔数识别真实图片类型，只接受 PNG、JPEG、GIF 与 WebP 且不超过 2MB，落盘到上传目录并把访问地址写入用户头像字段，同时清理该用户的历史头像文件。', '个人中心', '/profile', 'POST /api/auth/profile/avatar', 'users（avatar_url）', 'profile_trilingual.png'],
  ['FR-08 本人登录日志', '学生分页查看自己的登录、退出、注册、改密与重置记录，包含操作类型、成功状态、IP 地址与创建时间，并可按操作类型筛选。', '个人中心', '/profile', 'GET /api/auth/login-logs', 'login_logs', 'profile_trilingual.png'],
  ['FR-09 在线状态心跳', '登录用户每次请求结束时刷新一次最后活跃时间，同一用户最多每 60 秒写库一次，避免每个请求都产生更新；管理端据此字段与在线窗口分钟数统计在线人数。', '在线状态列表', '/admin/online', '全局 touchActive 中间件、GET /api/admin/online', 'users（last_active_at）', 'admin_online_zh.png'],
  ['FR-10 学生首页导航', '学生登录后进入首页，可在导航栏进入练习、成绩、错题本与个人中心，右上角保留语言切换与退出入口，右下角常驻智能体悬浮球。', '学生首页', '/', '前端路由与导航', 'users（language）', 'home_trilingual.png'],
  ['FR-11 练习列表', '学生查看已发布练习卡片，卡片显示试卷标题、说明、等级、题数与建议时长，标题与说明按当前语言从试卷翻译表读取，等级名称同样按语言读取。', '练习列表', '/practice', 'GET /api/learning/papers', 'papers、paper_translations、paper_questions、levels、level_translations', 'practice_list_trilingual.png'],
  ['FR-12 在线答题与提交判分', '学生逐题阅读题干、选项、分类、难度与作答提示并选择答案，右侧题号面板可定位任意题目；提交后后台在事务中比对正确选项、计算正确数、错误数与总得分，写入学习记录与作答明细，并按答题结果新增或累加错题。', '答题详情', '/practice/1', 'GET /api/learning/papers/:id、POST /api/learning/papers/:id/submit', 'questions、question_options、study_records、user_answers、wrong_questions', 'practice_detail_trilingual.png'],
  ['FR-13 成绩记录', '学生查看历史练习的标题、题数、正确数、错误数、得分与提交时间，数据取自学习记录表，按提交时间倒序返回，练习标题按当前语言读取。', '成绩记录', '/records', 'GET /api/learning/records', 'study_records、paper_translations', 'records_trilingual.png'],
  ['FR-14 错题本', '系统在学生答错时新增或累加错题记录与错误次数，学生可查看错题的题干、分类、等级、错误次数与解析文本，并保留订正状态用于区分待复习与已解决。', '错题本', '/wrong-book', 'GET /api/learning/wrong-questions', 'wrong_questions、questions、question_translations', 'wrong_book_trilingual.png'],
  ['FR-15 管理看板', '管理员查看学生数、在线人数、已发布题目数、练习数、答题记录数、平均分与正确率七项指标，并查看近 7 日答题趋势、各等级表现、高频错题与最近答题明细。', '管理台数据看板', '/admin', 'GET /api/admin/stats', 'users、questions、papers、study_records', 'admin_dashboard_zh.png'],
  ['FR-16 学生管理', '管理员分页检索用户，可按用户名或姓名关键词、角色、状态与在线状态筛选，列表给出答题记录数、平均分、错题数与最近活跃时间，并支持编辑资料、重置密码、解锁账号与删除账号；管理员不能删除自己。', '学生管理列表', '/admin/students', 'GET /api/admin/users、GET /api/admin/users/:id、PATCH /api/admin/users/:id、POST /api/admin/users/:id/reset-password、POST /api/admin/users/:id/unlock、DELETE /api/admin/users/:id', 'users、study_records、wrong_questions', 'admin_students_zh.png'],
  ['FR-17 题库管理', '管理员分页检索题目，可按关键词、等级、分类、题型、难度与状态筛选，列表显示选项数与创建时间，并支持新增、修改与删除题目及其三语标题、题干、选项与解析。', '题库管理列表', '/admin/questions', 'GET /api/admin/questions、GET /api/admin/questions/:id、POST /api/admin/questions、PUT /api/admin/questions/:id、DELETE /api/admin/questions/:id', 'questions、question_translations、question_options、question_option_translations', 'admin_questions_zh.png'],
  ['FR-18 练习试卷管理', '管理员分页检索试卷，列表显示试卷类型、等级、题数、练习次数、总分、时长与状态，支持新增、修改、删除试卷，并通过组卷接口整体替换试卷的题目集合与每题分值。', '练习试卷列表', '/admin/papers', 'GET /api/admin/papers、GET /api/admin/papers/:id、POST /api/admin/papers、PUT /api/admin/papers/:id、PUT /api/admin/papers/:id/questions、DELETE /api/admin/papers/:id', 'papers、paper_translations、paper_questions', 'admin_papers_zh.png'],
  ['FR-19 成绩记录管理', '管理员分页查看全平台答题记录，可按用户名关键词与提交时间区间筛选，列表给出正确数、错误数、得分、正确率、时长与提交时间，并可展开单条记录查看逐题作答明细。', '成绩记录管理', '/admin/records', 'GET /api/admin/records、GET /api/admin/records/:id', 'study_records、users、user_answers', 'admin_records_zh.png'],
  ['FR-20 等级管理', '管理员维护 HSK1、HSK2、校园生活等汉语等级，列表显示编码、名称、描述、排序、状态与关联题目数，支持新增、修改与删除；名称和描述按语言分别录入，写入时只覆盖当前语种，不丢失其他语种内容。', '等级管理列表', '/admin/levels', 'GET /api/admin/levels、GET /api/admin/levels/:id、POST /api/admin/levels、PUT /api/admin/levels/:id、DELETE /api/admin/levels/:id', 'levels、level_translations、questions', 'admin_levels_zh.png'],
  ['FR-21 分类管理', '管理员维护拼音、词汇、语法、阅读等题目分类，支持父子分类结构，列表显示编码、名称、描述、排序、状态与题目数，支持新增、修改与删除，分类名称与描述同样按语言分别录入。', '分类管理列表', '/admin/categories', 'GET /api/admin/categories、GET /api/admin/categories/:id、POST /api/admin/categories、PUT /api/admin/categories/:id、DELETE /api/admin/categories/:id', 'question_categories、question_category_translations、questions', 'admin_categories_zh.png'],
  ['FR-22 登录日志管理', '管理员分页查看全平台登录日志，可按用户名关键词、操作类型、成功状态与创建时间区间筛选，列表显示操作、结果、IP 地址、消息、创建时间与所属用户。', '登录日志列表', '/admin/login-logs', 'GET /api/admin/login-logs', 'login_logs、users', 'admin_login_logs_zh.png'],
  ['FR-23 在线状态管理', '管理员按可调的在线窗口分钟数查看当前在线用户，列表显示角色、语言、状态、最近活跃、最近登录、登录次数与空闲分钟数，并给出在线总数以及学生与管理员的人数分布。', '在线状态列表', '/admin/online', 'GET /api/admin/online', 'users（last_active_at、last_login_at、login_count）', 'admin_online_zh.png'],
  ['FR-24 智能体设置', '管理员维护智能体运行参数：默认模型、启用场景、两个场景的欢迎语、语音开关与自动播报、最大工具轮数与上下文窗口；页面同时显示模型服务地址、保活时长与已加载模型，并提供手动刷新模型列表的入口。', '智能体设置', '/admin/ai/settings', 'GET /api/admin/ai/settings、PUT /api/admin/ai/settings、POST /api/admin/ai/settings/refresh-models', 'system_settings', 'admin_ai_settings_zh.png'],
  ['FR-25 智能体会话', '管理员分页查看全平台智能体会话，可按标题关键词与场景筛选，列表显示所属用户、使用模型、消息数、创建时间与最近活跃时间，并可展开消息内容或删除会话。', '智能体会话列表', '/admin/ai/sessions', 'GET /api/admin/ai/sessions、GET /api/admin/ai/sessions/:id/messages、DELETE /api/admin/ai/sessions/:id', 'ai_sessions、ai_messages、users', 'admin_ai_sessions_zh.png'],
  ['FR-26 智能体调用日志', '管理员分页查看智能体调用日志，可按用户名、模型、场景与状态筛选，列表显示本次调用使用的工具、输入与输出字符数、耗时、状态与错误信息，并汇总平均耗时与失败次数。', '智能体调用日志', '/admin/ai/logs', 'GET /api/admin/ai/logs', 'ai_call_logs、ai_sessions、users', 'admin_ai_logs_zh.png'],
  ['FR-27 智能体弹框问答与流式输出', '登录用户在任意页面点击右下角悬浮球打开对话弹框，输入问题后后台以 SSE 逐字返回回答；帧序为 meta、tool_call、tool_result、delta、done，前端实时渲染增量文本，回答结束后把会话、消息与调用日志写入数据库。场景随角色切换，学员进入汉语学习助教、管理员进入平台管理助手。', '智能体对话弹框', '全局悬浮球（示例 /）', 'GET /api/ai/agent、POST /api/ai/chat', 'ai_sessions、ai_messages、ai_call_logs', 'agent_modal_trilingual.png'],
  ['FR-28 模型发现、预热与装卸', '后台通过本机模型运行时的标签、进程与模型信息接口列举可用模型及加载状态，未配置默认模型时按参数量挑选推荐值；智能体弹框打开即触发模型列表预热，管理员与用户均可手动加载、卸载模型并刷新列表，冷加载期间页面给出明确提示。', '智能体设置、智能体对话弹框', '/admin/ai/settings', 'GET /api/ai/models、POST /api/ai/models/load、POST /api/ai/models/unload', 'system_settings', 'admin_ai_settings_zh.png'],
  ['FR-29 语音播报', '智能体回答可一键语音播报，播报前剥离 Markdown 标记并清洗为自然短句，再交当前语音提供方朗读；开启自动播报后每次回答结束自动朗读，新一轮提问或关闭自动播报会立即打断正在播放的语音。', '智能体对话弹框', '全局悬浮球', '前端 useVoice 与 speech 封装（无服务端接口）', 'system_settings（voice_enabled、voice_auto_speak）', 'agent_modal_trilingual.png'],
  ['FR-30 语音对话', '用户点击麦克风按钮用母语提问，识别出的文本自动填入输入框并可直接提交；识别与播报的提供方各自独立解析，允许安卓原生麦克风搭配浏览器语音合成的组合，语音不可用时页面区分提示安全上下文不满足或浏览器不支持，不静默失败。', '智能体对话弹框', '全局悬浮球', '前端 useVoice 与 speech 封装（无服务端接口）', 'ai_sessions、ai_messages', 'agent_modal_trilingual.png'],
  ['FR-31 安卓原生语音桥', '页面运行在安卓 App 的 WebView 容器中时改用宿主原生语音能力：页面通过 JavaScript 桥调用原生识别与合成，原生结果回调在 UI 线程写回页面；识别与合成按安卓桥、Capacitor 插件、iOS 消息处理器、浏览器接口的顺序探测。', '智能体对话弹框（安卓 WebView）', '全局悬浮球', 'window.AndroidVoice 桥、Capacitor 插件、iOS messageHandlers', '无（设备侧能力）', 'agent_modal_trilingual.png']
];

const modules = [
  ['M1 公共服务与账号安全模块', '学生、管理员', '注册、登录、退出、修改密码、6 位重置码找回密码、个人资料与头像、本人登录日志、在线状态心跳、失败锁定与令牌吊销', '/login、/register、/forgot-password、/profile、/admin/login-logs、/admin/online', 'users、password_resets、login_logs'],
  ['M2 学生练习模块', '学生', '练习列表、试卷详情、逐题作答、提交判分，成绩与错题在同一个事务内写入', '/practice、/practice/:id、/api/learning/papers*', 'papers、paper_questions、questions、question_options、study_records、user_answers'],
  ['M3 成绩与错题模块', '学生、管理员', '个人成绩回看、错题归集与解析、错误次数累计、订正状态维护、管理端全量成绩检索与逐题明细', '/records、/wrong-book、/admin/records', '/api/learning/records、/api/learning/wrong-questions、/api/admin/records', 'study_records、wrong_questions、favorite_questions、user_answers'],
  ['M4 管理台分页管理模块', '管理员', '十二个菜单全部分页查询、关键词与条件筛选、题库与试卷及等级分类的增删改、多语言字段按语言录入、用户状态与角色调整、重置密码与解锁账号', '/admin 下的十二个菜单', '/api/admin/*（admin.js 与 adminContent.js）', 'users、questions、papers、levels、question_categories、study_records'],
  ['M5 定制化智能体模块', '学生、管理员', '场景化系统提示词、业务快照注入、服务端工具读取真实数据、意图预接地、SSE 流式输出、会话与调用日志、模型发现与装卸、默认模型推荐', '全局悬浮球弹框、/admin/ai/settings、/admin/ai/sessions、/admin/ai/logs', '/api/ai/*', 'ai_sessions、ai_messages、ai_call_logs、system_settings'],
  ['M6 语音交互模块', '学生、管理员', '语音播报、语音对话、原生桥优先、Capacitor 与 iOS 桥兼容、浏览器语音接口兜底、不可用时明确提示原因、播报前剥离 Markdown、新一轮提问打断播报', '智能体弹框语音控件', '无（纯前端与设备侧原生桥）', '无（语音开关存于 system_settings）'],
  ['M7 国际化模块', '学生、管理员', '中文、英文、马来语界面文案与语言状态维护，界面语言落到用户表，题库与试卷内容按语言代码读取', '顶部语言切换、智能体弹框语言选择', 'lang 查询参数', 'level_translations、question_category_translations、question_translations、question_option_translations、paper_translations、i18n_messages'],
  ['M8 日志与运维模块', '运维人员', '请求日志、错误日志、敏感字段脱敏、数据库初始化、增量迁移与版本记录、演示账号种子脚本', 'npm run db:init / db:migrate / seed:users', 'logger.js、requestLogger.js、migrate.js', 'schema_migrations']
];

/** 截图键、页面名称与图幅类型，顺序即第 8 章的图序。 */
const screenshotSections = [
  ['login_trilingual.png', '登录页面', '三语并排'],
  ['register_trilingual.png', '注册页面', '三语并排'],
  ['forgot_password_trilingual.png', '找回密码页面', '三语并排'],
  ['home_trilingual.png', '学生首页', '三语并排'],
  ['practice_list_trilingual.png', '练习列表', '三语并排'],
  ['practice_detail_trilingual.png', '答题详情', '三语并排'],
  ['records_trilingual.png', '成绩记录', '三语并排'],
  ['wrong_book_trilingual.png', '错题本', '三语并排'],
  ['profile_trilingual.png', '个人中心', '三语并排'],
  ['agent_modal_trilingual.png', '智能体对话弹框', '三语并排'],
  ['admin_dashboard_zh.png', '管理台数据看板', '中文单幅'],
  ['admin_students_zh.png', '学生管理列表', '中文单幅'],
  ['admin_questions_zh.png', '题库管理列表', '中文单幅'],
  ['admin_papers_zh.png', '练习试卷列表', '中文单幅'],
  ['admin_records_zh.png', '成绩记录管理', '中文单幅'],
  ['admin_levels_zh.png', '等级管理列表', '中文单幅'],
  ['admin_categories_zh.png', '分类管理列表', '中文单幅'],
  ['admin_login_logs_zh.png', '登录日志列表', '中文单幅'],
  ['admin_online_zh.png', '在线状态列表', '中文单幅'],
  ['admin_ai_settings_zh.png', '智能体设置', '中文单幅'],
  ['admin_ai_sessions_zh.png', '智能体会话列表', '中文单幅'],
  ['admin_ai_logs_zh.png', '智能体调用日志', '中文单幅']
];

const screenshotNotes = {
  'login_trilingual.png': '该图并排展示登录页面在中文、英文、马来语三种界面语言下的运行效果。三个面板的站点名、导航项与语言下拉当前值随面板语言变化，表单包含用户名、密码、记住用户名复选框与整宽登录按钮，下方另设忘记密码与注册入口。该图说明未登录用户进入系统前需经过统一认证入口，并且可以在登录之前先切换到自己熟悉的界面语言。',
  'register_trilingual.png': '该图展示注册页面的三语表单效果。三个面板的字段标签均随语言切换，字段依次为用户名、密码、确认密码、姓名、邮箱、学号、国籍与语言下拉，密码框下方给出位数与字母数字组合的校验提示，底部为整宽注册按钮与返回登录的链接。该图说明系统为留学生提供自助建档入口，注册资料是练习记录、错题本与个人中心的用户归属依据。',
  'forgot_password_trilingual.png': '该图展示找回密码页面的三语效果。三个面板均包含用户名、身份验证方式下拉、邮箱字段与获取重置码按钮，底部是返回登录的链接。该图说明忘记密码时需先用用户名配合绑定邮箱或学号核验身份，核验通过后由后台签发 6 位数字重置码，凭码在有效期内设置新密码，身份不匹配时返回统一提示而不暴露账号是否存在。',
  'home_trilingual.png': '该图展示学生登录后的首页。三个面板顶部导航均为首页、练习、成绩、错题本、个人中心、退出与语言下拉，正文标题为平台名称，其下并排三张入口卡片，分别指向练习、错题本与成绩。右下角常驻智能体悬浮球，按钮文字随面板语言变化，依次显示汉语学习助手、Chinese Learning Tutor 与 Tutor Bahasa Cina。',
  'practice_list_trilingual.png': '该图展示练习列表页面。三个面板的导航与页面标题一致，正文以卡片形式列出已发布练习，卡片包含练习标题、说明、等级标签、题数与限时，图中可见校园生活汉语练习、HSK2 基础语法练习与 HSK1 每日练习三套。该图说明练习标题与说明由后台按语言从试卷翻译表读取，卡片同时给出题量和建议时长，便于学生按等级选择练习。',
  'practice_detail_trilingual.png': '该图展示在线答题页面。页面顶部为试卷标题、当前题号进度与返回按钮，题干区显示分类与难度标签、作答提示、题干文本与四个单选项，底部为下一题按钮，右侧题号面板列出全部题号供跳转。该图说明学生可逐题阅读题干与选项并作答，答题进度与题号导航保持在同一个页面内，作答完成后可整体提交判分。',
  'records_trilingual.png': '该图展示成绩记录页面。三个面板均以表格呈现历史练习结果，列标题为标题、题数、正确、错误、得分与提交时间，图中可看到多行 HSK1 每日练习与 HSK2 基础语法练习的记录，每条记录的题数、正确数、错误数与得分相互对应。该图说明学生每次提交练习后都会形成可回看的成绩记录，记录按提交时间倒序返回。',
  'wrong_book_trilingual.png': '该图展示错题本页面。正文以卡片形式列出历史错题，每张卡片包含分类标签、错误次数、题干以及解析文本，图中可见词汇、阅读与语法等不同分类的错题及其解析说明。该图说明系统在学生答错时归集错题并累计错误次数，学生可据此复习薄弱知识点，解析文本同样来自题库的多语言翻译表。',
  'profile_trilingual.png': '该图展示个人中心页面，自上而下分为资料维护、修改密码与登录日志三个区块。资料区包含头像、上传头像控件、姓名、邮箱、电话、学号、国籍、语言字段与保存按钮；修改密码区包含当前密码、新密码、确认密码与修改密码按钮；登录日志区为操作、状态、IP 地址、创建时间的四列表格并带翻页控件。',
  'agent_modal_trilingual.png': '该图展示智能体对话弹框。中文面板已完成一次错题提问，回答以编号列表给出错题数量、题干、分类、等级与解析；英文与马来语面板显示对应语言的欢迎语与四条建议问句。弹框底部为语音播报、语音通话、语言下拉、新建会话控件与提问输入框，右下角为进入弹框的悬浮球入口。',
  'admin_dashboard_zh.png': '该图展示管理台数据看板。页面顶部为六个指标卡，依次显示学生数、在线人数、题目数、练习数、答题记录数与正确率；其下为近 7 日趋势与各等级表现两个区块；再下方为高频错题表与最近答题表，前者的列含编号、标题、题型、难度、错误与正确，后者含编号、用户名、总分、正确、题数与提交时间。',
  'admin_students_zh.png': '该图展示学生管理列表。筛选栏提供用户名搜索框以及角色、状态、在线状态三个下拉与重置按钮；表格列依次为编号、用户名、姓名、角色、状态、在线状态、答题记录、平均分、错题本、最近活跃、最近登录、登录次数与操作，操作列含编辑、重置密码、解锁与删除按钮；表格底部显示总条数、每页条数与翻页控件。',
  'admin_questions_zh.png': '该图展示题库管理列表。筛选栏包含搜索框、等级、分类、题型、难度、状态与排序下拉以及重置按钮，右上角为新增按钮；表格列依次为编号、标题、等级、分类、题型、难度、得分、选项数、状态、创建时间与操作，操作列含编辑与删除；分页区显示总条数、每页条数与页码。',
  'admin_papers_zh.png': '该图展示练习与试卷管理列表。筛选栏包含搜索框、试卷类型、等级、状态与排序下拉及重置按钮，右上角为新增按钮；表格列依次为编号、标题、试卷类型、等级、题数、练习次数、总分、时长、状态与操作，操作列含编辑、组卷与删除；图中可见校园生活汉语练习、HSK2 基础语法练习与 HSK1 每日练习三行数据。',
  'admin_records_zh.png': '该图展示成绩记录管理列表。筛选栏提供用户名搜索框、提交时间区间选择与重置按钮；表格列依次为序号、用户名、标题、正确、错误、得分、正确率、时长、提交时间与操作，操作列为明细按钮；分页区显示总条数与每页条数控件。该图说明管理员可集中检索全量答题结果，并逐条展开查看作答明细。',
  'admin_levels_zh.png': '该图展示等级管理列表。筛选栏包含搜索框、状态与排序下拉及重置按钮，右上角为新增按钮；表格列依次为编号、编码、名称、描述、排序、状态、题数与操作，操作列含编辑与删除；图中三行数据分别为 HSK1、HSK2 与 CAMPUS 三个等级。该图说明等级名称与描述按语言分别录入，并统计各等级下的题目数量。',
  'admin_categories_zh.png': '该图展示分类管理列表。筛选栏包含搜索框、状态与排序下拉及重置按钮，右上角为新增按钮；表格列依次为编号、编码、名称、上级分类、描述、排序、状态、题数与操作，操作列含编辑与删除；图中四行数据分别为拼音、词汇、语法与阅读分类，并显示各分类下的题目数量，说明分类支持父子层级结构。',
  'admin_login_logs_zh.png': '该图展示登录日志列表。筛选栏包含用户名搜索框、操作与结果两个下拉、创建时间区间与重置按钮；表格列依次为编号、用户名、姓名、操作、结果、IP 地址、消息、创建时间与类型；分页区显示总条数、每页条数与页码并支持跳页。该图说明登录、退出、注册、改密与重置等账号动作均会留痕，便于事后追溯。',
  'admin_online_zh.png': '该图展示在线状态列表。页面顶部为在线总数、学生数与后台管理三个统计卡，并显示当前在线窗口分钟数；筛选栏包含在线窗口分钟数输入、角色下拉、用户名搜索框与重置按钮；表格列依次为编号、用户名、姓名、角色、语言、状态、最近活跃、最近登录、登录次数、空闲分钟与在线状态，末列为在线标签。',
  'admin_ai_settings_zh.png': '该图展示智能体设置页面。顶部四个卡片显示模型服务状态、服务地址、保活时长与请求耗时上限；表单区依次为默认模型下拉与加载、卸载、刷新模型三个按钮，启用场景复选框、两个场景的欢迎语文本域，启用语音与自动播报复选框，最大工具轮数与上下文窗口输入框，底部为保存按钮。',
  'admin_ai_sessions_zh.png': '该图展示智能体会话列表。筛选栏包含标题搜索框、类型下拉与重置按钮；表格列依次为序号、标题、用户名、类型、模型、消息数、创建时间、最近活跃与操作，操作列含消息与删除按钮；图中十条会话的标题多为「我有哪些错题？」。该图说明每次弹框问答都会落库为可检索的会话记录，并累计消息条数。',
  'admin_ai_logs_zh.png': '该图展示智能体调用日志。筛选栏包含用户名搜索框、模型输入框、类型与状态下拉及重置按钮；顶部两个卡片显示平均耗时与失败次数；表格列依次为序号、用户名、类型、模型、工具、输入字符、输出字符、耗时、状态、创建时间与失败，工具列可见 get_my_wrong_questions 等工具名。'
};

const dataTables = [
  ['users', 'id、username、password、name、email、phone、role、student_no、nationality、language、status、avatar_url、last_active_at、last_login_at、login_count、failed_login_count、locked_until、token_version、created_at、updated_at', '保存学生与管理员账号。username 唯一，password 存 bcrypt 哈希，role 区分 student 与 admin，status 控制账号是否可用；avatar_url 记录头像访问地址，last_active_at 与 last_login_at 支撑在线状态，login_count 与 failed_login_count 记录登录与失败次数，locked_until 为锁定截止时间，token_version 为令牌吊销版本号，last_active_at 建有索引。'],
  ['levels', 'id、code、sort_order、status、created_at', '保存 HSK1、HSK2、校园生活等汉语等级主数据，code 唯一，sort_order 决定前台顺序，status 控制是否展示。'],
  ['level_translations', 'id、level_id、language_code、name、description', '保存等级的中文、英文、马来语名称与说明，按 level_id 与 language_code 建立唯一约束，随等级删除级联清理。'],
  ['question_categories', 'id、parent_id、code、sort_order、status', '保存拼音、词汇、语法、阅读等题目分类，parent_id 指向自身形成父子层级，父分类删除时置空。'],
  ['question_category_translations', 'id、category_id、language_code、name、description', '保存分类的多语言名称与描述，用于练习卡片、题目详情与管理端分类列表。'],
  ['questions', 'id、level_id、category_id、question_type、difficulty、score、audio_url、image_url、status、created_by、created_at、updated_at', '保存题目主数据，关联等级与分类；question_type 区分单选、多选、判断与填空，difficulty 区分 easy、normal、hard，score 保存分值，audio_url 与 image_url 保存题干附件的地址，created_by 记录创建人并在用户删除时置空。'],
  ['question_translations', 'id、question_id、language_code、title、content、analysis', '保存题目标题、题干与解析的多语言文本，按 question_id 与 language_code 唯一，是学生三语答题页面的数据来源。'],
  ['question_options', 'id、question_id、option_key、is_correct、sort_order', '保存题目选项与正确答案标记，option_key 表示 A、B、C、D 等选项编号，与题目组合唯一。'],
  ['question_option_translations', 'id、option_id、language_code、content', '保存选项内容的多语言文本，保证同一道题在不同语言界面下展示对应语言的选项。'],
  ['papers', 'id、paper_type、level_id、total_score、duration_minutes、status、created_at、updated_at', '保存练习与试卷主数据，paper_type 区分练习、考试与每日练习，记录所属等级、总分、建议时长与发布状态。'],
  ['paper_translations', 'id、paper_id、language_code、title、description', '保存试卷标题与说明的多语言文本，用于练习列表与管理端试卷列表。'],
  ['paper_questions', 'id、paper_id、question_id、sort_order、score', '维护试卷与题目的关联关系，记录题目顺序与在当前试卷中的分值，同一试卷内题目唯一。'],
  ['study_records', 'id、user_id、paper_id、total_questions、correct_count、wrong_count、total_score、duration_seconds、started_at、submitted_at', '保存学生每次练习提交后的汇总成绩，是成绩记录与管理端统计的数据基础，用户删除时级联清理、试卷删除时置空。'],
  ['user_answers', 'id、user_id、question_id、paper_id、study_record_id、selected_option_ids、answer_text、is_correct、score、answered_at', '保存逐题作答明细，selected_option_ids 记录所选选项编号，answer_text 保留填空类作答文本，is_correct 与 score 记录该题判分结果，并关联到所属学习记录。'],
  ['wrong_questions', 'id、user_id、question_id、wrong_count、resolved、last_wrong_at', '保存学生错题，同一学生对同一题目唯一，wrong_count 累计错误次数，resolved 标记是否已订正，last_wrong_at 记录最近答错时间。'],
  ['favorite_questions', 'id、user_id、question_id、created_at', '保存学生收藏的题目，按学生与题目建立唯一约束，用于后续复习入口。'],
  ['i18n_messages', 'id、module、message_key、language_code、message_value', '动态国际化消息表，按模块、键名与语言唯一，可在不改代码的前提下补充界面文案。'],
  ['password_resets', 'id、user_id、code_hash、expires_at、used_at、created_at', '保存找回密码的重置码记录，code_hash 存重置码的 bcrypt 哈希而不存明文，expires_at 为失效时间，used_at 记录一次性消费时间；按 user_id 与 expires_at 建有索引。'],
  ['login_logs', 'id、user_id、username、action、success、ip、user_agent、message、created_at', '保存账号动作日志，action 取值为 login、logout、register、change_password 或 reset_password，success 标记成功与否，同时记录 IP、浏览器标识与说明；按创建时间、用户与动作建有索引，用户删除时仅置空 USER_ID 而保留日志。'],
  ['ai_sessions', 'id、user_id、scene、title、model、message_count、created_at、updated_at', '保存智能体会话，scene 区分学员场景与管理员场景，title 取首次提问的前若干字符，model 记录本次会话使用的模型，message_count 累计消息条数；按用户与场景分别建有索引。'],
  ['ai_messages', 'id、session_id、role、content、tool_name、tool_args、model、latency_ms、created_at', '保存会话内的逐条消息，role 取值为 system、user、assistant 或 tool，工具消息额外记录工具名与参数，助手消息记录模型与响应耗时；按会话与消息编号建有索引。'],
  ['ai_call_logs', 'id、user_id、session_id、scene、model、tool_names、prompt_chars、completion_chars、latency_ms、status、error、created_at', '保存每一次智能体调用的运行记录，tool_names 汇总本次调用使用过的工具，prompt_chars 与 completion_chars 记录输入输出字符数，status 标记成功或失败并存留错误信息；按创建时间、模型与状态建有索引。'],
  ['system_settings', 'setting_key、setting_value、updated_at', '键值形式的系统设置表，以 setting_key 为主键，保存智能体默认模型、启用场景、场景欢迎语、语音开关与自动播报、最大工具轮数与上下文窗口等运行参数。'],
  ['schema_migrations', 'id、description、applied_at', '由迁移工具在执行增量迁移时自动创建，记录已应用的迁移标识与说明，重复执行时跳过已记录版本，保证迁移幂等。']
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

/**
 * 三线表；caption 非空时在表格上方输出表题（表题在上，图题在下）。
 * 列宽交给浏览器的自动表格布局：多列密集表格上，固定布局会把接口路径和表名切断。
 * 只有「图 8-12」这类交叉引用强制不折行，否则末列会被撑成竖排文字。
 */
function table(headers, rows, caption = '') {
  // 需求编号与交叉引用强制不折行：否则自动布局会把首列压到两三个字宽，
  // 「FR-06 个人资料维护」会被拆成逐字竖排，末列的「图 8-12」同样会被撑成竖排。
  // 源码册表 2-1 的「所属层次」列同理：CJK 可在任意字间断行，自动布局会把它压成
  // 「后台/数据」+「层」两行，故层名整格不折行。
  // 单元格内的换行按 <br> 输出，用于「页面名 / 访问路径」这类同列双行内容。
  const cell = (value) => {
    const html = esc(value).replace(/\n/g, '<br>');
    // 注意：前两个是「前缀匹配」（「FR-01 用户登录」整格不折行），后三个是「整格相等」。
    // 两组必须分开写，不能合并成一条带 $ 的正则，否则前缀匹配会失效。
    const nowrap = /^(FR-\d+|图 \d+-\d+)/.test(value)
      || /^(后台\/数据层|前台页面层|项目配置)$/.test(value);
    return nowrap ? `<td class="nw">${html}</td>` : `<td>${html}</td>`;
  };
  const head = `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')}</tbody></table>`;
  return caption ? `<p class="tcap">${esc(caption)}</p>${head}` : head;
}

function image(file, caption, cls = '') {
  return `<figure class="${cls}"><img src="${esc(file)}"><figcaption>${esc(caption)}</figcaption></figure>`;
}

function diagram(file) {
  return `../images/diagrams/${file}`;
}

function screen(file) {
  return `../images/screenshots/${file}`;
}

function docCss() {
  return `<style>
@page { size: A4; margin: 18mm 14mm 18mm; }
body { font-family: "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; color:#000; background:#fff; font-size:12px; line-height:1.62; font-variant-emoji:text; }
h1 { text-align:center; font-size:25px; margin:8px 0 18px; letter-spacing:0; }
h2 { font-size:17px; margin:18px 0 8px; padding-bottom:4px; border-bottom:1.2px solid #000; page-break-after:avoid; }
h3 { font-size:14px; margin:13px 0 6px; page-break-after:avoid; }
p { margin:5px 0; text-align:justify; }
.cover { height:210mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; page-break-after:always; }
.cover .title { font-size:30px; font-weight:700; margin-bottom:18px; }
.cover .sub { font-size:18px; margin:4px 0; }
.muted { color:#000; }
.summary { border-left:3px solid #000; padding:6px 12px; margin:10px 0; }
table { width:100%; border-collapse:collapse; margin:4px 0 12px; font-size:10.2px; border-top:1.4px solid #000; border-bottom:1.4px solid #000; page-break-inside:auto; }
thead { display:table-header-group; }
th { border-bottom:1px solid #000; text-align:left; font-weight:700; }
th,td { padding:4px 6px; vertical-align:top; }
td.nw { white-space:nowrap; }
.tcap { font-size:10.5px; font-weight:700; text-align:center; margin:10px 0 2px; page-break-after:avoid; }
figure { margin:10px 0 16px; text-align:center; page-break-inside:avoid; }
figure img { max-width:100%; object-fit:contain; }
figure.diagram img { max-height:170mm; }
figure.screen img { width:100%; max-height:155mm; border:1px solid #000; }
figcaption { margin-top:5px; font-size:10.5px; color:#000; text-align:center; }
.req-shot { page-break-before:auto; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
</style>`;
}

function codeCss() {
  return `<style>
@page { size:A4; margin:17mm 13mm 16mm; }
body { font-family:"Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; color:#000; background:#fff; font-size:11.2px; line-height:1.5; font-variant-emoji:text; }
h1 { text-align:center; font-size:22px; margin:8px 0 14px; }
h2 { font-size:15px; margin:13px 0 6px; border-bottom:1px solid #000; padding-bottom:3px; page-break-after:avoid; }
h3 { font-size:12px; margin:9px 0 4px; page-break-after:avoid; }
p { margin:3px 0; text-align:justify; }
table { width:100%; border-collapse:collapse; margin:7px 0 10px; font-size:9.5px; border-top:1.3px solid #000; border-bottom:1.3px solid #000; }
th { border-bottom:1px solid #000; }
th,td { padding:3px 5px; text-align:left; vertical-align:top; }
/* table() 会给需求编号、图号与「所属层次」列加 .nw；本表若缺这条规则，class 形同虚设。 */
td.nw { white-space:nowrap; }
.tcap { font-size:9.5px; font-weight:700; text-align:center; margin:9px 0 2px; page-break-after:avoid; }
/* 源码正文里含有真实存在的 emoji（悬浮球图标、播报与麦克风按钮），源码文本不能改，
   因此改用文字呈现变体 + 单色符号字体，让 Chrome 以黑白轮廓渲染而不是彩色 emoji 字形。 */
pre { margin:5px 0 12px; padding:7px 9px; border:1px solid #000; white-space:pre-wrap; word-break:break-word; font-family:"Noto Sans Mono CJK SC", "Noto Sans Symbols2", "Noto Sans CJK SC", Consolas, monospace; font-variant-emoji:text; font-size:9.9px; line-height:1.34; page-break-inside:auto; }
.file-meta { border-left:3px solid #000; padding:5px 8px; margin:4px 0 5px; }
.cover { height:200mm; display:flex; flex-direction:column; justify-content:center; align-items:center; page-break-after:always; text-align:center; }
.cover .title { font-size:28px; font-weight:700; margin-bottom:18px; }
</style>`;
}

function htmlWrap(title, css, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>${css}</head><body>${body}</body></html>`;
}

/** 截图键 → 图号，供需求清单与第 8 章互相引用。 */
const figureNo = new Map(screenshotSections.map(([file], index) => [file, index + 1]));

/** 第 7 章接口清单，按挂载点分组。 */
const apiGroups = [
  ['表 7-1 公共服务接口（挂载点 /api/auth，共 10 个）', [
    ['POST /api/auth/register', '公开', '学生注册，写入用户表并记录注册日志，含每小时 10 次的限流。'],
    ['POST /api/auth/login', '公开', '校验账号状态、锁定状态与密码，签发含令牌版本号的 7 天令牌，含每 15 分钟 30 次的限流。'],
    ['POST /api/auth/logout', '登录用户', '记录一条退出日志，前端清除本地登录态。'],
    ['GET /api/auth/profile', '登录用户', '查询当前登录用户的公开资料字段。'],
    ['PUT /api/auth/profile', '登录用户', '更新姓名、邮箱、电话、国籍与界面语言。'],
    ['POST /api/auth/profile/avatar', '登录用户', '按魔数校验图片类型后保存头像并回写访问地址，限 2MB。'],
    ['POST /api/auth/change-password', '登录用户', '校验当前密码后重设密码，并自增令牌版本号吊销全部旧令牌。'],
    ['POST /api/auth/password/forgot', '公开', '核验身份后签发 6 位重置码，有效期 10 分钟，含每 15 分钟 5 次的限流。'],
    ['POST /api/auth/password/reset', '公开', '校验一次性重置码后重设密码并吊销旧令牌。'],
    ['GET /api/auth/login-logs', '登录用户', '分页查询本人的登录日志，可按操作类型筛选。']
  ]],
  ['表 7-2 学习练习接口（挂载点 /api/learning，共 7 个）', [
    ['GET /api/learning/levels', '公开', '按语言返回启用状态的等级列表。'],
    ['GET /api/learning/categories', '公开', '按语言返回启用状态的题目分类列表。'],
    ['GET /api/learning/papers', '公开', '按语言返回已发布试卷，含题数与建议时长。'],
    ['GET /api/learning/papers/:id', '登录用户', '返回试卷详情及按语言翻译后的题目与选项。'],
    ['POST /api/learning/papers/:id/submit', '登录用户', '事务内判分并写入学习记录、作答明细与错题本。'],
    ['GET /api/learning/records', '登录用户', '返回本人成绩记录，按提交时间倒序。'],
    ['GET /api/learning/wrong-questions', '登录用户', '返回本人错题及错误次数与解析。']
  ]],
  ['表 7-3 管理台接口（挂载点 /api/admin，共 39 个）', [
    ['GET /api/admin/stats', '管理员', '返回看板指标、近 7 日趋势、各等级表现、高频错题与最近答题。'],
    ['GET /api/admin/users', '管理员', '分页检索用户，支持关键词、角色、状态、在线状态筛选。'],
    ['GET /api/admin/users/:id', '管理员', '查询单个用户详情。'],
    ['PATCH /api/admin/users/:id', '管理员', '调整用户状态或角色，停用账号时自增令牌版本号。'],
    ['POST /api/admin/users/:id/reset-password', '管理员', '以管理员身份重置指定用户密码并吊销其全部令牌。'],
    ['POST /api/admin/users/:id/unlock', '管理员', '清除失败次数与锁定截止时间。'],
    ['DELETE /api/admin/users/:id', '管理员', '删除用户，禁止删除当前登录的管理员本人。'],
    ['GET /api/admin/records', '管理员', '分页检索全量成绩记录，支持关键词与时间区间筛选。'],
    ['GET /api/admin/records/:id', '管理员', '查询单条成绩记录及其逐题作答明细。'],
    ['GET /api/admin/login-logs', '管理员', '分页检索全平台登录日志。'],
    ['GET /api/admin/online', '管理员', '按在线窗口分钟数分页返回在线用户并汇总人数分布。'],
    ['GET /api/admin/levels', '管理员', '分页检索等级，含各等级题目数。'],
    ['GET /api/admin/levels/:id', '管理员', '查询单个等级及其多语言内容。'],
    ['POST /api/admin/levels', '管理员', '新增等级并写入多语言名称与描述。'],
    ['PUT /api/admin/levels/:id', '管理员', '修改等级及其多语言内容，只覆盖提交的语种。'],
    ['DELETE /api/admin/levels/:id', '管理员', '删除等级，有关联题目时拒绝删除。'],
    ['GET /api/admin/categories', '管理员', '分页检索题目分类，含各级题目数。'],
    ['GET /api/admin/categories/:id', '管理员', '查询单个分类及其多语言内容。'],
    ['POST /api/admin/categories', '管理员', '新增分类，可指定上级分类形成层级。'],
    ['PUT /api/admin/categories/:id', '管理员', '修改分类及其多语言内容。'],
    ['DELETE /api/admin/categories/:id', '管理员', '删除分类，有关联题目或子分类时拒绝删除。'],
    ['GET /api/admin/questions', '管理员', '分页检索题目，支持关键词、等级、分类、题型、难度与状态筛选。'],
    ['GET /api/admin/questions/:id', '管理员', '查询题目详情，含多语言题干、选项与解析。'],
    ['POST /api/admin/questions', '管理员', '新增题目及其选项与多语言文本。'],
    ['PUT /api/admin/questions/:id', '管理员', '修改题目及其选项与多语言文本。'],
    ['DELETE /api/admin/questions/:id', '管理员', '删除题目。'],
    ['GET /api/admin/papers', '管理员', '分页检索试卷，含题数与练习次数。'],
    ['GET /api/admin/papers/:id', '管理员', '查询试卷详情及其组卷题目。'],
    ['POST /api/admin/papers', '管理员', '新增试卷并写入多语言标题与说明。'],
    ['PUT /api/admin/papers/:id', '管理员', '修改试卷及其多语言内容。'],
    ['PUT /api/admin/papers/:id/questions', '管理员', '整体替换试卷的题目集合与每题分值。'],
    ['DELETE /api/admin/papers/:id', '管理员', '删除试卷及其组卷关系。'],
    ['GET /api/admin/ai/settings', '管理员', '返回智能体设置、可用模型、运行中模型与默认值。'],
    ['PUT /api/admin/ai/settings', '管理员', '更新智能体设置，校验场景标识与数值区间。'],
    ['POST /api/admin/ai/settings/refresh-models', '管理员', '清空模型缓存并重新拉取模型列表。'],
    ['GET /api/admin/ai/sessions', '管理员', '分页检索全平台智能体会话。'],
    ['GET /api/admin/ai/sessions/:id/messages', '管理员', '查询指定会话的消息列表。'],
    ['DELETE /api/admin/ai/sessions/:id', '管理员', '删除指定会话及其消息。'],
    ['GET /api/admin/ai/logs', '管理员', '分页检索智能体调用日志，含耗时与失败汇总。']
  ]],
  ['表 7-4 智能体接口（挂载点 /api/ai，共 10 个）', [
    ['GET /api/ai/health', '登录用户', '返回智能体开关状态与模型运行时版本。'],
    ['GET /api/ai/models', '登录用户', '返回可用模型、加载状态与推荐默认模型。'],
    ['POST /api/ai/models/load', '登录用户', '预热指定模型，含每分钟 10 次的限流。'],
    ['POST /api/ai/models/unload', '登录用户', '卸载指定模型。'],
    ['GET /api/ai/agent', '登录用户', '返回场景名称、欢迎语、建议问句、可用工具与语音开关。'],
    ['GET /api/ai/sessions', '登录用户', '分页返回本人会话，管理员可查看全部会话。'],
    ['GET /api/ai/sessions/:id/messages', '登录用户', '返回指定会话的消息列表。'],
    ['DELETE /api/ai/sessions/:id', '登录用户', '删除本人会话。'],
    ['GET /api/ai/logs', '管理员', '分页返回调用日志。'],
    ['POST /api/ai/chat', '登录用户', '以 SSE 流式返回回答，帧序为 meta、tool_call、tool_result、delta、done，含每分钟 30 次的限流。']
  ]]
];

function designHtml() {
  // 页面名与访问路径合成一列：A4 纵向放不下七列密集文本，拆开会把需求说明压到每行七八个字。
  const reqRows = requirements.map(([id, desc, page, route, api, tableName, shot]) => [
    id, desc, `${page}\n${route}`, api, tableName, `图 8-${figureNo.get(shot)}`
  ]);

  const shotSections = screenshotSections.map(([file, pageName, kind], index) => {
    const related = requirements.filter(([, , , , , , shot]) => shot === file).map(([id]) => id.split(' ')[0]);
    const caption = kind === '三语并排'
      ? `图 8-${index + 1} ${pageName}三语并排运行截图`
      : `图 8-${index + 1} ${pageName}中文界面运行截图`;
    return `
      <h3>8.${index + 1} ${esc(pageName)}（${esc(related.join('、'))}）</h3>
      <p>${esc(screenshotNotes[file])}</p>
      ${image(screen(file), caption, 'screen req-shot')}
    `;
  }).join('\n');

  const body = `
    <section class="cover">
      <div class="title">${softwareName}软件设计说明书</div>
      <div class="sub">软件版本：${version}</div>
      <div class="sub">文档类型：软件著作权登记材料</div>
    </section>
    <h1>${softwareName}软件设计说明书</h1>

    <h2>1 引言</h2>
    <h3>1.1 编写目的</h3>
    <p>${softwareName}面向马来西亚留学生汉语练习场景，提供学生端练习与管理端教学查看两类功能，并内置一个基于本机开源大模型的定制化智能体。本文档说明软件的适用范围、功能需求、模块划分、总体架构、关键机制、数据组织、接口约定、运行部署、安全设计与验证结果，供软件著作权登记与后续维护参考。文档中的图示依据已核验源码、路由、接口与数据库脚本生成，运行截图取自真实启动的前台页面与后台管理界面。</p>
    <h3>1.2 适用范围</h3>
    <p>软件分为学生端、管理端与智能体三条使用路径。学生端支持注册、登录、退出登录、修改密码、以 6 位重置码找回密码、个人资料维护与头像上传、查看本人登录日志，以及首页导航、练习列表、在线答题与提交判分、成绩记录、错题本和个人中心。管理端提供数据看板、学生管理、题库管理、练习试卷、成绩记录、等级管理、分类管理、登录日志、在线状态、智能体设置、智能体会话与智能体调用日志共十二个菜单，每个菜单均为分页查询并支持条件筛选。智能体以全局悬浮球为入口，支持流式问答、语音播报与语音对话，在安卓 App 的 WebView 中改用宿主原生语音能力。后台提供认证、学习练习、管理查询与智能体四组接口，数据库负责保存用户、题库、试卷、成绩、错题、日志、智能体会话与系统设置数据。</p>
    <h3>1.3 术语与约定的口径</h3>
    <p>本文档所称令牌指登录成功后签发的 JWT，其载荷包含用户编号、用户名、角色与令牌版本号；令牌版本号指用户表中的吊销计数，每次改密、被重置或被停用都会自增。工具接地指智能体在回答前调用服务端预先登记的数据查询工具，以数据库中的真实数据作为作答依据。SSE 指服务端事件流，用于逐字返回模型回答。分页契约指分页接口统一返回 list、total、page、pageSize、totalPages 五个字段的约定。文档中的源码规模、数据表数量、接口数量与验证结论均以第 11 章列出的核验结果为准。</p>

    <h2>2 需求分析</h2>
    <h3>2.1 功能需求清单</h3>
    <p>下表列出本轮实现并逐项核验的功能需求，共 ${requirements.length} 项，覆盖公共服务与账号安全、学生练习、管理台分页管理与智能体语音四类能力。表中最后一列给出第 8 章对应的运行截图编号。</p>
    ${table(['编号与名称', '需求说明', '页面与路径', '接口或入口', '核心数据对象', '图号'], reqRows, '表 2-1 功能需求清单')}
    <h3>2.2 非功能需求</h3>
    ${table(['类别', '要求', '实现依据'], [
      ['权限安全', '受保护接口校验令牌与服务端令牌版本号，管理端接口额外校验管理员角色。', 'middleware/auth.js、middleware/role.js、router 守卫'],
      ['账号安全', '连续登录失败达 5 次锁定 15 分钟；改密、重置与停用账号立即吊销已签发令牌。', 'routes/auth.js、users.locked_until、users.token_version'],
      ['接口限流', '登录、注册、改密、找回密码、模型加载与智能体对话按窗口计数限流，超限返回 429。', 'middleware/rateLimit.js'],
      ['国际化', '界面文案与题库内容支持中文、英文、马来语，界面语言落到用户表。', 'i18n/index.js、各翻译表、lang 查询参数'],
      ['数据一致性', '答题提交涉及学习记录、作答明细与错题本多表写入，使用事务保护。', 'config/db.js 的事务封装、POST /api/learning/papers/:id/submit'],
      ['分页一致性', '管理台十二个菜单与本人登录日志统一走分页工具，返回结构固定。', 'utils/paginate.js、composables/usePagedTable.js'],
      ['智能体可信', '涉及个人数据与平台数据的提问必须先读取数据库，工具结果与业务快照以数据块包裹并声明不是指令。', 'services/ai/tools.js、services/ai/agent.js'],
      ['语音可用性', '语音不可用时给出明确原因，不静默失败；识别与播报的提供方各自独立选择。', 'components/agent/voice/*'],
      ['运行审计', '记录请求路径、状态、耗时、用户标识与异常信息，并对敏感字段脱敏。', 'utils/logger.js、middleware/requestLogger.js'],
      ['部署可维护', '前后台独立目录与独立脚本，数据库可初始化并可按版本增量迁移。', 'admin、fronter、schema.sql、seed.sql、utils/migrate.js']
    ], '表 2-2 非功能需求')}

    <h2>3 系统概述</h2>
    <h3>3.1 用户角色与用例</h3>
    ${image(diagram('01_use_case.png'), '图 3-1 横向用例图：该图将学生与管理员两个角色放在同一横向视图中，学生侧覆盖注册登录、语言切换、练习列表、在线答题、成绩记录、错题本与个人资料维护，管理员侧覆盖管理台统计、学生列表、题库列表、试卷列表与成绩记录查看，角色与用例之间的连线用于明确访问边界。本轮新增的智能体问答、语音播报与语音对话在两种角色下均可使用，其分层与运行机制见第 4.3 节与第 5 章。', 'diagram')}
    <h3>3.2 模块结构表</h3>
    ${table(['模块', '服务角色', '核心职责', '页面或接口', '数据对象'], modules, '表 3-1 模块结构表')}
    <h3>3.3 技术选型与运行环境</h3>
    <p>前台目录为 fronter，使用 Vue 3.5.13、Vue Router 4 与 Vite 6 构建为 H5 页面，不依赖第三方 UI 组件库与状态管理库，界面状态使用响应式对象维护，三语文案由手写国际化资源提供。后台目录为 admin，运行在 Node.js 上，使用 Express 4.21、mysql2/promise、jsonwebtoken 与 bcryptjs，按认证、学习练习、后台管理、管理内容、管理智能体与智能体六个路由文件拆分，数据库为 MySQL 8，字符集 utf8mb4。智能体使用部署在本机的 Ollama 运行时，通过其对话、标签、进程与模型信息接口完成推理与模型管理，回答以 SSE 流式返回。语音能力不依赖服务端：浏览器端使用 Web Speech API，安卓端通过 WebView 的 JavaScript 桥调用宿主原生识别与合成。开发环境实测为本机同时运行 Node.js 服务、Vite 开发服务、MySQL 与本机模型运行时。</p>

    <h2>4 总体设计</h2>
    <h3>4.1 系统架构</h3>
    ${image(diagram('02_architecture.png'), '图 4-1 系统架构图：该图展示 fronter 前台、admin 后台与 MySQL 数据库之间的分层协作关系。前台包含路由与权限守卫、国际化、认证状态、学生页面、管理页面与接口请求封装；后台包含 Express 应用、鉴权中间件、日志模块、认证接口、学习接口、管理接口与数据库连接池；数据库集中保存用户、题库、试卷、答题记录、错题本与各翻译表数据。该结构支持前后台独立部署、独立维护与按接口扩展功能。', 'diagram')}
    <h3>4.2 部署结构</h3>
    ${image(diagram('03_deployment.png'), '图 4-2 部署图：该图说明系统运行时由用户浏览器、Web 前端运行环境、应用服务器与 MySQL 数据库组成。浏览器加载前台静态资源后，通过接口请求封装访问后台服务；后台通过连接池访问数据库，并把请求状态、耗时与异常写入日志文件。该图用于说明系统部署节点、调用方向、数据落库路径与运行审计位置。本机开发环境的实际端口为前台 4031、后台 8033、模型运行时 11434。', 'diagram')}
    <h3>4.3 智能体与语音的分层设计</h3>
    <p>智能体与语音不改变原有的三层结构，而是在其上增加两条链路。智能体链路自下而上分为四层：模型运行时层由本机 Ollama 提供推理服务；封装层由 ollama 模块统一收敛对话、标签、进程、模型信息、加载与卸载接口，并把上游异常转换为统一的错误类型；业务层由工具集从 MySQL 读取真实业务数据，由设置模块读写系统设置表并解析默认模型，由智能体编排模块负责系统提示词、业务快照、工具调用循环与事件流；接入层由智能体路由把事件流转换为 SSE 帧，并在结束时落库会话、消息与调用日志。前台由悬浮球、对话区、模型选择器与语音控件四个组件组成界面。</p>
    <p>语音链路完全位于前台与设备侧，服务端不提供语音接口。统一编排模块负责探测可用的原生实现并把事件分发给当前活跃的提供方，原生桥模块负责安卓、Capacitor 与 iOS 三种容器的探测与回调注册，浏览器模块负责识别与合成的封装以及播报文本的清洗。两条链路与原有的认证、学习练习、管理查询接口共用同一套鉴权中间件与限流策略，智能体接口本身也要求登录令牌。</p>

    <h2>5 详细设计</h2>
    <h3>5.1 答题业务流程</h3>
    ${image(diagram('04_practice_flow.png'), '图 5-1 答题业务流程图：该图描述学生完成一次练习的完整业务路径。学生登录后进入练习列表，选择已发布试卷，后台按当前语言读取试卷、题目、选项与三语文本；学生逐题选择答案，系统在未全部作答时给出提示，在全部作答后提交答案与答题时长；后台完成判分并写入学习记录、作答明细与错题记录。该流程体现从练习入口到学习反馈的闭环。', 'diagram')}
    <h3>5.2 提交时序设计</h3>
    ${image(diagram('05_submit_sequence.png'), '图 5-2 提交答案时序图：该图从调用链角度说明答题提交的内部协作。页面整理用户选择的选项并交给接口封装，接口封装携带令牌调用学习练习路由；后台开启事务后查询正确选项、逐题比对答案、计算得分、写入学习记录与作答明细，并按答题结果新增或更新错题记录。事务提交后，页面展示正确数、错误数、得分与解析信息。', 'diagram')}
    <h3>5.3 登录态与令牌吊销</h3>
    <p>后台签发的令牌有效期为 7 天，载荷包含用户编号、用户名、角色与令牌版本号。仅校验签名不足以在有效期内收回令牌，因此鉴权中间件在每次请求时回查一次用户表，同时比对两项内容：一是账号状态必须为可用，账号被停用后立即失效；二是令牌载荷中的版本号必须等于用户表中的当前值，而修改密码、管理员重置密码与停用账号都会自增该字段，旧令牌随即作废。角色同样从数据库现取，管理员被降权后旧令牌不会残留管理权限。升级前签发、载荷中没有版本号的旧令牌按 0 处理，避免上线瞬间把全部在线用户强制下线。一次主键查询的代价换来的是吊销立即生效。</p>
    <h3>5.4 失败锁定与接口限流</h3>
    <p>登录接口在密码校验失败时累加用户表中的失败次数，达到 5 次即把锁定截止时间置为当前时间之后 15 分钟，锁定期内的登录请求直接返回剩余分钟数；登录成功则清零失败次数与锁定时间，并更新最后登录时间、最后活跃时间与登录次数。接口层另设进程内滑动窗口限流中间件，按窗口长度与窗口内允许次数对调用方计数，计数键默认取客户端地址，也可按用户编号计数。当前配置为：注册每小时 10 次，登录每 15 分钟 30 次，修改密码每 15 分钟 10 次，获取重置码每 15 分钟 5 次，提交重置每 15 分钟 10 次，智能体对话每分钟 30 次，模型加载每分钟 10 次。超限时返回 429 与 Retry-After 响应头，并说明建议重试的秒数。该实现基于进程内 Map，适用于单实例部署，多实例部署需替换为共享存储。</p>
    <h3>5.5 分页查询约定</h3>
    <p>管理台十二个菜单与本人登录日志共用同一套分页工具。参数解析函数负责解析并钳制请求中的页码与每页条数，页码不是正整数时回落为第一页，每页条数上限为 100；响应组装函数统一输出 list、total、page、pageSize、totalPages 五个字段，总页数取总条数除以每页条数的向上取整且最小为 1；分页查询函数先执行一次计数查询取总数，再取当前页数据，条件片段只允许来自服务端硬编码的白名单，取值一律通过占位参数传入，模糊匹配的关键词在拼接前转义百分号与下划线通配符。</p>
    <p>需要特别说明的是，每页条数与偏移量不能使用预处理语句占位：mysql2 的预编译语句在绑定这两个位置的参数时会抛出 Incorrect arguments to mysqld_stmt_execute 错误。因此分页工具把经过整数校验并钳制后的页码与条数直接内联进 SQL 文本，其余查询条件仍全部走占位参数，既不牺牲条件的安全性，也避开了预处理语句的参数限制。</p>
    <h3>5.6 智能体工具接地</h3>
    <p>智能体不使用模型微调，定制化来自三处：场景化系统提示词、实时业务快照与服务端工具调用。工具集按场景声明可用工具，学员场景包含个人资料、错题、成绩与试卷查询，管理场景额外包含平台统计、学员检索与高频错题排行；每个工具声明所属场景、自然语言描述与参数结构，执行入口先校验工具名是否存在以及该工具是否属于当前场景，未知工具或越权调用返回结构化错误而不是中断对话，工具自身抛出异常时同样转换为错误对象交回模型，让模型有机会自我纠正。工具结果注入模型前按配置的最大字符数截断，以控制上下文占用。业务快照把可用等级、题目分类、已发布试卷与题目数量以及当前用户的练习次数、平均分与错题数量压缩成一段简短上下文，与系统提示词合并后以数据块包裹，并明确声明其中是数据而非指令。</p>
    <p>回灌消息需要遵守 qwen3 聊天模板的三条约束：带工具调用的助手消息回灌时文本内容必须为空，工具结果消息必须紧跟对应的助手消息并保持工具调用顺序，每条工具结果中要重复工具名。为此系统在推送空内容的助手消息后按顺序执行每个工具调用，并把结果以包含工具名与结果两部分的对象形式写入工具消息。历史消息回放只保留带文本的普通问答轮次，从根上避免出现带工具调用的历史助手消息，并按配置的轮数上限截断。</p>
    <h3>5.7 意图预接地与降级路由</h3>
    <p>能力探测接口读取的是模型元数据中的聊天模板，而不是模型的真实能力：聊天模板里带工具段的小模型同样会被判定为支持工具调用，但它并不会真正发起调用，而是直接凭记忆作答，由此产生本平台最不能接受的编造题目与分数的问题；而且这种情况下回答非空，流程末尾的降级分支不会触发，错误答案会被直接返回。为规避这一风险，编排模块在首轮对话之前先用关键词意图路由判断提问是否命中已知的数据意图，命中则先执行对应工具，把真实数据以数据块形式注入上下文，再进入正常的对话循环，模型之后仍可自由追加其他工具调用。预接地查询失败时不阻断对话，只记录警告后按原路径继续。</p>
    <p>当模型确实不支持工具调用，或者用完最大工具轮数仍未给出回答时，系统执行降级路由：再次按关键词意图命中工具并查询真实数据，把结果注入上下文后再请求一次不带工具定义的对话，由模型汇总成自然语言回答。命中工具与是否使用降级路径都会随完成事件返回，并写入调用日志。</p>
    <h3>5.8 默认模型推荐</h3>
    <p>未显式配置默认模型时，后台按参数量从可用模型中挑选推荐值：把形如 14.8B、494.03M、7b 的参数量描述解析为以 B 为单位的数值并取最大者，参数量相同时比较模型体积，仍相同则按名称排序，保证同一批模型每次选出同一结果。此处不能简单回落到模型列表的第一项：模型运行时的标签接口按名称排序，本机第一条恰好是体积最小的那个模型，而这类小模型不会真正发起工具调用，只会凭记忆编造答案。推荐值同时用于智能体元信息接口与对话接口，避免前端各自取列表首项而选中不适合的模型。</p>
    <h3>5.9 语音提供方选择顺序</h3>
    <p>语音识别与语音播报各自独立解析提供方。识别侧依次探测安卓 WebView 的 JavaScript 桥、Capacitor 插件与 iOS 的消息处理器，三者都不可用时回落浏览器的语音识别接口，浏览器同样不支持时返回明确的不支持原因；播报侧在原生桥提供合成能力时优先使用原生实现，否则使用浏览器语音合成。独立解析允许出现安卓原生麦克风搭配浏览器语音合成的组合，App 只接入麦克风时不会把播报一并降级。浏览器的识别接口只在安全上下文下可用，不可用时页面区分提示安全上下文不满足与浏览器不支持两种情况，不静默失败。播报前会剥离 Markdown 标记并清洗为自然短句，新一轮提问会立即打断正在播放的语音，实现语音打断。</p>

    <h2>6 数据设计</h2>
    <h3>6.1 数据关系</h3>
    ${image(diagram('06_er.png'), '图 6-1 ER 图：该图展示核心数据对象之间的关系。用户表与学习记录、作答明细、错题本关联，题目表与等级、分类、选项及其翻译表关联，试卷通过组卷关联表组织题目集合，学生提交后形成学习记录与作答明细，并进一步驱动错题本更新。该数据关系支撑三语题库展示、在线判分、成绩回看与错题复习；本轮新增的密码重置、登录日志、智能体会话、消息与调用日志表以及系统设置表，分别以用户编号或会话编号作为关联键。', 'diagram')}
    <h3>6.2 数据表说明</h3>
    <p>数据库 school_chinese_exam_practice 使用 utf8mb4 字符集，建表脚本定义 ${dataTables.length - 1} 张业务表与 29 个外键约束，另有迁移工具在首次执行时自动创建的版本记录表。下表逐项说明各表的字段构成与用途。</p>
    ${table(['表名', '核心字段', '字段用途和约束说明'], dataTables, '表 6-1 数据表说明')}

    <h2>7 接口设计</h2>
    <p>后台共提供 ${apiGroups.reduce((sum, [, rows]) => sum + rows.length, 0)} 个接口，按认证、学习练习、后台管理、管理内容、管理智能体与智能体六个路由文件组织，分别挂载在 /api/auth、/api/learning、/api/admin 与 /api/ai 四个挂载点下，另有 /api/health 提供不带鉴权的健康检查。管理台接口在路由层统一挂载鉴权与管理员角色校验，公共服务接口中修改密码与本人登录日志要求登录，注册、登录与找回密码对外开放并施加限流。</p>
    ${apiGroups.map(([caption, rows]) => table(['接口', '访问角色', '功能说明'], rows, caption)).join('\n')}
    <h3>7.1 统一返回结构与分页约定</h3>
    <p>除流式接口外，后台接口统一返回 code、message、data 三段结构，成功时 code 为 200，失败时 code 取 HTTP 状态码并附错误说明；未命中路由返回 404，未捕获异常由统一错误处理返回 500 并记录日志。分页接口的 data 固定包含 list、total、page、pageSize、totalPages 五个字段，前端的分页表格组合式函数据此驱动筛选、防抖搜索与翻页。流式接口使用 text/event-stream，每帧为一行 data 加一个 JSON 负载，并每 15 秒发送一次注释帧作为心跳，避免中间代理断开空闲连接。</p>

    <h2>8 功能截图与三语界面</h2>
    <p>本章截图取自真实启动的前台页面与后台管理界面。第 8.1 至 8.10 幅由同一页面在三种界面语言下的运行截图并排合成，用于对照不同语言下的呈现；其余十二幅为后台菜单的中文界面单幅截图，因为管理台表格并排三份后字号过小、无法辨认。需要说明的是：公开页面在三种语言下完整切换，而学员端页面因示例账号的语言偏好为中文，三个面板的正文均以中文渲染，仅智能体入口按钮随面板语言变化；系统本身具备中文、英文、马来语三套界面文案与题库翻译资源，智能体弹框中的欢迎语与回答也会按所选语言生成。各幅截图与功能需求的对应关系见表 2-1 的最后一列。</p>
    ${shotSections}

    <h2>9 运行与部署设计</h2>
    <p>系统采用前后端分离方式运行。前台通过 Vite 构建为 H5 静态页面，浏览器加载页面后由接口请求封装向后台发起 JSON 请求与流式请求；后台以 Node.js 与 Express 作为运行基础，负责认证、学习练习、管理查询、智能体推理编排、日志记录与数据库访问；MySQL 负责保存业务数据，模型运行时负责本地推理。三部分之间通过 HTTP 接口与 SQL 数据访问边界协作，便于在开发、测试与部署阶段分别定位问题。</p>
    <p>部署时应先准备 Node.js、npm 与 MySQL 支撑环境，再完成数据库建表、增量迁移、演示题库初始化与账号初始化。建表脚本负责创建 23 张业务表、外键约束与三语演示题库；迁移脚本按版本顺序执行增量变更并记录到版本表中，重复执行会跳过已应用版本；后台服务启动后暴露四组接口与静态上传目录；前台可在开发环境由 Vite 直接提供页面，也可构建为静态资源后交由 Web 服务托管。启用智能体功能时需在本机安装模型运行时并至少下载一个模型，相关地址、保活时长、工具轮数与上下文窗口均可通过环境变量或后台设置调整。实际部署中的主机地址、接口地址、数据库口令与服务器路径在登记材料中均按脱敏规则处理。</p>
    ${table(['运行环节', '操作内容', '输出或作用'], [
      ['数据库初始化', '执行 npm run db:init，顺序加载建表脚本与种子脚本。', '创建库表、外键、等级、分类、试卷、题目、选项与三语翻译数据。'],
      ['增量迁移', '执行 npm run db:migrate。', '按版本顺序补齐已部署库缺失的字段与表，并记录到版本表，可重复执行。'],
      ['账号初始化', '执行 npm run seed:users。', '写入管理员与学员演示账号，便于功能核验与页面截图。'],
      ['后台运行', '执行 npm start 或 npm run dev。', '启动 Express 服务，提供认证、学习练习、管理端与智能体接口。'],
      ['前台运行', '执行 npm run dev 或 npm run build。', '开发时提供 H5 页面，生产时输出静态资源。'],
      ['模型运行时', '安装本机模型运行时并下载模型。', '为智能体提供推理能力，未启用时其余功能不受影响。'],
      ['日志归档', '后台按 LOG_DIR 或默认目录写入日志。', '记录请求状态、耗时、用户标识与异常，支持运行问题追踪。']
    ], '表 9-1 运行与部署环节')}

    <h2>10 安全、日志与异常处理</h2>
    <p>系统安全设计围绕账号认证、令牌吊销、访问控制、接口限流、数据写入一致性与日志脱敏展开。用户密码使用 bcrypt 哈希后保存，接口不返回密码字段；登录接口只在账号存在、状态可用且未被锁定时签发令牌，令牌载荷写入令牌版本号，鉴权中间件在每次请求时回查用户表比对版本号与账号状态，使改密、被重置与被停用三种情形下的旧令牌立即失效。前端路由守卫根据本地令牌与用户角色限制页面访问，未登录用户访问受保护页面时被引导到登录页，学生角色不能进入管理端页面；后台的管理端路由统一挂载鉴权与角色校验中间件。</p>
    <p>智能体侧的安全约束包括：工具名与所属场景在服务端登记，未登记或越权调用返回结构化错误；工具参数经由参数结构约束并在服务端做类型与范围钳制；业务快照与工具结果一律以数据块包裹，并在提示词中声明其中文字是数据而不是指令，降低提示注入风险；模型服务地址由服务端配置，前端不能指定任意上游地址。异常处理方面，后台统一使用异步路由包装捕获异常，并在统一错误处理中返回标准 JSON 结构；流式响应已发出响应头时无法再改状态码，此时只终止连接并记录日志。答题提交涉及学习记录、作答明细与错题本多表写入，系统通过事务封装保证写入一致性，任一环节失败即回滚。日志模块记录请求方法、路径、响应状态、耗时与用户标识，并对授权头、密码与令牌等字段做脱敏处理。</p>
    ${table(['安全点', '实现方式', '对应文件或模块'], [
      ['密码保护', 'bcryptjs 哈希存储，接口不返回密码字段，新密码需通过长度与字符组合校验。', 'routes/auth.js'],
      ['令牌吊销', '用户表令牌版本号自增，鉴权中间件逐请求比对令牌声明与数据库当前值。', 'middleware/auth.js、routes/auth.js、routes/admin.js'],
      ['失败锁定', '连续 5 次密码错误锁定 15 分钟，成功登录清零失败次数与锁定时间。', 'routes/auth.js'],
      ['接口限流', '进程内滑动窗口按客户端地址或用户编号计数，超限返回 429 与 Retry-After。', 'middleware/rateLimit.js'],
      ['角色权限', '管理端路由统一挂载管理员角色校验；删除用户时禁止删除当前管理员本人。', 'middleware/role.js、routes/admin.js'],
      ['上传校验', '按请求体魔数识别图片真实类型，限制 2MB，不信任客户端提交的类型声明。', 'config/uploads.js、routes/auth.js'],
      ['工具参数白名单', '工具名与场景在服务端登记，参数做类型与范围钳制，越权调用返回结构化错误。', 'services/ai/tools.js'],
      ['提示注入防护', '业务快照与工具结果以数据块包裹并声明为数据而非指令，另设场景化回答约束。', 'services/ai/agent.js'],
      ['事务一致性', '答题提交使用事务包装多表写入，失败回滚。', 'config/db.js、routes/learning.js'],
      ['日志脱敏', '日志写入前替换密码、令牌与邮箱等敏感内容。', 'utils/logger.js']
    ], '表 10-1 安全设计要点')}

    <h2>11 测试与验证</h2>
    <p>本轮验证覆盖数据库、接口、公共服务流程、智能体流式输出、前端构建、浏览器走查与文档素材生成多个层面，结果如下表。数据库层面已执行建表与种子脚本，核验 23 张业务表创建完成、外键约束存在、试卷题目关联无孤儿数据、题目与选项在中文、英文、马来语下均有翻译记录；增量迁移重复执行不产生新的变更，具备幂等性。接口层面已在真实运行的后台服务上完成分页断言与公共服务流程回归。</p>
    ${table(['验证项目', '验证结果', '说明'], [
      ['数据库结构', '通过', '建表脚本定义 23 张业务表与 29 个外键约束，主要关联关系与三语数据完整。'],
      ['增量迁移', '通过', '迁移脚本可重复执行，已应用版本被记录并跳过，重复运行不再产生变更。'],
      ['接口分页断言', '42/42 通过', '管理台与公共服务分页接口逐条断言 list、total、page、pageSize、totalPages 五个字段及分页边界。'],
      ['公共服务流程', '30/30 通过', '注册、登录、退出、修改密码、找回密码与重置密码、头像上传、本人登录日志与失败锁定逐项验证。'],
      ['智能体流式输出', '通过', '实测帧序为 meta、tool_call、tool_result、delta、done，事件类型与顺序符合设计。'],
      ['前端构建', '通过', '前台执行 npm run build 成功产出静态资源。'],
      ['浏览器走查', '42/42 通过', '登录、悬浮球、弹框、流式回答、模型下拉与十二个后台菜单逐项走查，未出现脚本异常。'],
      ['运行截图采集', '通过', '按 22 个页面键采集 42 张原始截图，合成 10 幅三语并排图与 12 幅后台中文图。'],
      ['文档输出', 'A4 PDF', '本文档与源代码稿统一由浏览器打印流程输出为 A4 PDF，纯白底黑字黑线，不含页眉页脚。']
    ], '表 11-1 测试与验证结果')}

    <h2>12 结论</h2>
    <p>${softwareName}已经形成学生端学习练习、管理端教学查看与智能体辅助三条主线。学生端围绕注册登录、账号安全、三语学习、在线练习、成绩回看、错题复习与资料维护构成完整学习闭环；管理端围绕数据看板、学生、题库、试卷、成绩、等级、分类、登录日志、在线状态与智能体运行数据构成十二个分页管理入口；智能体以本机开源大模型为推理核心，通过服务端工具读取真实业务数据作答，并提供语音播报与语音对话，使学生在练习过程中可以用母语随时询问错题、成绩与题目讲解。</p>
    <p>从技术实现看，系统采用 Vue 3 加 Vite 与 Express 加 MySQL 的前后端分离结构，目录清晰、接口边界明确、数据库关系完整，并已实现令牌吊销、失败锁定、接口限流、事务处理、统一分页、请求日志与提示注入防护等机制。本材料中的图示、表格、接口说明、数据说明、关键机制说明与运行截图均与可运行系统相对应，能够反映软件的设计结构、业务流程、数据组织与运行支撑能力。后续如继续扩展，可在现有智能体工具集的基础上增加更多只读业务工具，并在管理端补充批量导入与题库审核流程。</p>
  `;
  return htmlWrap(`${softwareName}软件设计说明书`, docCss(), body);
}

/** 与 HTML 同源数据的 Markdown 版本，便于直接阅读与检索。 */
function designMarkdown() {
  const mdTable = (headers, rows) => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, '\\|')).join(' | ')} |`)
  ].join('\n');

  const lines = [
    `# ${softwareName}软件设计说明书`,
    '',
    `- 软件版本：${version}`,
    '- 文档类型：软件著作权登记材料',
    '',
    '## 1 引言',
    '',
    '### 1.1 适用范围',
    '',
    `软件分为学生端、管理端与智能体三条使用路径。学生端支持注册、登录、退出登录、修改密码、以 6 位重置码找回密码、个人资料维护与头像上传、查看本人登录日志，以及首页导航、练习列表、在线答题与提交判分、成绩记录、错题本和个人中心。管理端提供数据看板、学生管理、题库管理、练习试卷、成绩记录、等级管理、分类管理、登录日志、在线状态、智能体设置、智能体会话与智能体调用日志共十二个菜单。智能体以全局悬浮球为入口，支持流式问答、语音播报与语音对话。`,
    '',
    '## 2 需求分析',
    '',
    '### 2.1 功能需求清单',
    '',
    mdTable(['编号与名称', '页面', '访问路径', '接口或入口', '核心数据对象', '运行截图'], requirements.map(([id, , page, route, api, tableName, shot]) => [id, page, route, api, tableName, `图 8-${figureNo.get(shot)}`])),
    '',
    '### 2.2 非功能需求',
    '',
    mdTable(['类别', '要求', '实现依据'], [
      ['权限安全', '受保护接口校验令牌与服务端令牌版本号，管理端接口额外校验管理员角色。', 'middleware/auth.js、middleware/role.js'],
      ['账号安全', '连续登录失败达 5 次锁定 15 分钟；改密、重置与停用账号立即吊销已签发令牌。', 'routes/auth.js'],
      ['接口限流', '登录、注册、改密、找回密码、模型加载与智能体对话按窗口计数限流。', 'middleware/rateLimit.js'],
      ['国际化', '界面文案与题库内容支持中文、英文、马来语。', 'i18n/index.js、各翻译表'],
      ['数据一致性', '答题提交涉及多表写入，使用事务保护。', 'config/db.js、routes/learning.js'],
      ['分页一致性', '管理台十二个菜单与本人登录日志统一走分页工具。', 'utils/paginate.js'],
      ['智能体可信', '涉及数据类提问必须读取数据库，数据块声明为数据而非指令。', 'services/ai/tools.js、services/ai/agent.js']
    ]),
    '',
    '## 3 模块结构',
    '',
    mdTable(['模块', '服务角色', '核心职责', '页面或接口', '数据对象'], modules),
    '',
    '## 4 关键机制',
    '',
    '### 4.1 登录态与令牌吊销',
    '',
    '鉴权中间件在每次请求时回查用户表，比对账号状态与令牌版本号；改密、被重置与被停用都会自增令牌版本号，旧令牌立即失效。',
    '',
    '### 4.2 失败锁定与接口限流',
    '',
    '连续 5 次密码错误锁定 15 分钟；接口层使用进程内滑动窗口限流，超限返回 429 与 Retry-After 响应头。',
    '',
    '### 4.3 分页查询约定',
    '',
    '分页返回固定为 list、total、page、pageSize、totalPages；每页条数与偏移量不能用预处理语句占位，因此直接把已校验的整数内联进 SQL。',
    '',
    '### 4.4 智能体工具接地',
    '',
    '工具名与场景在服务端登记，越权调用返回结构化错误；回灌消息遵循聊天模板约束，工具结果中重复工具名。',
    '',
    '### 4.5 意图预接地与默认模型推荐',
    '',
    '命中已知数据意图时先查库再注入上下文，不依赖模型自觉；未配置默认模型时按参数量取最大者，避免回落到体积最小的模型。',
    '',
    '### 4.6 语音提供方选择顺序',
    '',
    '识别与播报各自独立解析提供方，顺序为安卓桥、Capacitor、iOS 消息处理器、浏览器接口，不可用时给出明确提示。',
    '',
    '## 5 数据表说明',
    '',
    mdTable(['表名', '核心字段'], dataTables.map(([name, fields]) => [name, fields])),
    '',
    '## 6 接口设计',
    '',
    ...apiGroups.flatMap(([caption, rows]) => [caption, '', mdTable(['接口', '访问角色', '功能说明'], rows), '']),
    '分页接口统一返回 list、total、page、pageSize、totalPages 五个字段；流式接口每帧为一行 data 加一个 JSON 负载，并每 15 秒发送一次心跳注释帧。',
    '',
    '## 7 功能截图与三语界面',
    ''
  ];

  for (const [index, [file, pageName, kind]] of screenshotSections.entries()) {
    const related = requirements.filter(([, , , , , , shot]) => shot === file).map(([id]) => id.split(' ')[0]);
    lines.push(`### 7.${index + 1} ${pageName}（${related.join('、')}）`, '');
    lines.push(screenshotNotes[file], '');
    lines.push(`![图 8-${index + 1} ${pageName}](${screen(file)})`, '');
  }

  lines.push(
    '## 8 测试与验证',
    '',
    mdTable(['验证项目', '验证结果', '说明'], [
      ['数据库结构', '通过', '建表脚本定义 23 张业务表与 29 个外键约束。'],
      ['增量迁移', '通过', '迁移脚本可重复执行并跳过已应用版本。'],
      ['接口分页断言', '42/42 通过', '管理台与公共服务分页接口逐条断言返回结构与分页边界。'],
      ['公共服务流程', '30/30 通过', '注册、改密、找回、头像、日志与锁定流程逐项验证。'],
      ['智能体流式输出', '通过', '实测帧序为 meta、tool_call、tool_result、delta、done。'],
      ['前端构建', '通过', '前台执行 npm run build 成功产出静态资源。'],
      ['浏览器走查', '42/42 通过', '登录、悬浮球、弹框、流式回答、模型下拉与十二个后台菜单逐项走查。']
    ]),
    ''
  );

  return lines.join('\n');
}

function describeFile(file) {
  if (file.includes('/routes/auth')) return '注册、登录、退出、找回密码、修改密码、个人资料、头像上传和本人登录日志接口。';
  if (file.includes('/routes/learning')) return '等级、分类、练习列表、试卷详情、答题提交、成绩记录和错题本接口。';
  if (file.includes('/routes/adminContent')) return '管理台等级、分类、题库和试卷的分页查询与增删改接口，含三语翻译字段维护。';
  if (file.includes('/routes/adminAi')) return '管理台智能体设置、模型刷新、会话和调用日志分页接口。';
  if (file.includes('/routes/admin')) return '管理台数据看板、学生管理、成绩记录、登录日志和在线状态接口。';
  if (file.includes('/routes/ai')) return '智能体健康检查、模型装卸、场景配置、SSE 流式问答和会话管理接口。';
  if (file.includes('/services/ai/ollama')) return '本地 Ollama 模型列举、装载卸载、对话推理和能力探测封装。';
  if (file.includes('/services/ai/tools')) return '面向本平台业务的数据库查询工具集，为智能体提供真实学情数据。';
  if (file.includes('/services/ai/agent')) return '场景化系统提示词、工具调用循环、意图预接地、降级路由和流式事件编排。';
  if (file.includes('/services/ai/settings')) return '智能体运行参数读写、模型列表缓存与默认模型推荐策略。';
  if (file.includes('/middleware/auth')) return 'JWT 解析与登录态校验中间件，逐请求比对账号状态与令牌版本号。';
  if (file.includes('/middleware/role')) return '管理员角色授权中间件。';
  if (file.includes('/middleware/active')) return '用户活跃时间节流刷新中间件，支撑在线状态统计。';
  if (file.includes('/middleware/rateLimit')) return '内存滑动窗口限流中间件，保护登录、改密和智能体接口。';
  if (file.includes('/middleware/requestLogger')) return 'HTTP 请求状态、耗时和用户标识日志中间件。';
  if (file.includes('/utils/logger')) return '日志文件写入、控制台输出和敏感字段脱敏工具。';
  if (file.includes('/utils/paginate')) return '分页参数解析与分页查询封装，内联校验后的 LIMIT 取值。';
  if (file.includes('/utils/translations')) return '三语翻译表关联读取与按语言增量写入，避免覆盖其他语种内容。';
  if (file.includes('/utils/migrate')) return '按版本顺序执行数据库迁移并记录已应用版本，保证升级幂等。';
  if (file.includes('/utils/errors')) return '业务错误类型定义，承载 HTTP 状态码与错误说明。';
  if (file.includes('/utils/response')) return '统一响应封装与异步路由的错误转发。';
  if (file.includes('/utils/initDb')) return '建库建表初始化脚本，按 schema 与迁移文件创建全部业务表。';
  if (file.includes('/utils/seedUsers')) return '演示账号种子脚本，写入管理员与学员账号并加密口令。';
  if (file.includes('/config/db')) return 'MySQL 连接池配置和事务封装。';
  if (file.includes('/config/ai')) return '智能体相关环境变量读取与归一化配置。';
  if (file.includes('/config/uploads')) return '上传文件存放目录、类型白名单和大小限制定义。';
  if (file.endsWith('src/server.js')) return '后台服务启动入口，加载应用、监听端口并兜底记录未捕获异常。';
  if (file.endsWith('src/app.js')) return '后台应用装配：中间件、静态目录、路由挂载与统一错误处理。';
  if (file.endsWith('schema.sql')) return '数据库和业务表结构定义脚本。';
  if (file.endsWith('seed.sql')) return '等级、分类、试卷、题目、选项和三语内容初始化脚本。';
  if (file.includes('migrations/001')) return '已部署数据库的增量字段与智能体业务表迁移脚本。';
  if (file.includes('migrations/002')) return '令牌版本号字段迁移脚本，用于服务端吊销已签发令牌。';
  if (file.includes('/router/')) return '前台路由、后台嵌套路由和权限守卫定义。';
  if (file.includes('/api/client')) return 'HTTP 请求、原始字节上传、查询串拼接和 SSE 流式读取封装。';
  if (file.includes('/api/ai')) return '智能体接口调用与流式事件订阅封装。';
  if (file.endsWith('src/main.js')) return '前台应用入口，装配路由、全局样式与根组件后挂载。';
  if (file.includes('/stores/auth')) return '登录态响应式状态，保存用户信息、令牌与角色判断。';
  if (file.includes('/i18n/')) return '三语界面文案和语言状态维护。';
  if (file.includes('composables/usePagedTable')) return '后台分页表格的查询、筛选、防抖搜索与翻页逻辑。';
  if (file.includes('components/Pagination')) return '通用分页控件，提供页码、每页条数和总数展示。';
  if (file.includes('components/AppModal')) return '通用弹框容器，供后台编辑表单与智能体对话复用。';
  if (file.includes('layouts/AdminLayout')) return '管理台侧边栏布局、菜单分组和窄屏抽屉导航。';
  if (file.includes('voice/useVoice')) return '语音识别与语音播报编排，按运行环境选择原生桥或浏览器接口。';
  if (file.includes('voice/speech')) return '浏览器语音识别与语音合成封装，含播报文本清洗。';
  if (file.includes('voice/androidBridge')) return '安卓、Capacitor 与 iOS 原生语音桥探测与回调注册。';
  if (file.includes('components/agent/format')) return '智能体回答文本的展示清洗与格式化工具。';
  if (file.includes('components/agent/')) return '智能体悬浮入口、对话弹框、模型选择与语音控制界面。';
  if (file.includes('views/admin/')) return '管理台分页查询页面的筛选栏、数据表格与编辑弹框。';
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
    </section>
    <h1>${softwareName}源代码</h1>
    <h2>1 源代码属性结构说明</h2>
    <p>本源码稿由后台服务、前台 H5 页面、数据库脚本和项目配置组成。后台 admin 使用 Node.js、Express、mysql2、JWT、bcryptjs 实现认证、练习、管理、智能体推理编排、日志和数据库事务；前台 fronter 使用 Vue 3、Vue Router、Vite、CSS 和原生状态对象实现学生端、管理端、智能体弹框和三语界面；数据库脚本创建并初始化用户、等级、分类、题库、试卷、成绩、错题、日志、智能体会话和系统设置数据。</p>
    <p>源码稿排除了 node_modules、dist、运行日志、上传文件和第三方依赖源码。涉及密码、令牌、邮箱、主机地址和数据库口令的内容均在输出前进行了脱敏处理。为提高审阅可读性，源码正文按文件逐项列出，保留真实相对路径、文件职责、所属模块和带行号的源码正文。</p>
    <h2>2 目录与模块结构</h2>
    ${table(['文件路径', '所属层次', '文件职责'], rows, '表 2-1 源代码文件清单')}
    <h2>3 源码正文</h2>
    ${sections.join('\n')}
  `;
  return htmlWrap(`${softwareName}源代码`, codeCss(), body);
}

/**
 * 用 Chrome 命令行直接打印 PDF。
 *
 * 不走 CDP 的 Page.printToPDF：在本机实测该调用会一直挂起不返回，
 * 而 --print-to-pdf 命令行方式稳定通过。注意三点：
 * 1. --user-data-dir 必须给私有临时目录，本机有其它会话在用同一个 Chrome profile，
 *    共用 profile 是之前挂起的可能原因之一；
 * 2. file:// URL 必须是绝对路径；
 * 3. 必须加 --no-pdf-header-footer，否则页眉会印上文件路径与日期。
 * 打印出的 PDF 为纯白底黑字，不引入任何主题色。
 */
function printPdf(htmlFile, pdfFile, title) {
  const userDataDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'softright-pdf-'));
  try {
    execFileSync(chromeBin, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      '--no-pdf-header-footer',
      '--font-render-hinting=medium',
      `--print-to-pdf=${pdfFile}`,
      `file://${htmlFile}`
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 15 * 60 * 1000 });
  } finally {
    fsSync.rmSync(userDataDir, { recursive: true, force: true });
  }
  const { size } = fsSync.statSync(pdfFile);
  console.log(`  PDF ${path.relative(root, pdfFile)} — ${(size / 1024 / 1024).toFixed(2)}MB — ${pdfPageCount(pdfFile)} 页（${title}）`);
}

/** 统计 PDF 页数：Chrome 输出的页面对象未压缩，直接数 /Type /Page 出现次数。 */
function pdfPageCount(pdfFile) {
  const text = fsSync.readFileSync(pdfFile, 'latin1');
  return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

/**
 * 把截图与图示同步到交付目录，保证 HTML 中 ../images/ 的相对引用可用。
 * 截图由 scripts/combine_trilingual_screenshots.py 合成后镜像到 docs/assets 下，
 * 交付目录中的副本已统一转换为纯黑白，因此只在目标缺失时补齐，绝不覆盖已有文件，
 * 否则会把彩色原图重新写回交付目录。本函数不触碰历史交付目录 软著/。
 */
async function syncDeliveryAssets() {
  await fs.mkdir(shotDir, { recursive: true });
  let copied = 0;
  for (const file of await fs.readdir(rawShotDir)) {
    if (!file.endsWith('.png')) continue;
    const target = path.join(shotDir, file);
    if (fsSync.existsSync(target)) continue;
    await fs.copyFile(path.join(rawShotDir, file), target);
    copied += 1;
  }

  await fs.mkdir(diagramDir, { recursive: true });
  for (const file of await fs.readdir(rawDiagramDir)) {
    if (!file.endsWith('.png')) continue;
    const target = path.join(diagramDir, file);
    if (fsSync.existsSync(target)) continue;
    await fs.copyFile(path.join(rawDiagramDir, file), target);
    copied += 1;
  }

  console.log(`  素材同步：新增 ${copied} 个文件，已有文件保持交付目录中的纯黑白版本不变`);
}

/** 生成前校验：截图键必须与截图说明一一对应，避免输出缺图的文档。 */
function validateData() {
  const missing = [];
  for (const [id, , , , , , shot] of requirements) {
    if (!screenshotNotes[shot]) missing.push(`${id} 引用了未登记说明的截图 ${shot}`);
  }
  for (const [file] of screenshotSections) {
    if (!screenshotNotes[file]) missing.push(`第 8 章截图 ${file} 缺少说明文字`);
  }
  const seen = new Set(screenshotSections.map(([file]) => file));
  for (const file of Object.keys(screenshotNotes)) {
    if (!seen.has(file)) missing.push(`截图说明 ${file} 未在第 8 章登记`);
  }
  if (missing.length) throw new Error(`素材校验失败：\n${missing.join('\n')}`);
}

async function main() {
  validateData();
  await fs.mkdir(textDir, { recursive: true });
  await fs.mkdir(pdfDir, { recursive: true });
  await syncDeliveryAssets();

  const designHtmlPath = path.join(textDir, '软件设计说明书.html');
  const designMdPath = path.join(textDir, '软件设计说明书.md');
  const sourcePath = path.join(textDir, `${softwareName}源代码.html`);
  await fs.writeFile(designHtmlPath, designHtml(), 'utf8');
  await fs.writeFile(designMdPath, designMarkdown(), 'utf8');
  await fs.writeFile(sourcePath, await sourceHtml(), 'utf8');
  console.log(`  文本：${[designHtmlPath, designMdPath, sourcePath].map((file) => path.relative(root, file)).join('、')}`);
  printPdf(designHtmlPath, path.join(pdfDir, '软件设计说明书.pdf'), '软件设计说明书');
  printPdf(sourcePath, path.join(pdfDir, `${softwareName}源代码.pdf`), '源代码册');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
