// ============================================================================
// Мета-прогрессия набора: НОВОГРАД — «эндгейм», три игры — его пролог.
//
// Механизм — строки результата с контрольной суммой (shared/records.js)
// плюс общий localStorage сайта. На том же устройстве финалы старых игр
// видны автоматически (их локальные таблицы рекордов лежат рядом);
// для другого устройства или офлайна строка результата вводится как код —
// подделать счёт, не пересчитав сумму, не выйдет.
//
// Гейт мягкий: НОВОГРАД доступен всем сразу, заслуженный вход даёт
// стартовое преимущество ВНУТРИ него:
//   финал НОВОЕДЫ    -> «известный бренд еды»: дешевле возврат и органика;
//   финал КИНОРЕКИ   -> скидка на лицензию стриминга в подписку Plus;
//   финал БИЛЕТВИЛЯ  -> готовое партнёрство по билетам (без абонентки).
// Бонусы ортогональны и складываются; их суммарный размер замерен по
// правилу «чувствуется, но не решает партию» (~4–6% итога).
//
// Обратный бонус — строго неэкономический: успешный НОВОГРАД открывает
// в старых играх бейдж и спец-сиды «городов-побратимов» на финальном
// экране. Экономических бустов в зачётных партиях старых игр нет:
// они сломали бы сравнимость лидерборда и калибровку целей совета.
// ============================================================================

import { verifyResult } from './records.js';

// Лучший результат НОВОГРАДА на этом устройстве (для обратных бонусов)
export const META_BEST_KEY = 'novograd-meta';
// Введённые вручную строки результата (офлайн-разблокировка)
export const META_LINES_KEY = 'novograd-meta-lines';

// Порог «достойного финала» — грейд «крепкий» соответствующей игры
export const LEGACY_GAMES = [
  { assetId: 'delivery', tag: 'НОВОЕДА', recordsKey: 'novoeda-records', threshold: 1e9 },
  { assetId: 'streaming', tag: 'КИНОРЕКА', recordsKey: 'kinoreka-records', threshold: 3e10 },
  { assetId: 'tickets', tag: 'БИЛЕТВИЛЬ', recordsKey: 'biletville-records', threshold: 4e9 },
];

// Порог «достойного НОВОГРАДА» для обратных бонусов и секретной концовки
export const NOVOGRAD_WORTHY = 2e9;

const safeGetJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const safeSetJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};

// Разбор строки результата: «ИГРА|vX.Y.Z|код|счёт|ходов|#СУММА»
export function parseResultLine(line) {
  const text = String(line ?? '').trim();
  if (!verifyResult(text)) return null;
  const parts = text.split('|');
  if (parts.length < 6) return null;
  const score = Number(parts[3]);
  if (!Number.isFinite(score)) return null;
  return { tag: parts[0], version: parts[1], seed: parts[2], score, turns: Number(parts[4]) };
}

export function savedLines() {
  const list = safeGetJson(META_LINES_KEY, []);
  return Array.isArray(list) ? list : [];
}

// Добавляет введённую строку; отвергает мусор и дубли.
export function addResultLine(line) {
  const parsed = parseResultLine(line);
  if (!parsed) return { ok: false };
  const lines = savedLines();
  if (!lines.includes(String(line).trim())) {
    lines.push(String(line).trim());
    safeSetJson(META_LINES_KEY, lines);
  }
  return { ok: true, parsed };
}

/**
 * Что разблокировано на этом устройстве: локальные рекорды старых игр
 * плюс введённые строки. { delivery: bool, streaming: bool, tickets: bool }
 */
export function legacyUnlocks() {
  const out = {};
  const lines = savedLines().map(parseResultLine).filter(Boolean);
  for (const g of LEGACY_GAMES) {
    const records = safeGetJson(g.recordsKey, []);
    const bestLocal = Array.isArray(records)
      ? records.reduce((best, r) => Math.max(best, Number(r?.score) || 0), 0) : 0;
    const bestLine = lines
      .filter((l) => l.tag === g.tag)
      .reduce((best, l) => Math.max(best, l.score), 0);
    out[g.assetId] = Math.max(bestLocal, bestLine) >= g.threshold;
  }
  return out;
}

// Бонусы для конкретной партии НОВОГРАДА: свой актив + лицензия + партнёрство
export function legacyFor(assetId, unlocks = legacyUnlocks()) {
  return {
    asset: Boolean(unlocks[assetId]),
    cinema: Boolean(unlocks.streaming),
    tickets: Boolean(unlocks.tickets),
  };
}

export function novogradBest() {
  const saved = safeGetJson(META_BEST_KEY, null);
  return Number(saved?.best) || 0;
}

// Запоминает лучший финал НОВОГРАДА — старые игры читают его для
// неэкономических обратных бонусов (бейдж, спец-сиды).
export function rememberNovogradResult(score) {
  const best = Math.max(novogradBest(), Number(score) || 0);
  safeSetJson(META_BEST_KEY, { best });
  return best;
}

// Открыт ли обратный бонус (бейдж конгломерата в старых играх)
export function conglomerateUnlocked() {
  return novogradBest() >= NOVOGRAD_WORTHY;
}

// Секретная концовка: финалы всех трёх игр + достойный НОВОГРАД.
// Строго косметика — множителя к счёту нет и не будет.
export function tripleCrown(unlocks = legacyUnlocks()) {
  return Boolean(unlocks.delivery && unlocks.streaming && unlocks.tickets);
}

// Спец-сиды «городов-побратимов» — награда-сувенир в старых играх
export const TWIN_CITY_SEEDS = ['новоград-побратим', 'старгород-побратим', 'таксоград-побратим'];
