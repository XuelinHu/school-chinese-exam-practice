# 马来西亚留学生汉语练习平台

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
