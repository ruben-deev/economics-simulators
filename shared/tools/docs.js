// ============================================================================
// Сборка документации: docs/**/*.md → соседние .html в стиле сайта.
//
// GitHub Pages при деплое артефактом не прогоняет Jekyll, поэтому .md
// раздаются как плоский текст — читать формулы и таблицы в сыром маркдауне
// невозможно. Этот сборщик генерирует тёмные HTML-страницы без зависимостей:
// оглавление из заголовков, шапка со ссылками «к играм» и RU⇄EN, таблицы в
// прокручиваемых обёртках, ASCII-схемы в <pre>.
//
// Поддержанное подмножество маркдауна — ровно то, чем пользуются наши
// документы: заголовки, абзацы, списки, цитаты, таблицы, ```-блоки,
// **жирный**, *курсив*, `код`, [ссылки](url), горизонтальная черта.
// ============================================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Внутренние рабочие планы (docs/*.md в корне) не публикуются
const DOC_DIRS = ['foodtech', 'cinema', 'tickets', 'ecosystem'];

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Строчная разметка: код → жирный → курсив → ссылки. Код первым, чтобы
// звёздочки внутри `формул` не превращались в курсив.
function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<i>$2</i>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) =>
    `<a href="${url.replace(/\.md($|#)/, '.html$1')}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`);
  return out;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  let hIndex = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {                    // код/схема
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="doc-pre"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    const h = line.match(/^(#{1,4}) +(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      if (level === 1) out.push(`<h1>${text}</h1>`);
      else {
        const id = `s-${++hIndex}`;
        if (level === 2) toc.push({ id, text });
        out.push(`<h${level} id="${id}">${text}</h${level}>`);
      }
      i++; continue;
    }
    if (/^\|/.test(line)) {                     // таблица
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const parse = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = parse(rows[0]);
      const body = rows.slice(rows[1] && /^[\s|:-]+$/.test(rows[1]) ? 2 : 1).map(parse);
      out.push('<div class="doc-tablewrap"><table class="data">');
      out.push(`<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`);
      out.push(`<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
      out.push('</table></div>');
      continue;
    }
    if (/^> ?/.test(line)) {                    // цитата
      const buf = [];
      while (i < lines.length && /^> ?/.test(lines[i])) { buf.push(lines[i].replace(/^> ?/, '')); i++; }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^[-*] +/.test(line) || /^\d+\. +/.test(line)) {   // список
      const ordered = /^\d+\. +/.test(line);
      const re = ordered ? /^\d+\. +/ : /^[-*] +/;
      const items = [];
      while (i < lines.length && (re.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf = [line];                         // абзац
    i++;
    while (i < lines.length && lines[i].trim() !== ''
      && !/^(#{1,4} |```|\||> ?|[-*] +|\d+\. +|---\s*$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

function page(md, { depth, lang, altHref, homeHref }) {
  const { html, toc } = mdToHtml(md);
  const title = (md.match(/^# +(.+)$/m) || [])[1] ?? 'Документация';
  const ru = lang === 'ru';
  const tocHtml = toc.length >= 3 ? `
  <nav class="doc-toc">
    <div class="doc-toc-title">${ru ? 'Содержание' : 'Contents'}</div>
    ${toc.map((x) => `<a href="#${x.id}">${x.text}</a>`).join('\n    ')}
  </nav>` : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="author" content="Ruben Deev" />
  <title>${esc(title)}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ctext y='.9em' font-size='56'%3E📚%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="${'../'.repeat(depth)}shared/styles.css" />
  <style>
    .doc { max-width: 860px; margin: 0 auto; padding: 28px 20px 80px; line-height: 1.65; }
    .doc-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
      padding-bottom: 14px; border-bottom: 1px solid var(--line); margin-bottom: 8px; font-size: 14px; }
    .doc-top a { color: var(--accent-2); text-decoration: none; }
    .doc h1 { font-size: 26px; line-height: 1.25; margin: 18px 0 6px; }
    .doc h2 { font-size: 20px; margin: 34px 0 10px; padding-top: 14px; border-top: 1px solid var(--line); }
    .doc h3 { font-size: 16px; margin: 24px 0 8px; }
    .doc h4 { font-size: 14px; margin: 18px 0 6px; }
    .doc p { margin: 10px 0; color: var(--text); }
    .doc li { margin: 5px 0; }
    .doc blockquote { margin: 14px 0; padding: 10px 16px; border-left: 3px solid var(--accent);
      background: var(--panel); border-radius: 0 8px 8px 0; color: var(--muted); }
    .doc-pre { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
      padding: 14px 16px; overflow-x: auto; font-size: 13px; line-height: 1.5; margin: 14px 0; }
    .doc code { background: var(--panel); border: 1px solid var(--line); border-radius: 5px;
      padding: 1px 5px; font-size: 0.92em; }
    .doc-pre code { background: none; border: none; padding: 0; }
    .doc-tablewrap { overflow-x: auto; margin: 14px 0; }
    .doc table.data { width: 100%; }
    .doc-toc { margin: 18px 0 6px; padding: 14px 18px; background: var(--panel);
      border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
    .doc-toc-title { font-weight: 700; margin-bottom: 8px; color: var(--muted);
      text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
    .doc-toc a { display: block; padding: 3px 0; color: var(--accent-2); text-decoration: none; }
    .doc hr { border: none; border-top: 1px solid var(--line); margin: 26px 0; }
  </style>
</head>
<body>
  <div class="doc">
    <div class="doc-top">
      <a href="${homeHref}">${ru ? '⬅ К играм' : '⬅ Back to the games'}</a>
      <a href="${altHref}">${ru ? 'English version' : 'Русская версия'}</a>
    </div>
    ${tocHtml}
    ${html}
  </div>
</body>
</html>
`;
}

let built = 0;
for (const dir of DOC_DIRS) {
  const base = join(ROOT, 'docs', dir);
  for (const name of readdirSync(base)) {
    const p = join(base, name);
    if (statSync(p).isDirectory()) continue;
    if (!name.endsWith('.md')) continue;
    const htmlName = name.replace(/\.md$/, '.html');
    const en = join(base, 'en', name);
    let enExists = false;
    try { enExists = statSync(en).isFile(); } catch { /* нет английской версии */ }
    writeFileSync(join(base, htmlName), page(readFileSync(p, 'utf8'), {
      depth: 2, lang: 'ru',
      altHref: enExists ? `en/${htmlName}` : `en/${htmlName}`,
      homeHref: '../../index.html',
    }));
    built++;
    if (enExists) {
      writeFileSync(join(base, 'en', htmlName), page(readFileSync(en, 'utf8'), {
        depth: 3, lang: 'en',
        altHref: `../${htmlName}`,
        homeHref: '../../../index.html',
      }));
      built++;
    }
  }
}
console.log(`docs: собрано ${built} страниц`);
