// Сборка одного самодостаточного файла dist/game.html.
// Нужна, чтобы игру можно было просто открыть двойным кликом или раздать
// студентам одним файлом — без сервера, сборщиков и интернета.
//
// Сборщик намеренно примитивный: модули склеиваются в фиксированном порядке,
// строки import/export вырезаются. Это работает, потому что в проекте нет
// ни циклических зависимостей, ни повторяющихся имён на верхнем уровне.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Порядок важен: зависимость должна идти раньше того, кто её использует.
const MODULES = [
  'src/model/rng.js',
  'src/model/config.js',
  'src/model/weather.js',
  'src/model/events.js',
  'src/model/engine.js',
  'src/ui/format.js',
  'src/ui/charts.js',
  'src/ui/app.js',
];

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
    if (/^\s*export\s*\{[^}]*\}\s*;?\s*$/.test(line)) continue;      // export { A, B };
    out.push(line.replace(/^(\s*)export\s+/, '$1'));                  // export const/function/...
  }
  return out.join('\n');
}

async function build() {
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'src/styles.css'), 'utf8');

  const chunks = [];
  for (const rel of MODULES) {
    const code = await fs.readFile(path.join(root, rel), 'utf8');
    chunks.push(`// ===== ${rel} ${'='.repeat(Math.max(0, 66 - rel.length))}\n${stripModuleSyntax(code)}`);
  }
  const bundle = `(function () {\n'use strict';\n${chunks.join('\n\n')}\n\ninit();\n})();`;

  const page = html
    .replace('<link rel="stylesheet" href="./src/styles.css" />', `<style>\n${css}\n</style>`)
    .replace('<script type="module" src="./src/main.js"></script>', `<script>\n${bundle}\n</script>`);

  if (page.includes('src/main.js') || page.includes('src/styles.css')) {
    throw new Error('Не удалось встроить ресурсы: разметка index.html изменилась');
  }

  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  const target = path.join(root, 'dist/game.html');
  await fs.writeFile(target, page);
  console.log(`Готово: dist/game.html (${(page.length / 1024).toFixed(0)} КБ) — открывается двойным кликом`);
}

build().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
