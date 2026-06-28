# AGENT.md

## Project

- Project: `school-chinese-exam-practice`
- Stack: Vue 3 + Vite frontend, Node.js + Express backend, MySQL

## Runtime

- Backend port: `3000` from `admin/.env.example` `PORT`.
- Frontend port: `5173` from `fronter/vite.config.js`.
- API base: `http://localhost:3000/api`, override with `VITE_API_BASE`.
- Backend dev: `cd admin && npm run dev`.
- Frontend dev: `cd fronter && npm run dev`.

## Database

- Type: MySQL.
- Database name: `school_chinese_exam_practice`.
- Env file: `admin/.env` based on `admin/.env.example`.
- Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
- Schema: `admin/sql/schema.sql`.
- Seed: `admin/sql/seed.sql`, plus `npm run db:init` and `npm run seed:users`.
- Keep real passwords only in local `.env`.

## Codex Notes

- Preserve trilingual content fields when editing questions, categories, and papers.
- If ports, env vars, or schema changes, update README and this file.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.
