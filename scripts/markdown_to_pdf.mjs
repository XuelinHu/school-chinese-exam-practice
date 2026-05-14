import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const docsDir = path.join(root, 'docs', 'softcopyright');
const archiveDir = path.join(root, '软著', '马来西亚留学生汉语练习平台V1.0');
const softwareName = '马来西亚留学生汉语练习平台';
const version = 'V1.0';

const jobs = [
  {
    md: path.join(docsDir, `${softwareName}源代码.md`),
    html: path.join(docsDir, `${softwareName}源代码.html`),
    pdf: path.join(archiveDir, 'pdf', `${softwareName}源代码.pdf`),
    code: true
  },
  {
    md: path.join(docsDir, '软件设计说明书.md'),
    html: path.join(docsDir, '软件设计说明书.html'),
    pdf: path.join(archiveDir, 'pdf', '软件设计说明书.pdf'),
    code: false
  }
];

function esc(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function table(lines) {
  const rows = lines.filter((line) => !/^\|\s*-+/.test(line)).map((line) =>
    line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  );
  return `<table>${rows.map((row, index) => `<tr>${row.map((cell) => `${index === 0 ? '<th>' : '<td>'}${inline(cell)}${index === 0 ? '</th>' : '</td>'}`).join('')}</tr>`).join('')}</table>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let code = null;
  let tableLines = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  function flushTable() {
    if (tableLines.length) {
      html.push(table(tableLines));
      tableLines = [];
    }
  }

  for (const line of lines) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      flushTable();
      if (code) {
        html.push(`<pre><code>${esc(code.lines.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code = { lang: fence[1], lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (/^\|.+\|$/.test(line)) {
      flushParagraph();
      tableLines.push(line);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      html.push(`<figure><img src="${esc(image[2])}" alt="${esc(image[1])}"></figure>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      html.push(`<p>• ${inline(line.slice(2))}</p>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushTable();
  return html.join('\n');
}

async function render(job) {
  const markdown = await fs.readFile(job.md, 'utf8');
  const body = markdownToHtml(markdown);
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 22mm 16mm 18mm; }
    body { font-family: "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; color: #111; line-height: 1.55; font-size: ${job.code ? '10.5px' : '12px'}; }
    .header { position: fixed; top: -14mm; left: 0; right: 0; height: 10mm; text-align: center; font-size: 10px; color: #333; border-bottom: 1px solid #bbb; padding-bottom: 2mm; }
    .footer { position: fixed; bottom: -12mm; left: 0; right: 0; height: 8mm; text-align: center; font-size: 10px; color: #333; }
    h1 { text-align: center; font-size: 22px; margin: 0 0 14px; page-break-after: avoid; }
    h2 { font-size: 16px; margin: 18px 0 8px; border-bottom: 1px solid #999; padding-bottom: 3px; page-break-after: avoid; }
    h3 { font-size: 14px; margin: 14px 0 6px; page-break-after: avoid; }
    h4 { font-size: 13px; margin: 10px 0 4px; page-break-after: avoid; }
    p { margin: 5px 0; text-align: justify; }
    pre { white-space: pre-wrap; word-break: break-word; font-family: "Noto Sans Mono CJK SC", Consolas, monospace; font-size: ${job.code ? '8.4px' : '9px'}; line-height: 1.28; background: #fafafa; border: 1px solid #ddd; padding: 6px; margin: 6px 0 10px; }
    code { font-family: "Noto Sans Mono CJK SC", Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10.5px; border-top: 1.4px solid #111; border-bottom: 1.4px solid #111; }
    th { border-bottom: 1px solid #111; font-weight: 600; }
    th, td { padding: 4px 6px; vertical-align: top; text-align: left; }
    figure { margin: 10px 0 14px; text-align: center; page-break-inside: avoid; }
    img { max-width: 96%; max-height: 210mm; object-fit: contain; }
  </style>
</head>
<body>
  <div class="header">${softwareName} ${version}</div>
  <div class="footer"></div>
  ${body}
</body>
</html>`;
  await fs.writeFile(job.html, html, 'utf8');
  execFileSync('/snap/bin/chromium', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    `--print-to-pdf=${job.pdf}`,
    `file://${job.html}`
  ], { stdio: 'ignore' });
  return job.pdf;
}

for (const job of jobs) {
  console.log(await render(job));
}
