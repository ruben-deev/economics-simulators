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

// Валюта показа. Модель считает в рублях всегда — курс трогает только то,
// что видит игрок (см. shared/format.js). Таблица живёт здесь, а не в
// форматтере, чтобы t() умела подставлять знак валюты в подписи ({cur})
// без кольцевого импорта.
const CURRENCY = {
  ru: { symbol: '₽', rate: 1, prefix: false },
  en: { symbol: '$', rate: 100, prefix: true },
};
export const currency = () => CURRENCY[current] ?? CURRENCY.ru;
export const curSymbol = () => currency().symbol;

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

// Язык из адреса: «…/index.html?lang=ru». Нужен, чтобы ссылку можно было
// давать конкретной аудитории. Раньше язык жил только в localStorage, и
// преподаватель, кинувший ссылку студентам, отправлял их на английскую
// версию: у нового посетителя ничего не сохранено, а по умолчанию здесь
// английский. Кнопка RU есть, но искать её никто не обязан.
function langFromUrl() {
  try {
    const v = new URL(window.location.href).searchParams.get('lang');
    return LANGS.includes(v) ? v : null;
  } catch { return null; }
}

// Адрес и выбранный язык не должны расходиться: если в ссылке был ?lang=en,
// а человек нажал RU, то после перезагрузки английский вернулся бы обратно.
// Поэтому переключение правит параметр — но только если он там уже есть:
// в обычные адреса ничего не дописываем.
function syncUrlLang(lang) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lang')) return;
    url.searchParams.set('lang', lang);
    window.history.replaceState(null, '', url);
  } catch { /* file:// и старые браузеры */ }
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* приватный режим */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (typeof window !== 'undefined') syncUrlLang(lang);
}

// Русский язык браузера. Смотрим весь список предпочтений, а не только
// первый: в системе бывает «en-US, ru-RU», и человек всё равно читает
// по-русски. Годятся и «ru», и «ru-RU», и «be-BY» не годится — гадать
// за соседние языки мы не беремся.
function browserWantsRu() {
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    return list.some((l) => /^ru\b/i.test(String(l ?? '')));
  } catch { return false; }
}

export function detectLang() {
  // Адрес сильнее сохранённого выбора: его написал тот, кто давал ссылку,
  // и он знает, кому её даёт. Выбор при этом запоминается — остальные три
  // игры и витрина откроются на том же языке.
  const fromUrl = typeof window !== 'undefined' ? langFromUrl() : null;
  if (fromUrl) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* приватный режим */ }
  // Дальше — язык браузера. Английский остаётся значением по умолчанию:
  // ссылки на игры расходятся шире русскоязычной аудитории. Но человеку с
  // русской системой показывать английскую версию и надеяться, что он найдёт
  // кнопку RU, — потеря на ровном месте.
  if (typeof navigator !== 'undefined' && browserWantsRu()) return 'ru';
  return 'en';
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
  // Знак валюты подставляется всегда: подписи вроде «ARPU, {cur}» не должны
  // требовать от каждого места вызова помнить про курс.
  return out.includes('{cur}') ? out.replaceAll('{cur}', curSymbol()) : out;
}
