// ============================================================================
// Ядро локализации, общее для всех игр. Два языка: ru (по умолчанию) и en.
//
// Словарь строк живёт в самой игре (games/<игра>/src/strings.js) и передаётся
// сюда через setStrings(). Строки хранятся парами { ru, en } рядом друг с
// другом — так переводчик видит оригинал и перевод вместе, и невозможно
// потерять одну из версий незаметно.
//
// t(key, vars) — строка интерфейса с подстановкой {переменных}.
// tx(obj)      — двуязычное поле из модели (район, рычаг, событие, алгоритм).
// ============================================================================

const LANGS = ['ru', 'en'];
const STORAGE_KEY = 'game-lang';

let current = 'ru';
let dictionary = {};

// Игра регистрирует свой словарь при старте
export function setStrings(dict) {
  dictionary = dict ?? {};
}

export function getStrings() {
  return dictionary;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* приватный режим */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* приватный режим */ }
  if (typeof navigator !== 'undefined' && !/^ru\b/i.test(navigator.language ?? '')) return 'en';
  return 'ru';
}

// Двуязычное поле модели: { ru: '…', en: '…' }
export function tx(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[current] ?? field.ru ?? '';
}

export function t(key, vars) {
  const entry = dictionary[key];
  if (!entry) return key;
  let out = entry[current] ?? entry.ru ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replaceAll(`{${name}}`, String(value));
    }
  }
  return out;
}
