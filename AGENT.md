# AGENT.md

## Project

- Project: `school-chinese-exam-practice`
- Stack: Vue 3 + Vite frontend, Node.js + Express backend, MySQL, local Ollama for the AI agent

## Runtime

- **`admin/.env` is required** — there is no fallback. `DB_PASSWORD` and `JWT_SECRET` are read
  with `requireEnv()` and the process exits with a clear message if either is empty. Copy
  `admin/.env.example` to `admin/.env` before the first `npm run dev`.
- Backend port: `8033` from `admin/.env.example` `PORT`.
- Frontend port: `4031` from `fronter/vite.config.js`.
- API base: `http://localhost:8033/api`, override with `VITE_API_BASE`.
- Backend dev: `cd admin && npm run dev`.
- Frontend dev: `cd fronter && npm run dev`.
- **Verification scripts** (need the backend running and seeded):
  `npm run check:permissions` (role matrix, 21 cases) and `npm run check:pagination`
  (pagination envelope on every list endpoint). Both live in `admin/scripts/`.

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
- Migrations must be **genuinely** idempotent. `information_schema.COLUMN_TYPE` holds only the
  type (`enum('a','b')`, lowercase, no `NOT NULL`/`DEFAULT`), so comparing it against a full
  column definition always mismatches and re-runs the `ALTER` forever. Compare type, nullability
  and default separately — see `setColumnType()` in `003_public_module.js`.
- **`users` rows are soft-deleted.** `DELETE /api/admin/users/:id` sets `deleted_at`, disables
  the account and bumps `token_version`; every user-facing query filters `deleted_at IS NULL`.
  Never hard-delete a user: the foreign keys on `users` are all `ON DELETE CASCADE`, so one
  click would also wipe `study_records`, `wrong_questions`, `favorite_questions`,
  `ai_sessions` (+`ai_messages`) and `password_resets`.
- `created_at` columns are `TIMESTAMP` while business time columns are `DATETIME`. New columns
  use `DATETIME`; rewriting the existing ones is a separate change with timezone risk.
- `favorite_questions` and `i18n_messages` are empty tables kept for schema stability.
- Keep real passwords only in local `.env`.

## AI Agent

- **Local Ollama only** — no cloud model providers. Config in `admin/.env`: `OLLAMA_HOST`,
  `OLLAMA_MODELS`, `AI_ENABLED`, `AI_MODELS`, `AI_DEFAULT_MODEL`, `AI_KEEP_ALIVE`,
  `AI_MAX_TOOL_ROUNDS`, `AI_NUM_CTX`, `AI_TIMEOUT_MS`, `AI_MAX_MODEL_SIZE_GB`, `AI_TEST_MODEL`.
- Backend: `admin/src/services/ai/{ollama,tools,agent,settings}.js`, routes in `admin/src/routes/ai.js`.
- Business grounding comes from server-side tools (`tools.js`) that query MySQL. The model is
  **never** allowed to invent scores, question text or counts — prompts require a tool call
  for any personal or platform data.
- Two scenes: `student` (汉语学习助教) and `admin` (平台管理助手). The admin scene requires a
  **staff** role — `admin` or `content_admin`, via `isStaff()` in `middleware/role.js`.
- **Only locally downloaded, loadable models under `AI_MAX_MODEL_SIZE_GB` (default 24) are
  selectable.** `applyFilters()` in `services/ai/ollama.js` is the single choke point: it tags
  each model `selectable` plus an `excludedReason` (`too-large`, `sizeUnknown`). Over-limit
  models **stay in the list** as `disabled` options so the user can see why they can't be
  picked — hiding them reads as "the pull failed". A model whose size can't be determined
  (the `scanModelsDir()` fallback reports `size: 0`) is **not** treated as small enough.
  The cap is a guardrail against absurd files, not a fit guarantee: `qwen3:30b-a3b` is 17.3GB
  on disk but only gets ~4.7GB of VRAM when other processes hold the rest of the card. Check
  `size_vram` in `ollama ps`, not the file size.
- **Never default to `models[0]`.** The order `GET /api/tags` returns is **not meaningful and
  not stable** — on this machine it has been `qwen2.5:0.5b` first and later `qwen3:30b-a3b`
  first, with no code change in between. `qwen2.5:0.5b` is the trap: its chat template contains
  a `tools` section, so `supportsTools()` reports a false positive, but the model never
  actually emits tool calls and answers from memory instead. Use `pickRecommendedModel()` in
  `services/ai/settings.js` (largest parameter count); `resolveModel()` and both `defaultModel`
  fields already go through it.
  The frontend must filter on `selectable !== false` before falling back, or it picks the
  over-limit model the backend just refused.
- **`AI_TEST_MODEL`** pins the model for faster local testing. It only applies when
  `NODE_ENV !== 'production'`; in production it is ignored with a warning. Small models skip
  real tool calls, so `routeIntent()` pre-grounds the 7 known data intents before the first
  round — those answers stay factual, free-form Q&A and multi-round tool use degrade. When it
  is active, `/api/ai/agent` returns `testModel` and the agent dialog shows a **persistent**
  warning under the title — not only inside the model panel, which someone chatting never
  opens. Deploying with it set is the failure mode this guards against.
- Streaming is SSE at `POST /api/ai/chat`; the frontend reads it with `fetch` + `ReadableStream`
  (`src/api/ai.js`), not `EventSource` (which cannot POST).
- Voice is **client-side only**: the browser's Web Speech API, called directly. There is no
  native bridge and no server-side TTS/ASR. `SpeechRecognition` needs a secure context (HTTPS
  or localhost); `speechSynthesis` does not — so "mic blocked, speakers fine" is a valid state
  and `useVoice()` reports the two independently. The public FRP entry is a bare IP over plain
  HTTP, so **the microphone is unavailable there by design**; use localhost or add TLS.
  `canListen` must therefore be `Boolean(stt) && isSecure`, never just "the API exists" —
  see the trap below.

## Known Traps

- `pool.execute('... LIMIT ?', [n])` throws `Incorrect arguments to mysqld_stmt_execute`.
  LIMIT/OFFSET must be inlined as validated integers — see `admin/src/utils/paginate.js`.
- Express 4 does not catch async handler rejections. The SSE chat route wraps its handler
  explicitly; without that a bad request becomes an `unhandledRejection` and kills the process.
- qwen3 tool calling: `tool_calls[].function.arguments` arrives as an **object**, not a JSON
  string. Assistant messages carrying `tool_calls` must be replayed with empty `content`.
- `speechSynthesis.getVoices()` is async — listen for `voiceschanged` or you silently get the
  default voice.
- **Chrome exposes `webkitSpeechRecognition` even on plain HTTP**, where `start()` immediately
  fails. So "the constructor exists" is not a usable availability test: gating the mic button
  on it leaves the button enabled on the FRP bare-IP entry and the user only finds out after
  clicking. Gate on `window.isSecureContext` too, and tell the user *before* they act.
- **Unknown paths are caught by two catch-alls** in `router/index.js`: `/admin/:pathMatch(.*)*`
  redirects to `/admin` (so a typo stays inside the console and the role guard decides where it
  lands), and a global one redirects to `/`. Before these existed, a mistyped URL rendered the
  app shell with an empty `<router-view>` and kept the wrong URL in the address bar. Note the
  student-management route is `/admin/students`, **not** `/admin/users`.
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

## Roles and Permissions

Four roles, defined once in `admin/src/middleware/role.js`:

| Role | Scope |
|---|---|
| `student` | Self-service registration; the student pages |
| `teacher` | Read-only teaching view (`/api/teaching/*`) |
| `content_admin` | Questions, papers, levels, categories (`/api/admin/{questions,papers,levels,categories}`) |
| `admin` | Everything, including users, records, logs, online status, AI sessions |

- The permission boundary is the `allow()` calls in `admin.js` and `teaching.js`, never the
  frontend. `AdminLayout.vue` hides menus per role for comfort only — typing the URL still
  hits the backend guard (`superAdmin` meta routes bounce content admins back to
  `/admin/questions`; the real user-management route is `/admin/students`).
- **`/api/teaching/*` is read-only by construction**: the file contains only `GET` handlers.
  Keep it that way when adding endpoints.
- Frontend mirrors: `isSuperAdmin`, `isContentAdmin`, `isStaff`, `isTeacher`, `canTeach` in
  `stores/auth.js`. `isAdmin` is kept but narrowed to super admin — use `isStaff` for
  "can enter the console".

## Codex Notes

- Preserve trilingual content fields when editing questions, categories, and papers. Admin
  forms submit all three languages; the backend only upserts languages that carry content, so
  editing the Chinese tab must never wipe the English or Malay text.
- Every admin menu list is paginated and returns
  `{ list, total, page, pageSize, totalPages }`. `/api/learning/{papers,records,wrong-questions}`
  and `/api/teaching/*` follow the same envelope. Run `npm run check:pagination` after adding a
  list endpoint and add it to that script's `CASES`.
- **Two deliberate exceptions to pagination**, both documented where they live:
  `/api/learning/{levels,categories}` return bare arrays because they fill `<select>` elements,
  and `GET /api/admin/papers/:id` returns the full question list because the composer submits a
  whole-set replacement — a truncated page there would delete the questions it did not show.
- Frontend list pages use `usePagedTable` (`fronter/src/composables/usePagedTable.js`).
  Language is passed via `extra: () => ({ lang: state.lang })`, **not** through `filters`, so
  that `reset()` cannot roll it back to a stale language. Extra envelope fields (`summary`,
  `windowMinutes`) come out through `onLoaded`.
- If ports, env vars, or schema changes, update README and this file.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.
