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

// Символы псевдографики: по ним схема отличается от формулы словами.
const DIAGRAM = /[\u2500-\u257F\u25B2\u25BA\u25BC\u25C4]/;

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
      // Схему рвать переносом нельзя — её смысл в том, где стоит стрелка.
      // Формулу словами можно: строки в ней самостоятельны, и на телефоне
      // перенос с висячим отступом читается лучше бокового листания.
      if (DIAGRAM.test(buf.join('\n'))) {
        out.push(`<pre class="doc-pre is-diagram"><code>${esc(buf.join('\n'))}</code></pre>`);
      } else {
        const rows = buf.map((l) => `<span class="pl">${esc(l) || '&nbsp;'}</span>`).join('');
        out.push(`<pre class="doc-pre"><code>${rows}</code></pre>`);
      }
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
  <details class="doc-toc" id="doc-toc">
    <summary>${ru ? 'Содержание' : 'Contents'} · ${toc.length}</summary>
    ${toc.map((x) => `<a href="#${x.id}">${x.text}</a>`).join('\n    ')}
  </details>` : '';
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
    /* Формула словами переносится с висячим отступом: продолжение строки
       видно, что оно продолжение, а не следующая строка формулы. */
    .doc-pre .pl { display: block; white-space: pre-wrap;
      padding-left: 2.2em; text-indent: -2.2em; overflow-wrap: break-word; }
    .doc-pre.is-diagram { white-space: pre; }
    .doc code { background: var(--panel); border: 1px solid var(--line); border-radius: 5px;
      padding: 1px 5px; font-size: 0.92em; }
    .doc-pre code { background: none; border: none; padding: 0; }
    .doc-tablewrap { overflow-x: auto; margin: 14px 0; }
    .doc table.data { width: 100%; }
    .doc-toc { margin: 18px 0 6px; padding: 10px 18px 14px; background: var(--panel);
      border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
    .doc-toc > summary { list-style: none; cursor: pointer; padding: 4px 0;
      font-weight: 700; color: var(--muted); text-transform: uppercase;
      font-size: 11px; letter-spacing: 0.08em; }
    .doc-toc > summary::-webkit-details-marker { display: none; }
    .doc-toc > summary::after { content: " ▾"; }
    .doc-toc[open] > summary::after { content: " ▴"; }
    .doc-toc a { display: block; padding: 3px 0; color: var(--accent-2); text-decoration: none;
      border-left: 2px solid transparent; padding-left: 8px; margin-left: -8px; }
    .doc-toc a.on { border-left-color: var(--accent); color: var(--text); }
    @media (min-width: 700px) { .doc-toc[open] { columns: 2; column-gap: 26px; }
      .doc-toc > summary { column-span: all; } }
    .doc h2, .doc h3 { scroll-margin-top: 14px; }
    /* Широкий экран: оглавление уходит на поле слева и остаётся на виду.
       Порог 1340 — раньше рейка налезала бы на текст. */
    @media (min-width: 1340px) {
      .doc-toc[open] { columns: 1; }
      .doc-toc { position: fixed; top: 18px; left: calc(50% - 656px); width: 210px;
        max-height: calc(100vh - 36px); overflow-y: auto; margin: 0; z-index: 5; }
      .doc-toc > summary { cursor: default; }
      .doc-toc > summary::after, .doc-toc[open] > summary::after { content: ""; }
    }
    .doc-up { position: fixed; right: 16px; bottom: 16px; z-index: 6;
      width: 42px; height: 42px; border-radius: 50%; cursor: pointer;
      background: var(--panel); color: var(--accent-2); font-size: 18px;
      border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
    .doc-up:hover { color: var(--text); border-color: var(--accent); }
    @media (max-width: 640px) {
      .doc { padding: 20px 14px 80px; }
      .doc-pre { font-size: 12px; padding: 12px 13px; }
    }
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
  <button class="doc-up" id="doc-up" type="button" hidden
    aria-label="${ru ? 'Наверх, к содержанию' : 'Back to top and contents'}">↑</button>
  <script>
    // Оглавление: на узком экране свёрнуто, на широком раскрыто (а от 1340
    // ещё и прижато к левому полю средствами CSS). Активная ссылка
    // подсвечивается по мере прокрутки.
    (function () {
      var toc = document.getElementById('doc-toc');
      var wide = function () { return matchMedia('(min-width: 700px)').matches; };
      if (toc) {
        var sync = function () { toc.open = wide(); };
        sync();
        addEventListener('resize', sync);
        var links = {};
        Array.prototype.forEach.call(toc.querySelectorAll('a'), function (a) {
          links[a.getAttribute('href').slice(1)] = a;
          a.addEventListener('click', function () { if (!wide()) toc.open = false; });
        });
        // Активен последний заголовок, который уже проехал верх экрана, —
        // наблюдатель пересечений оставлял бы список без подсветки везде,
        // где между заголовками больше одного экрана текста. Здесь это норма.
        var ids = Object.keys(links);
        var marked = null;
        var mark = function () {
          var active = ids[0];
          for (var k = 0; k < ids.length; k++) {
            var h = document.getElementById(ids[k]);
            if (h && h.getBoundingClientRect().top <= 90) active = ids[k];
          }
          if (active === marked) return;
          if (marked) links[marked].classList.remove('on');
          links[active].classList.add('on');
          marked = active;
          var rail = getComputedStyle(toc).position === 'fixed';
          if (rail) links[active].scrollIntoView({ block: 'nearest' });
        };
        var queued = false;
        addEventListener('scroll', function () {
          if (queued) return;
          queued = true;
          requestAnimationFrame(function () { queued = false; mark(); });
        }, { passive: true });
        mark();
      }
      // Кнопка «наверх»: страница разбора — полсотни экранов, и без неё
      // к оглавлению возвращаются только листанием.
      var up = document.getElementById('doc-up');
      if (!up) return;
      var toggle = function () { up.hidden = scrollY < 600; };
      toggle();
      addEventListener('scroll', toggle, { passive: true });
      up.addEventListener('click', function () {
        scrollTo({ top: 0, behavior: 'smooth' });
        if (toc && !wide()) toc.open = true;
      });
    })();
  </script>
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
