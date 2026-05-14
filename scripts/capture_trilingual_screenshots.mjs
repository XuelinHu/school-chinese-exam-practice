import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'docs', 'assets', 'screenshots_trilingual_raw');
const chrome = '/opt/google/chrome/chrome';
const port = 9333;
const base = 'http://localhost:5174';
const api = 'http://localhost:3000/api';

const pages = [
  { key: 'login', path: '/login', role: 'public', name: '登录页面' },
  { key: 'register', path: '/register', role: 'public', name: '注册页面' },
  { key: 'home', path: '/', role: 'student', name: '学生首页' },
  { key: 'practice_list', path: '/practice', role: 'student', name: '练习列表' },
  { key: 'practice_detail', path: '/practice/1', role: 'student', name: '答题详情' },
  { key: 'records', path: '/records', role: 'student', name: '成绩记录' },
  { key: 'wrong_book', path: '/wrong-book', role: 'student', name: '错题本' },
  { key: 'profile', path: '/profile', role: 'student', name: '个人中心' },
  { key: 'admin_dashboard', path: '/admin', role: 'admin', name: '管理台看板' },
  { key: 'admin_users', path: '/admin/users', role: 'admin', name: '学生管理列表' },
  { key: 'admin_questions', path: '/admin/questions', role: 'admin', name: '题库管理列表' },
  { key: 'admin_papers', path: '/admin/papers', role: 'admin', name: '练习试卷列表' },
  { key: 'admin_records', path: '/admin/records', role: 'admin', name: '成绩记录管理' }
];

const langs = [
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
      for (const [lang, suffix] of langs) {
        const auth = page.role === 'admin' ? admin.data : page.role === 'student' ? student.data : null;
        const setup = `(() => {
          localStorage.clear();
          localStorage.setItem('lang', ${JSON.stringify(lang)});
          ${auth ? `localStorage.setItem('token', ${JSON.stringify(auth.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(auth.user))});` : ''}
        })()`;
        await cdp.send('Runtime.evaluate', { expression: setup, awaitPromise: false });
        await cdp.send('Page.navigate', { url: `${base}${page.path}` });
        await wait(1400);
        await cdp.send('Runtime.evaluate', {
          expression: `document.body.style.background = '#ffffff'; document.documentElement.style.background = '#ffffff';`,
          awaitPromise: false
        });
        await wait(300);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
        await fs.writeFile(path.join(outDir, `${page.key}_${suffix}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ pages, langs }, null, 2), 'utf8');
    cdp.close();
  } finally {
    proc.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
