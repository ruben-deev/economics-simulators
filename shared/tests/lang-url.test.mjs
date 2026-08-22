// Язык из адреса: «?lang=ru» в ссылке. Раньше язык жил только в localStorage,
// и ссылка, отправленная русскому классу, открывалась на английском — у нового
// посетителя ничего не сохранено, а по умолчанию здесь английский.
//
// Браузера в тестах нет, поэтому window и localStorage подменяются до импорта.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let href = 'https://example.org/games/foodtech/index.html';
globalThis.window = {
  get location() { return { href }; },
  history: { replaceState: (_s, _t, url) => { href = String(url); } },
};

const { detectLang, setLang, getLang } = await import('../i18n.js');

test('адрес задаёт язык и сильнее сохранённого выбора', () => {
  store.clear();
  href = 'https://example.org/games/foodtech/index.html';
  assert.equal(detectLang(), 'en', 'без адреса и без памяти — английский по умолчанию');

  store.set('game-lang', 'en');
  href = 'https://example.org/games/foodtech/index.html?lang=ru';
  assert.equal(detectLang(), 'ru', 'ссылка сильнее сохранённого выбора');

  href = 'https://example.org/games/foodtech/index.html?lang=zz';
  store.set('game-lang', 'ru');
  assert.equal(detectLang(), 'ru', 'мусор в адресе игнорируется, память остаётся');

  href = 'https://example.org/games/foodtech/index.html?seed=abc';
  store.clear();
  assert.equal(detectLang(), 'en', 'посторонние параметры язык не задают');
});

test('выбор языка запоминается и правит адрес, но не засоряет его', () => {
  store.clear();
  href = 'https://example.org/games/foodtech/index.html?lang=en';
  setLang('ru');
  assert.equal(getLang(), 'ru');
  assert.equal(store.get('game-lang'), 'ru', 'выбор запомнен для остальных игр');
  assert.ok(href.includes('lang=ru'), 'параметр в адресе догнал выбор');

  href = 'https://example.org/games/foodtech/index.html';
  setLang('en');
  assert.equal(href, 'https://example.org/games/foodtech/index.html',
    'в чистый адрес параметр не дописывается');

  setLang('чужой');
  assert.equal(getLang(), 'en', 'посторонний язык не принимается');
});
