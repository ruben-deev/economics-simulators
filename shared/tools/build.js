// Сборка одной самодостаточной страницы games/<игра>/dist/<имя из манифеста>.html.
// Нужна, чтобы игру можно было просто открыть двойным кликом или раздать
// студентам одним файлом — без сервера, сборщиков и интернета.
//
// Запуск:
//   node shared/tools/build.js foodtech
//   node shared/tools/build.js            (соберёт все игры)
//
// Сборщик намеренно примитивный: модули склеиваются в порядке из манифеста
// игры, строки import/export вырезаются. Это работает, потому что в проекте
// нет циклических зависимостей, а совпадения имён ловит checkCollisions().

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gamesDir = path.join(root, 'games');

// Версия проекта — единственный источник правды. Она попадает и в имя
// собранного файла, и в саму страницу: две присланные сборки должны
// различаться в списке загрузок, а не только внутри.
const VERSION = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;

// Вырезает import-объявления (в том числе многострочные) и снимает export
function stripModuleSyntax(source) {
  const lines = source.split('\n');
  const out = [];
  let skipping = false;

  for (const line of lines) {
    if (skipping) {
      if (/from\s+['"][^'"]+['"];?\s*$/.test(line)) skipping = false;
      continue;
    }
    if (/^\s*import\s/.test(line)) {
      if (!/from\s+['"][^'"]+['"];?\s*$/.test(line) && !/^\s*import\s+['"][^'"]+['"];?\s*$/.test(line)) {
        skipping = true;
      }
      continue;
    }
    if (/^\s*export\s+default\s/.test(line)) continue;
    if (/^\s*export\s*\{[^}]*\}\s*;?\s*$/.test(line)) continue;      // export { A, B };
    out.push(line.replace(/^(\s*)export\s+/, '$1'));                  // export const/function/...
  }
  return out.join('\n');
}

// Склейка модулей в одну область видимости ловит только одинаковые имена
// на верхнем уровне — проверяем их заранее, иначе поломка всплывёт в браузере.
/**
 * Проверяет, что в манифесте перечислены все модули, которые игра реально
 * импортирует. Забытый модуль в браузере проявляется как «X is not defined»
 * посреди партии, а не при сборке, — поэтому ловим его здесь.
 */
function checkManifestComplete(dir, manifest, raw) {
  const listed = new Set(manifest.modules.map((rel) => path.resolve(dir, rel)));
  const missing = new Map();
  const importFrom = /(?:^|\n)\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/g;

  for (const { rel, source } of raw) {
    for (const m of source.matchAll(importFrom)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;            // внешних зависимостей у нас нет
      const resolved = path.resolve(path.dirname(path.resolve(dir, rel)), spec);
      if (!listed.has(resolved)) {
        missing.set(path.relative(dir, resolved), rel);
      }
    }
  }
  if (missing.size) {
    const lines = [...missing].map(([mod, from]) => `${mod} (импортируется из ${from})`);
    throw new Error(`В манифесте нет модулей, которые импортирует игра:\n  ${lines.join('\n  ')}`);
  }
}

function checkCollisions(chunks) {
  const seen = new Map();
  const clashes = [];
  const declaration = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
  for (const { rel, code } of chunks) {
    for (const line of code.split('\n')) {
      const m = declaration.exec(line);
      if (!m) continue;
      const name = m[1];
      if (seen.has(name)) clashes.push(`${name}: ${seen.get(name)} и ${rel}`);
      else seen.set(name, rel);
    }
  }
  if (clashes.length) {
    throw new Error(`Одинаковые имена на верхнем уровне разных модулей:\n  ${clashes.join('\n  ')}`);
  }
}

// Игрой считается каталог с манифестом сборки — заготовки без него пропускаем
async function listGames() {
  const entries = await fs.readdir(gamesDir, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(gamesDir, entry.name, 'build.manifest.js'));
      names.push(entry.name);
    } catch { /* каталог ещё не игра */ }
  }
  return names;
}

async function buildGame(name) {
  const dir = path.join(gamesDir, name);
  const manifestPath = path.join(dir, 'build.manifest.js');
  const { default: manifest } = await import(pathToFileURL(manifestPath).href);

  const rawHtml = await fs.readFile(path.join(dir, manifest.html), 'utf8');

  // Блок only-modular нужен только модульной версии: он объясняет, почему
  // страница не открывается двойным щелчком из папки. В сборке одним файлом
  // модулей нет, и эта подсказка была бы неверной — вырезаем её.
  const onlyModular = /[ \t]*<!-- only-modular:start -->[\s\S]*?<!-- only-modular:end -->\n?/g;
  const html = rawHtml.replace(onlyModular, '');
  if (html === rawHtml) {
    throw new Error(`В ${name}/index.html нет блока only-modular: разметка изменилась`);
  }
  // Вне блока only-modular обычных скриптов быть не должно — кроме метки
  // js-flag: она нужна обеим версиям, чтобы отличить «скрипты выключены»
  // от «скрипт упал».
  const strayScript = html
    .replace(/<script id="js-flag">[\s\S]*?<\/script>/, '')
    .match(/<script(?![^>]*type="module")/);
  if (strayScript) {
    throw new Error(`В ${name}/index.html остался обычный <script> вне блока only-modular`);
  }
  if (!/<script id="js-flag">/.test(html)) {
    throw new Error(`В ${name}/index.html нет метки js-flag: без неё пустой каркас ничем не объяснить`);
  }
  if (!/class="no-js"/.test(html) || !/nojs-hint/.test(html)) {
    throw new Error(`В ${name}/index.html нет объяснения для выключенных скриптов`);
  }

  const styles = [];
  for (const rel of manifest.css) {
    styles.push(await fs.readFile(path.join(dir, rel), 'utf8'));
  }

  const raw = [];
  for (const rel of manifest.modules) {
    raw.push({ rel, source: await fs.readFile(path.join(dir, rel), 'utf8') });
  }
  checkManifestComplete(dir, manifest, raw);

  const chunks = raw.map(({ rel, source }) => ({ rel, code: stripModuleSyntax(source) }));
  checkCollisions(chunks);

  const body = chunks
    .map(({ rel, code }) => `// ===== ${rel} ${'='.repeat(Math.max(0, 60 - rel.length))}\n${code}`)
    .join('\n\n');
  const bundle = `(function () {\n'use strict';\n${body}\n\n${manifest.entry}\n})();`;

  // Версия внутри страницы: по ней видно, какую сборку человек открыл.
  // Модульная версия этой метки не имеет и показывает себя как dev.
  let page = html.replace('<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n  <meta name="app-version" content="${VERSION}" />`);
  page = page.replace(/<script type="module"[^>]*><\/script>/, `<script>\n${bundle}\n</script>`);
  // Все <link rel="stylesheet"> заменяем встроенными стилями в том же порядке
  let styleIndex = 0;
  page = page.replace(/<link rel="stylesheet"[^>]*>/g, () => `<style>\n${styles[styleIndex++] ?? ''}\n</style>`);

  if (/<link rel="stylesheet"/.test(page) || /<script type="module"/.test(page)) {
    throw new Error(`Не удалось встроить ресурсы в ${name}: разметка index.html изменилась`);
  }

  const relTarget = manifest.output.replace('{version}', VERSION);
  const target = path.join(dir, relTarget);
  await fs.mkdir(path.dirname(target), { recursive: true });

  // Сборки прошлых версий убираем: иначе dist копит файлы, и непонятно,
  // какой из них раздавать. История версий живёт в git, а не в папке.
  const stalePattern = new RegExp(`^${path.basename(manifest.output)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('\\{version\\}', '.+')}$`);
  for (const file of await fs.readdir(path.dirname(target)).catch(() => [])) {
    if (file !== path.basename(target) && stalePattern.test(file)) {
      await fs.rm(path.join(path.dirname(target), file));
      console.log(`${name}: убрана старая сборка ${file}`);
    }
  }

  await fs.writeFile(target, page);
  console.log(`${name}: games/${name}/${relTarget} (${(page.length / 1024).toFixed(0)} КБ)`);
}

const requested = process.argv.slice(2);
const games = requested.length ? requested : await listGames();
for (const name of games) await buildGame(name);
