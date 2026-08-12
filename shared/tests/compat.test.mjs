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

// Версии игр независимы: у каждой своя в её манифесте. package.json остаётся
// версией монорепозитория и в имена файлов больше не попадает.
const REPO_VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const bundles = await Promise.all(readdirSync(join(root, 'games')).map(async (game) => {
  const dir = join(root, 'games', game);
  const { default: manifest } = await import(pathToFileURL(join(dir, 'build.manifest.js')).href);
  const version = manifest.version ?? REPO_VERSION;
  return [game, join(dir, manifest.output.replace('{version}', version)), manifest.output, version];
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

test('версия видна в имени файла, внутри страницы и во всех ссылках', () => {
  // Две присланные сборки должны различаться в списке загрузок, иначе
  // «а это точно новый файл?» — вопрос без ответа. Проверяем всю цепочку:
  // имя файла, метка внутри страницы и каждая ссылка в документации.
  const referenced = new Set();
  for (const [game, bundle, template, version] of bundles) {
    assert.ok(template.includes('{version}'), `${game}: в манифесте нет подстановки {version}`);
    assert.match(version, /^\d+\.\d+\.\d+$/, `${game}: версия «${version}» не похожа на версию`);
    assert.ok(bundle.includes(`-v${version}.html`), `${game}: версии нет в имени файла`);
    const html = readFileSync(bundle, 'utf8');
    assert.match(html, new RegExp(`<meta name="app-version" content="${version}"`),
      `${game}: версии нет внутри страницы`);
    referenced.add(bundle.split('/').pop());

    // В dist не должно остаться сборок других версий
    const dir = join(root, 'games', game, 'dist');
    const base = template.split('/').pop().replace('{version}', '');
    for (const file of readdirSync(dir)) {
      if (!file.startsWith(base.split('-v')[0])) continue;
      assert.ok(file.includes(`-v${version}.`), `${game}: в dist осталась старая сборка ${file}`);
    }
  }

  const docs = ['README.md', 'README.en.md', 'index.html',
    'docs/cinema/teacher-guide.md', 'docs/cinema/en/teacher-guide.md',
    'docs/foodtech/teacher-guide.md', 'docs/foodtech/en/teacher-guide.md',
    'docs/tickets/economics.md', 'docs/tickets/en/economics.md'];
  const stale = [];
  for (const doc of docs) {
    const text = readFileSync(join(root, doc), 'utf8');
    for (const m of text.matchAll(/[\w-]+-simulator-v[\d.]+\.html/g)) {
      if (!referenced.has(m[0])) stale.push(`${doc}: ${m[0]}`);
    }
    // Ссылка без версии — тоже ошибка: такого файла больше нет
    for (const m of text.matchAll(/dist\/([\w-]+-simulator)(?!-v)/g)) {
      stale.push(`${doc}: ${m[1]} без версии`);
    }
  }
  assert.deepEqual(stale, []);
});

test('на телефоне итоги месяца идут раньше рычагов, а кнопка хода никуда не уезжает', () => {
  // В одну колонку порядок сверху вниз решает всё, а по разметке первой идёт
  // колонка с ползунками: на телефоне она отодвигала итоги месяца почти на
  // три экрана вниз. Проверяем правила, а не пиксели — движка тут нет.
  const css = readFileSync(join(root, 'shared', 'styles.css'), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 980px)'));

  assert.match(phone, /\.layout\s*\{[^}]*display:\s*flex/, 'в одну колонку .layout должен стать flex');
  const order = ['col-center', 'col-left', 'col-right']
    .map((cls) => Number(phone.match(new RegExp(`\\.${cls}\\s*\\{\\s*order:\\s*(\\d+)`))?.[1]));
  assert.deepEqual(order, [1, 2, 3], 'порядок колонок на телефоне: итоги -> рычаги -> справочники');

  // Полоса кнопок прилипает к экрану, а не к низу шапки: элемент с
  // backdrop-filter становится точкой отсчёта для position: fixed внутри себя.
  const narrow = css.slice(css.indexOf('@media (max-width: 700px)'));
  assert.match(narrow, /\.topbar-actions\s*\{[^}]*position:\s*fixed/, 'кнопки должны быть закреплены');
  const topbarRule = narrow.match(/\.topbar\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(topbarRule, /backdrop-filter:\s*none/,
    'у шапки на телефоне нужно снять backdrop-filter, иначе fixed считается от неё');
  assert.match(narrow, /body\s*\{[^}]*padding-bottom/, 'без отступа снизу полоса накроет последнюю панель');
});

test('авторство не теряется при сборке', () => {
  // Файл уезжает от автора вместе с игрой: подпись должна быть внутри него,
  // а не только в репозитории, откуда его никто не откроет.
  for (const [game, bundle] of bundles) {
    const html = readFileSync(bundle, 'utf8');
    assert.match(html, /<meta name="author" content="zero900"/, `${game}: нет meta author`);
    for (const lang of ['ru', 'en']) {
      const line = html.match(new RegExp(`helpAuthor:[^}]*${lang}: '([^']*)'`))?.[1];
      assert.ok(line && line.includes('zero900'), `${game}: подписи автора нет на ${lang}`);
    }
  }
  const home = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(home, /<meta name="author" content="zero900"/, 'витрина: нет meta author');
  assert.ok((home.match(/zero900/g) ?? []).length >= 3, 'витрина: подписи нет в подвале на обоих языках');
});
