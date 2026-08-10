// Совместимость с браузерами, а не только с тем, что стоит у разработчика.
//
// Игру скачивают одним файлом и открывают на чужой машине: на школьном ноутбуке,
// на маке с Safari, который не обновляли два года. Там нет консоли, и любая
// незнакомая браузеру функция превращается в пустую страницу и сообщение
// «не стартует» — без единой подсказки, чего именно не хватило.
//
// Один такой случай уже был: structuredClone (Safari 15.4, март 2022) вызывался
// в createInitialState, и на более старых сборках игра падала на первой строке.
// Ниже — список того, что появилось позже нашей планки, и проверка собранных
// файлов на его отсутствие. Планка: Safari 14.1 / весна 2021.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// [что искать, как называется, с какой версии Safari]
const TOO_NEW_JS = [
  ['structuredClone(', 'structuredClone()', 'Safari 15.4'],
  ['Object.hasOwn(', 'Object.hasOwn()', 'Safari 15.4'],
  ['Object.groupBy(', 'Object.groupBy()', 'Safari 17.4'],
  ['Map.groupBy(', 'Map.groupBy()', 'Safari 17.4'],
  ['Array.fromAsync(', 'Array.fromAsync()', 'Safari 18.4'],
  ['Promise.withResolvers(', 'Promise.withResolvers()', 'Safari 17.4'],
  ['.findLast(', 'Array.findLast()', 'Safari 15.4'],
  ['.findLastIndex(', 'Array.findLastIndex()', 'Safari 15.4'],
  ['.toSorted(', 'Array.toSorted()', 'Safari 16'],
  ['.toReversed(', 'Array.toReversed()', 'Safari 16'],
  ['.toSpliced(', 'Array.toSpliced()', 'Safari 16'],
  ['.roundRect(', 'canvas roundRect()', 'Safari 16.4'],
  ['Intl.Segmenter', 'Intl.Segmenter', 'Safari 14.1+ (частично)'],
  ['(?<=', 'ретроспективная проверка в регулярке', 'Safari 16.4'],
  ['(?<!', 'ретроспективная проверка в регулярке', 'Safari 16.4'],
  ['static {', 'статический блок класса', 'Safari 16.4'],
];

const TOO_NEW_CSS = [
  [':has(', 'селектор :has()', 'Safari 15.4'],
  ['@container', 'контейнерные запросы', 'Safari 16'],
  ['subgrid', 'subgrid', 'Safari 16'],
  ['color-mix(', 'color-mix()', 'Safari 16.2'],
  ['text-wrap:', 'text-wrap', 'Safari 17.5'],
  ['100dvh', 'единицы dvh', 'Safari 15.4'],
  ['100svh', 'единицы svh', 'Safari 15.4'],
  ['100lvh', 'единицы lvh', 'Safari 15.4'],
];

const bundles = await Promise.all(readdirSync(join(root, 'games')).map(async (game) => {
  const dir = join(root, 'games', game);
  const { default: manifest } = await import(pathToFileURL(join(dir, 'build.manifest.js')).href);
  return [game, join(dir, manifest.output)];
}));

test('в собранных файлах нет API новее нашей планки', () => {
  assert.ok(bundles.length >= 2, 'сборки не найдены — сначала npm run build');
  const found = [];
  for (const [game, path] of bundles) {
    const html = readFileSync(path, 'utf8');
    // Комментарии не считаются: в них эти имена как раз и объясняются
    const code = html.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    for (const [needle, name, since] of [...TOO_NEW_JS, ...TOO_NEW_CSS]) {
      if (code.includes(needle)) found.push(`${game}: ${name} — есть только с ${since}`);
    }
  }
  assert.deepEqual(found, []);
});

test('backdrop-filter всегда идёт с префиксом для Safari', () => {
  const css = readFileSync(join(root, 'shared', 'styles.css'), 'utf8');
  const plain = (css.match(/(?:^|[^-])backdrop-filter:/g) ?? []).length;
  const prefixed = (css.match(/-webkit-backdrop-filter:/g) ?? []).length;
  assert.equal(prefixed, plain, 'у каждого backdrop-filter должен быть -webkit- сосед');
});

test('игра переживает отсутствие localStorage', async () => {
  // Safari запрещает localStorage на file:// — игру открывают именно так.
  const { setLang, detectLang, getLang } = await import('../i18n.js');
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('The operation is insecure.'); },
  });
  try {
    assert.doesNotThrow(() => detectLang());
    assert.doesNotThrow(() => setLang('en'));
    assert.equal(getLang(), 'en');
    setLang('ru');
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
});

test('пустой каркас всегда объяснён: и когда скрипты выключены, и когда упали', () => {
  // Игру открывают в предпросмотре файла — на маке «Быстрый просмотр», на
  // айфоне карточка с кнопкой «Готово». WebKit там рисует HTML, но не
  // выполняет JavaScript, и от игры остаётся пустой каркас без единого слова.
  // Экран отказа тут не поможет: он тоже рисуется скриптом.
  for (const [game, bundle] of bundles) {
    const html = readFileSync(bundle, 'utf8');
    assert.match(html, /<html[^>]*class="no-js"/, `${game}: нет класса no-js на <html>`);
    assert.match(html, /<script id="js-flag">[\s\S]*?className = 'js'/,
      `${game}: нет метки js-flag, снимающей no-js`);
    assert.match(html, /\.no-js \.nojs-hint\s*\{\s*display:\s*block/,
      `${game}: объяснение не показывается при выключенных скриптах`);
    assert.match(html, /\.no-js \.layout[^{]*\{[^}]*display:\s*none/,
      `${game}: пустой каркас не скрывается при выключенных скриптах`);
    assert.match(html, /Просмотрщик показывает разметку, но намеренно не запускает скрипты/,
      `${game}: в объяснении нет самой частой причины`);
    for (const word of ['Телеграме', 'Открыть в Safari', 'пересылать не файл, а ссылку']) {
      assert.ok(html.includes(word), `${game}: в объяснении нет «${word}»`);
    }
    // Метка должна стоять до разметки игры, иначе каркас успеет мигнуть
    assert.ok(html.indexOf('js-flag') < html.indexOf('class="topbar"'),
      `${game}: метка js-flag стоит после разметки`);
  }
});
