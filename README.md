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

一个基于 Vue3、Node.js/Express 和 MySQL 的三语汉语练习平台 MVP，支持中文、英文、马来语。

## 功能

- 学生 H5：注册登录、练习列表、答题提交、成绩记录、错题本、个人中心
- 管理台：学生列表、题库列表、练习/试卷列表、成绩记录、数据看板
- 题库：等级、分类、题目、选项、解析全部三语
- 数据库：MySQL，建表和演示题库位于 `admin/sql`

## 启动

```bash
cd admin
npm install
npm run db:init
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

默认 API 地址为 `http://localhost:3000/api`。如需修改，前端可设置 `VITE_API_BASE`。

## 开源协议

本项目使用 GNU General Public License v2.0（GPL-2.0）开源，详见 `LICENSE`。
