# AGENT.md

## Project

- Project: `school-chinese-exam-practice`
- Stack: Vue 3 + Vite frontend, Node.js + Express backend, MySQL, local Ollama for the AI agent

## Runtime

- Backend port: `8033` from `admin/.env.example` `PORT`.
- Frontend port: `4031` from `fronter/vite.config.js`.
- API base: `http://localhost:8033/api`, override with `VITE_API_BASE`.
- Backend dev: `cd admin && npm run dev`.
- Frontend dev: `cd fronter && npm run dev`.

## Database

- Type: MySQL.
- Database name: `school_chinese_exam_practice`.
- Env file: `admin/.env` based on `admin/.env.example`.
- Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
- Schema: `admin/sql/schema.sql`.
- Seed: `admin/sql/seed.sql`, plus `npm run db:init` and `npm run seed:users`.
- **Migrations: `npm run db:migrate`.** `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, so it
  cannot add columns to an existing database — schema changes for deployed instances go in
  `admin/sql/migrations/NNN_*.js` (idempotent, tracked in `schema_migrations`). Add the same
  change to `schema.sql` as well so a fresh database builds in one pass.
- Keep real passwords only in local `.env`.

## AI Agent

- **Local Ollama only** — no cloud model providers. Config in `admin/.env`: `OLLAMA_HOST`,
  `OLLAMA_MODELS`, `AI_ENABLED`, `AI_MODELS`, `AI_DEFAULT_MODEL`, `AI_KEEP_ALIVE`,
  `AI_MAX_TOOL_ROUNDS`, `AI_NUM_CTX`, `AI_TIMEOUT_MS`.
- Backend: `admin/src/services/ai/{ollama,tools,agent,settings}.js`, routes in `admin/src/routes/ai.js`.
- Business grounding comes from server-side tools (`tools.js`) that query MySQL. The model is
  **never** allowed to invent scores, question text or counts — prompts require a tool call
  for any personal or platform data.
- Two scenes: `student` (汉语学习助教) and `admin` (平台管理助手). Admin scene requires role `admin`.
- **Never default to `models[0]`.** `GET /api/tags` sorts by name, so the first entry on this
  machine is `qwen2.5:0.5b` — a model that will not actually emit tool calls (its chat template
  contains a `tools` section, so `supportsTools()` returns a false positive) and answers from
  memory instead. Use `pickRecommendedModel()` in `services/ai/settings.js`, which picks the
  largest parameter count; `resolveModel()` and both `defaultModel` fields already go through it.
- Streaming is SSE at `POST /api/ai/chat`; the frontend reads it with `fetch` + `ReadableStream`
  (`src/api/ai.js`), not `EventSource` (which cannot POST).
- Voice is **client-side only**: browser Web Speech API, or the Android native bridge when the
  H5 runs inside the App WebView. Server-side TTS/ASR is deliberately not installed.
  Contract: `docs/android/WebView语音桥接.md`, implementation `docs/android/AgentVoiceBridge.kt`.

## Known Traps

- `pool.execute('... LIMIT ?', [n])` throws `Incorrect arguments to mysqld_stmt_execute`.
  LIMIT/OFFSET must be inlined as validated integers — see `admin/src/utils/paginate.js`.
- Express 4 does not catch async handler rejections. The SSE chat route wraps its handler
  explicitly; without that a bad request becomes an `unhandledRejection` and kills the process.
- qwen3 tool calling: `tool_calls[].function.arguments` arrives as an **object**, not a JSON
  string. Assistant messages carrying `tool_calls` must be replayed with empty `content`.
- `speechSynthesis.getVoices()` is async — listen for `voiceschanged` or you silently get the
  default voice.
- `supportsTools()` probes the **chat template**, not the model's real ability. Small models
  report `true` and then ignore the tools entirely, producing a confident fabricated answer.
  `agent.js` therefore grounds known data intents *before* the first round (`routeIntent`) rather
  than trusting the model to call a tool; the `if (!answer)` fallback alone cannot catch this,
  because a hallucination is non-empty.
- `middleware/rateLimit.js` keys on client IP by default. `POST /api/auth/register` allows
  10/hour/IP — fine for a lab, but a campus NAT puts a whole class behind one IP. Raise the
  limit or key on something else before deploying to a shared network.
- JWT is revoked through `users.token_version`: password change/reset and account disable bump
  it, and `auth()` rejects any token whose `tv` claim no longer matches. Old tokens without a
  `tv` claim are treated as `0` so an upgrade does not sign everyone out.

## Codex Notes

- Preserve trilingual content fields when editing questions, categories, and papers. Admin
  forms submit all three languages; the backend only upserts languages that carry content, so
  editing the Chinese tab must never wipe the English or Malay text.
- Every admin menu list is paginated and returns
  `{ list, total, page, pageSize, totalPages }`.
- If ports, env vars, or schema changes, update README and this file.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.
