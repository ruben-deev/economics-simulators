// Сборка одной самодостаточной страницы games/<игра>/dist/game.html.
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

  const html = await fs.readFile(path.join(dir, manifest.html), 'utf8');

  const styles = [];
  for (const rel of manifest.css) {
    styles.push(await fs.readFile(path.join(dir, rel), 'utf8'));
  }

  const chunks = [];
  for (const rel of manifest.modules) {
    const source = await fs.readFile(path.join(dir, rel), 'utf8');
    chunks.push({ rel, code: stripModuleSyntax(source) });
  }
  checkCollisions(chunks);

  const body = chunks
    .map(({ rel, code }) => `// ===== ${rel} ${'='.repeat(Math.max(0, 60 - rel.length))}\n${code}`)
    .join('\n\n');
  const bundle = `(function () {\n'use strict';\n${body}\n\n${manifest.entry}\n})();`;

  let page = html.replace(/<script type="module"[^>]*><\/script>/, `<script>\n${bundle}\n</script>`);
  // Все <link rel="stylesheet"> заменяем встроенными стилями в том же порядке
  let styleIndex = 0;
  page = page.replace(/<link rel="stylesheet"[^>]*>/g, () => `<style>\n${styles[styleIndex++] ?? ''}\n</style>`);

  if (/<link rel="stylesheet"/.test(page) || /<script type="module"/.test(page)) {
    throw new Error(`Не удалось встроить ресурсы в ${name}: разметка index.html изменилась`);
  }

  const target = path.join(dir, 'dist/game.html');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, page);
  console.log(`${name}: games/${name}/dist/game.html (${(page.length / 1024).toFixed(0)} КБ)`);
}

const requested = process.argv.slice(2);
const games = requested.length ? requested : await listGames();
for (const name of games) await buildGame(name);
