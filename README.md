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

### 学员端

- 练习列表、答题提交与自动判分、成绩记录、错题本、个人中心
- 界面三语切换（中文 / English / Bahasa Melayu）

### 管理台

- 12 个菜单：数据看板、学生管理、题库管理、练习试卷、成绩记录、等级管理、
  分类管理、登录日志、在线状态、智能体设置、智能体会话、智能体日志
- **每个菜单都是分页查询**，统一返回 `{ list, total, page, pageSize, totalPages }`，
  支持关键词、筛选条件与页码控制
- 题库 / 试卷 / 等级 / 分类支持增删改，三语字段在同一个表单里分 Tab 录入

### 智能体

- 学员端右下角悬浮球 → 弹框实时问答；管理端为运营助手场景，需管理员角色
- **本地 Ollama，不调用任何云端模型**；模型从环境变量发现，下拉选择、预热加载
- **业务接地**：涉及个人成绩、错题、平台统计的问题一律先查数据库再作答，
  严禁编造题目与分数
- **语音播报（TTS）与语音对话（STT）**：浏览器直接用 Web Speech API；
  在安卓 App 的 WebView 中自动改为调用安卓原生麦克风与 TTS，
  契约见 `docs/android/WebView语音桥接.md`
- SSE 流式输出，可中断

### 数据

- 题库：等级、分类、题目、选项、解析全部三语
- MySQL，建表和演示题库位于 `admin/sql`，增量迁移在 `admin/sql/migrations`

## 启动

```bash
cd admin
npm install
cp .env.example .env          # 按需修改数据库与 JWT_SECRET
npm run db:init
npm run db:migrate            # 已有数据库执行增量迁移，可重复执行
npm run seed:users
npm run dev
```

```bash
cd fronter
npm install
npm run dev
```

默认账号：

- 管理员：`admin / admin123456`
- 学生：`student / student123456`

默认 API 地址为 `http://localhost:8033/api`。如需修改，前端可设置 `VITE_API_BASE`。

### 智能体准备

需要本机已安装 [Ollama](https://ollama.com) 并至少下载一个模型：

```bash
ollama pull qwen3:14b     # 推荐：能稳定发起工具调用
```

Ollama 地址由 `admin/.env` 的 `OLLAMA_HOST` 指定。未显式配置 `AI_DEFAULT_MODEL` 时，
平台会自动选用参数量最大的已下载模型 —— **不会**退回到列表里第一个（那通常是体积最小、
不会真正调用工具的模型）。首次加载大模型约需 20 秒，界面上会明确提示。

## 开源协议

本项目使用 GNU General Public License v2.0（GPL-2.0）开源，详见 `LICENSE`。
