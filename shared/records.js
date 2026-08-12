// ============================================================================
// Код партии и таблица рекордов.
//
// Код партии — это сид генератора: одинаковый код даёт одинаковый город,
// одинаковую погоду и одинаковые события. Так целая группа может играть
// одну и ту же партию, а результаты становятся сравнимыми.
//
// Строка результата — короткая, машинно-проверяемая: игра, версия, код,
// счёт, ходы и контрольная сумма. Подделать счёт, не пересчитав сумму,
// не выйдет — а пересчитывать её вручную дольше, чем сыграть честно.
//
// Рекорды лежат в localStorage браузера: это личная таблица игрока на этом
// устройстве, а не глобальный рейтинг. Ошибки хранилища (приватный режим,
// переполнение) молча игнорируются: рекорды — украшение, а не механика.
// ============================================================================

// Контрольная сумма: djb2-xor, четыре hex-символа. Не криптография — защита
// от опечатки и от «случайно дописал нолик», большего здесь не нужно.
export function checksum(text) {
  let h = 5381;
  for (const ch of String(text)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16).toUpperCase().padStart(4, '0').slice(-4);
}

// Строка результата: «ИГРА|версия|код|счёт|ходов|#СУММА»
export function resultString({ tag, version, seed, score, turns }) {
  const body = [tag, `v${version}`, seed, Math.round(score), turns].join('|');
  return `${body}|#${checksum(body)}`;
}

// Проверка строки результата (для преподавателя): true, если сумма сходится
export function verifyResult(line) {
  const at = String(line).lastIndexOf('|#');
  if (at < 0) return false;
  return checksum(line.slice(0, at)) === line.slice(at + 2).trim().toUpperCase();
}

const safeGet = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? []; } catch { return []; }
};
const safeSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};

export function loadRecords(key) {
  const list = safeGet(key);
  return Array.isArray(list) ? list : [];
}

// Добавляет запись и возвращает свежий топ. Запись всегда сохраняется в топ-N
// по счёту; если не дотянула — просто не попадает, но возвращается с рангом,
// чтобы интерфейс мог сказать «вы на 14-м месте из 14».
export function addRecord(key, record, max = 10) {
  const list = loadRecords(key);
  list.push(record);
  list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const rank = list.indexOf(record) + 1;
  safeSet(key, list.slice(0, max));
  return { top: list.slice(0, max), rank, total: list.length };
}

export function bestRecord(key) {
  const list = loadRecords(key);
  return list.length ? list[0] : null;
}
