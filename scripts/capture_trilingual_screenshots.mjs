import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'docs', 'assets', 'screenshots_trilingual_raw');
const chrome = '/opt/google/chrome/chrome';
const port = 9333;
// 前端开发服务端口以 fronter/vite.config.js 为准（4031），可用环境变量覆盖
const base = process.env.SCREENSHOT_BASE || 'http://localhost:4031';
const api = process.env.SCREENSHOT_API || 'http://localhost:8033/api';

/**
 * langs 缺省表示三种语言都拍；显式给出时只拍列出的语言。
 * 后台菜单的中文界面已足以说明功能，三语能力由公共页与学员端页面演示，
 * 这样能避免同一个表格拍三遍，让素材集保持可读。
 */
const ZH_ONLY = [['zh-CN', 'zh']];

const pages = [
  // 公共服务
  { key: 'login', path: '/login', role: 'public', name: '登录页面' },
  { key: 'register', path: '/register', role: 'public', name: '注册页面' },
  { key: 'forgot_password', path: '/forgot-password', role: 'public', name: '找回密码页面' },
  // 学员端
  { key: 'home', path: '/', role: 'student', name: '学生首页' },
  { key: 'practice_list', path: '/practice', role: 'student', name: '练习列表' },
  { key: 'practice_detail', path: '/practice/1', role: 'student', name: '答题详情' },
  { key: 'records', path: '/records', role: 'student', name: '成绩记录' },
  { key: 'wrong_book', path: '/wrong-book', role: 'student', name: '错题本' },
  { key: 'profile', path: '/profile', role: 'student', name: '个人中心' },
  // 智能体弹框：点开悬浮球后再截图；zh 档额外提问一次，留下带真实回答的画面。
  // 回答来自本机 Ollama，耗时随模型冷加载波动，失败时退化为只有欢迎语的弹框。
  {
    key: 'agent_modal',
    path: '/',
    role: 'student',
    name: '智能体对话弹框',
    open: `document.querySelector('.agent-fab')?.click()`,
    ask: '我有哪些错题？',
    settleAfterAsk: 30000
  },
  // 管理台（12 个菜单）
  { key: 'admin_dashboard', path: '/admin', role: 'admin', name: '管理台数据看板', langs: ZH_ONLY },
  { key: 'admin_students', path: '/admin/students', role: 'admin', name: '学生管理列表', langs: ZH_ONLY },
  { key: 'admin_questions', path: '/admin/questions', role: 'admin', name: '题库管理列表', langs: ZH_ONLY },
  { key: 'admin_papers', path: '/admin/papers', role: 'admin', name: '练习试卷列表', langs: ZH_ONLY },
  { key: 'admin_records', path: '/admin/records', role: 'admin', name: '成绩记录管理', langs: ZH_ONLY },
  { key: 'admin_levels', path: '/admin/levels', role: 'admin', name: '等级管理列表', langs: ZH_ONLY },
  { key: 'admin_categories', path: '/admin/categories', role: 'admin', name: '分类管理列表', langs: ZH_ONLY },
  { key: 'admin_login_logs', path: '/admin/login-logs', role: 'admin', name: '登录日志列表', langs: ZH_ONLY },
  { key: 'admin_online', path: '/admin/online', role: 'admin', name: '在线状态列表', langs: ZH_ONLY },
  { key: 'admin_ai_settings', path: '/admin/ai/settings', role: 'admin', name: '智能体设置', langs: ZH_ONLY },
  { key: 'admin_ai_sessions', path: '/admin/ai/sessions', role: 'admin', name: '智能体会话列表', langs: ZH_ONLY },
  { key: 'admin_ai_logs', path: '/admin/ai/logs', role: 'admin', name: '智能体调用日志', langs: ZH_ONLY }
];

const allLangs = [
  ['zh-CN', 'zh'],
  ['en-US', 'en'],
  ['ms-MY', 'ms']
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function text(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  return {
    send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      ws.close();
    }
  };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const proc = spawn(chrome, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await wait(1200);
    await text(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).catch(async () => text(`http://127.0.0.1:${port}/json/new?about:blank`));
    const targets = await json(`http://127.0.0.1:${port}/json`);
    const pageTarget = targets.find((target) => target.type === 'page');
    const cdp = await connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    const student = await json(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student', password: 'student123456' })
    });
    const admin = await json(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123456' })
    });

    for (const page of pages) {
      const pageLangs = page.langs || allLangs;
      for (const [lang, suffix] of pageLangs) {
        const auth = page.role === 'admin' ? admin.data : page.role === 'student' ? student.data : null;
        const setup = `(() => {
          localStorage.clear();
          localStorage.setItem('lang', ${JSON.stringify(lang)});
          ${auth ? `localStorage.setItem('token', ${JSON.stringify(auth.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(auth.user))});` : ''}
        })()`;
        await cdp.send('Runtime.evaluate', { expression: setup, awaitPromise: false });
        await cdp.send('Page.navigate', { url: `${base}${page.path}` });
        await wait(1400);

        // 需要先点开某个控件的页面（例如智能体悬浮球）
        if (page.open) {
          await cdp.send('Runtime.evaluate', { expression: page.open, awaitPromise: false });
          await wait(1200);
        }

        // 需要真实问答画面的页面：只有中文档问一次，其余语言保留欢迎语画面
        if (page.ask && suffix === 'zh') {
          await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const ta = document.querySelector('.agent-input textarea');
              if (!ta) return false;
              const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              setter.call(ta, ${JSON.stringify(page.ask)});
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()`,
            awaitPromise: false
          });
          // 提交按钮带 :disabled="!draft.trim()"，要等 Vue 刷完这次输入才可点
          await wait(400);
          await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const btn = document.querySelector('.agent-input button[type="submit"]');
              if (btn && !btn.disabled) { btn.click(); return true; }
              return false;
            })()`,
            awaitPromise: false
          });
          await wait(page.settleAfterAsk || 20000);
          // 冷加载或模型不可用时回答会缺失，这里只记录，不中断整批采集
          const answered = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const turns = document.querySelectorAll('.agent-turn.is-assistant .agent-text');
              return turns.length ? turns[turns.length - 1].innerText.slice(0, 60) : '';
            })()`,
            returnByValue: true
          });
          const text = answered?.result?.value || '';
          console.log(`  ${page.key}_${suffix}: ${text ? `已获得回答「${text}…」` : '未获得回答，仅采集弹框界面'}`);
        }

        await cdp.send('Runtime.evaluate', {
          expression: `document.body.style.background = '#ffffff'; document.documentElement.style.background = '#ffffff';`,
          awaitPromise: false
        });
        await wait(300);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
        const file = `${page.key}_${suffix}.png`;
        await fs.writeFile(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
        console.log(`${file} (${Math.round(shot.data.length * 0.75 / 1024)} KB)`);
      }
    }
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ pages, langs: allLangs }, null, 2), 'utf8');
    cdp.close();
  } finally {
    proc.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
