// Синтаксис исходников: каждый файл должен разбираться.
//
// Появился после живой поломки: правка добавила лишнюю запятую в импорт
// БИЛЕТВИЛЯ (`clamp,, VERDICT`). Однофайловая сборка при этом собралась и
// работала — сборщик переписывает импорты и поломку скрыл. А по ссылке с
// главной страницы сайта открывается МОДУЛЬНАЯ версия, которая грузит эти
// же исходники напрямую, и она умерла молча. Ни тесты (они импортируют
// модель, а не интерфейс), ни аудит интерфейса (он проверяет сборку) этого
// не увидели.
//
// Здесь проверяются ВСЕ файлы, включая ui/app.js, который не импортирует
// больше никто: разбор без исполнения ловит именно такие опечатки.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

test('все исходники разбираются без синтаксических ошибок', () => {
  const files = [...walk(`${ROOT}games`), ...walk(`${ROOT}shared`)];
  assert.ok(files.length > 30, `подозрительно мало файлов: ${files.length}`);
  const broken = [];
  for (const f of files) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      broken.push(`${f.replace(ROOT, '')}: ${String(e.stderr).split('\n').find((l) => l.includes('Error')) ?? 'ошибка разбора'}`);
    }
  }
  assert.deepEqual(broken, []);
});
