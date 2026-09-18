# school-chinese-exam-practice

<p align="center">
  <img height="20" alt="Vue 3.5.13" src="https://img.shields.io/badge/vue-3.5.13-4FC08D" />
  <img height="20" alt="Vite 6.0.3" src="https://img.shields.io/badge/vite-6.0.3-646CFF" />
  <img height="20" alt="Vue Router 4.5.0" src="https://img.shields.io/badge/vue_router-4.5.0-4FC08D" />
  <img height="20" alt="Express 4.21.2" src="https://img.shields.io/badge/express-4.21.2-000000" />
  <img height="20" alt="MySQL configured" src="https://img.shields.io/badge/mysql-configured-4479A1" />
  <img height="20" alt="License GPL-2.0" src="https://img.shields.io/badge/license-GPL--2.0-3DA639" />
</p>

马来西亚留学生汉语练习平台

一个基于 Vue3、Node.js/Express 和 MySQL 的三语汉语练习平台，支持中文、英文、马来语，
并内置基于本机 Ollama 的定制化智能体（支持语音播报与语音对话）。

## 功能

### 公共服务

- 注册 / 登录 / 退出 / 修改密码 / 找回密码（6 位重置码，10 分钟有效、一次性）
- 个人资料：头像上传、三语界面偏好（落库，跨设备生效）、学号与国籍
- 登录日志：本人登录、改密、重置等操作留痕，分页查看
- 账号安全：连续 5 次密码错误锁定 15 分钟；改密/重置/停用后旧令牌立即失效

### 角色与权限

四类角色，权限常量集中在后端 `admin/src/middleware/role.js`：

| 角色 | 能做什么 |
|---|---|
| `student` 学员 | 自助注册；练习、成绩、错题本、个人中心、智能体问答 |
| `teacher` 教师 | 上面全部，外加**只读**教学查看区：全部学员列表、成绩与错题 |
| `content_admin` 内容管理员 | 后台的题库 / 试卷 / 等级 / 分类四个菜单 |
| `admin` 超级管理员 | 全部菜单，含用户、成绩、登录日志、在线状态与智能体会话 |

**前端隐藏菜单只是体验，权限边界在后端。** 内容管理员直敲 `/admin/students` 会被守卫送回
`/admin/questions`，就算绕过前端也拿不到数据 —— `admin.js` 里那两道 `allow()` 关卡才是判据。
`/api/teaching/*` 只读靠的是该文件里**只有 GET**，不是靠前端藏按钮。

### 学员端

- 练习列表、答题提交与自动判分、成绩记录、错题本、个人中心
- 练习列表 / 成绩 / 错题本均为分页查询
- 界面三语切换（中文 / English / Bahasa Melayu）

### 教学查看区（教师）

- 全部学员列表：按关键词、等级（练过该等级试卷）、状态筛选，分页
- 单个学员：练习次数、平均分、最高分、累计时长、错题总数；成绩记录与错题两张分页表
- 只读——不显示邮箱、电话、锁定状态、登录次数这类账号字段，也没有任何写接口

### 管理台

- 12 个菜单：数据看板、学生管理、题库管理、练习试卷、成绩记录、等级管理、
  分类管理、登录日志、在线状态、智能体设置、智能体会话、智能体日志
- **每个菜单都是分页查询**，统一返回 `{ list, total, page, pageSize, totalPages }`，
  支持关键词、筛选条件与页码控制
- 成绩记录的**逐题明细**同样是分页的
- 题库 / 试卷 / 等级 / 分类支持增删改，三语字段在同一个表单里分 Tab 录入

**分页的两处有意例外**（都在代码里写明了理由）：

- `/api/learning/levels`、`/api/learning/categories` 返回裸数组 —— 它们是 3~4 行的字典表，
  用来填 `<select>`，分页会把下拉框弄坏
- `GET /api/admin/papers/:id` 返回完整题目列表 —— 它是组卷编辑器的输入，而组卷接口是
  「整体替换」；只给一页的话，保存时会把没显示出来的题目全删掉

### 智能体

- 学员端右下角悬浮球 → 弹框实时问答；后台人员（超管 + 内容管理员）进入运营助手场景
- **本地 Ollama，不调用任何云端模型**
- **只用本机已下载、可加载的模型**：超过 `AI_MAX_MODEL_SIZE_GB`（默认 24）的模型
  在列表里**可见但不可选**，并写明原因（`超出 24G 上限` / `体积未知`）——
  直接隐藏会被当成「模型没下载成功」。模型目录由 `OLLAMA_MODELS` 指定
- **业务接地**：涉及个人成绩、错题、平台统计的问题一律先查数据库再作答，
  严禁编造题目与分数
- **语音播报（TTS）与语音对话（STT）**：全部在 H5 里完成，浏览器直接调用麦克风与扬声器，
  没有原生桥、也没有服务端语音接口
- SSE 流式输出，可中断

> **语音的安全上下文限制**：语音识别（麦克风）要求 HTTPS 或 localhost，语音合成
> （扬声器）**不受**此限制。当前的 FRP 公网入口是裸 IP + HTTP，**在那里麦克风用不了属预期**——
> 麦克风按钮会置灰并写明「语音识别需要 HTTPS 或 localhost 环境」，同时提示播报仍可用；
> 本机 `localhost` 一切正常。

### 数据

- 题库：等级、分类、题目、选项、解析全部三语
- MySQL，建表和演示题库位于 `admin/sql`，增量迁移在 `admin/sql/migrations`

## 启动

```bash
cd admin
npm install
cp .env.example .env          # 必填：DB_PASSWORD、JWT_SECRET
npm run db:init
npm run db:migrate            # 已有数据库执行增量迁移，可重复执行
npm run seed:users
npm run dev
```

`.env` 现在是**必需**的：`DB_PASSWORD` 与 `JWT_SECRET` 缺一个，进程会带着明确提示退出，
不再回落到代码里的默认口令。

```bash
cd fronter
npm install
npm run dev
```

默认账号（`npm run seed:users` 写入，四类角色各一个，便于逐接口核对权限）：

| 角色 | 账号 | 密码 |
|---|---|---|
| 超级管理员 | `admin` | `admin123456` |
| 内容管理员 | `content` | `content123456` |
| 教师 | `teacher` | `teacher123456` |
| 学员 | `student` | `student123456` |

默认 API 地址为 `http://localhost:8033/api`。如需修改，前端可设置 `VITE_API_BASE`。

### 自检脚本

后端跑起来并执行过 `seed:users` 之后：

```bash
cd admin
npm run check:permissions     # 4 个账号 × 21 条接口的角色矩阵
npm run check:pagination      # 每个列表端点的分页信封
```

改权限或加列表端点后跑一遍；两个脚本同时是这两条约定的可执行文档。

### 智能体准备

需要本机已安装 [Ollama](https://ollama.com) 并至少下载一个模型：

```bash
ollama pull qwen3:14b     # 推荐：能稳定发起工具调用
```

Ollama 地址由 `admin/.env` 的 `OLLAMA_HOST` 指定，模型目录由 `OLLAMA_MODELS` 指定
（本机服务以 `ollama` 用户运行，真实目录是 `/usr/share/ollama/.ollama/models`）。
未显式配置 `AI_DEFAULT_MODEL` 时，平台会自动选用参数量最大的**可选**模型 —— **不会**退回到
列表里第一个（那通常是体积最小、不会真正调用工具的模型）。首次加载大模型约需 20 秒，
界面上会明确提示。

相关的两个环境变量：

- `AI_MAX_MODEL_SIZE_GB=24` —— 模型体积上限。超过的模型在下拉里可见但不可选。
  这是防呆护栏，**不等于装得下**：显存还被别的进程占用时，`qwen3:30b-a3b`（17.3GB）
  实际只能拿到约 4.7GB 显存，跑得很慢。判断能否流畅运行请看 `ollama ps` 的 `size_vram`。
- `AI_TEST_MODEL=` —— 本机调试提速用，例如 `qwen2.5:0.5b`。**仅在 `NODE_ENV` 不是
  `production` 时生效**，生产环境设了也会被忽略并打一条告警。小模型不会真的调用工具，
  所以只有首轮已预接地的数据问题（成绩、错题、统计等 7 类）仍然准确，
  自由问答与多轮工具查询会退化 —— 界面顶部会挂一条测试模型徽标说明这一点。

## 开源协议

本项目使用 GNU General Public License v2.0（GPL-2.0）开源，详见 `LICENSE`。
