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
// в старых играх бейдж и коды «городов-побратимов» на финальном
// экране. Экономических бустов в зачётных партиях старых игр нет:
// они сломали бы сравнимость лидерборда и калибровку целей совета.
// ============================================================================

import { verifyResult } from './records.js';

// Лучший результат НОВОГРАДА на этом устройстве (для обратных бонусов)
export const META_BEST_KEY = 'novograd-meta';
// Введённые вручную строки результата (офлайн-разблокировка)
export const META_LINES_KEY = 'novograd-meta-lines';

// Две разные планки, и путать их нельзя:
//
//   threshold — ВХОД: игра пройдена прилично, актив в НОВОГРАДЕ открыт (★).
//               Стоит ниже осторожной опоры каждой игры — это ворота, а не
//               достижение.
//   solid     — ЕДИНИЦА ПЕРЕНОСА: «крепкий финал» той игры. Отсюда считается
//               ratio, то есть сколько клиентов, кассы и оценки перейдёт в
//               НОВОГРАД. Замер опорных стратегий (6 сидов, банкротство = 0):
//
//     игра        осторожная  средняя  размашистая  доведённая
//     НОВОЕДА       3.90        5.57      9.87         8.30   млрд
//     КИНОРЕКА     15.29       15.49    банкрот       35.80   млрд
//     БИЛЕТВИЛЬ     0.84        2.13      5.01         5.58   млрд
//
//   Правило шкалы: solid — средняя опора, потолок переноса (ratio 2) —
//   доведённая. Тогда одинаково сыгранная партия даёт одинаковый перенос
//   в любой из трёх игр. До этой правки НОВОЕДА упиралась в потолок всегда
//   (порог был 1 млрд при средней игре 5.6), а КИНОРЕКА не переносила
//   ничего (порог 30 млрд при средней игре 15.5).
//
//   БИЛЕТВИЛЬ пересчитан после оживления кризисов (аудит 2026-08): решение
//   кризисов — теперь обязательная часть нормальной игры, и вся шкала
//   поднялась почти вдвое. Средняя опора «сбор с организатора» — 4.13 млрд
//   (24 кода), отсюда solid 4 млрд. Вход (threshold) не тронут: ворота
//   в НОВОГРАД не должны дорожать задним числом.
//
//   КИНОРЕКА пересчитана после усталости от шума и вычета неотработанных
//   годовых из счёта (аудит 2026-08): опоры теперь 8.23 / 4.88 / 1.78 млрд.
//   Вход 1.5 млрд (ниже слабейшей опоры), solid 5 млрд (средняя опора).
//   Старые финалы, сыгранные в щедром мире, получат перенос по потолку —
//   это цена честной пересборки, потолок (x2) её ограничивает.
//
//   Входы (threshold) пересчитаны под сегодняшние коридоры опор (аудит
//   2026-08): правило «вход ниже ЛЮБОЙ опоры» после пересборок баланса
//   нарушалось у двух игр из трёх. Коридоры сегодня: НОВОЕДА
//   0.36/0.87/1.32 млрд (вход был 1 — выше двух опор), КИНОРЕКА
//   6.01/11.35/14.11 (вход был 12 — выше двух опор: честно пройденная
//   партия не зажигала ★, и игрок утыкался в «вводите коды»). Теперь вход
//   ниже самой слабой опоры каждой игры: доигранная не-банкротом партия
//   любой разумной стратегией открывает актив. Единицы переноса (solid)
//   не тронуты: сколько переносится — по-прежнему вопрос силы финала.
export const LEGACY_GAMES = [
  { assetId: 'delivery', tag: 'НОВОЕДА', recordsKey: 'novoeda-records', threshold: 0.3e9, solid: 5.5e9 },
  { assetId: 'streaming', tag: 'КИНОРЕКА', recordsKey: 'kinoreka-records', threshold: 1.5e9, solid: 5e9 },
  { assetId: 'tickets', tag: 'БИЛЕТВИЛЬ', recordsKey: 'biletville-records', threshold: 1.2e9, solid: 4e9 },
];

// Порог «достойного НОВОГРАДА» для обратных бонусов и секретной концовки
export const NOVOGRAD_WORTHY = 2e9;

const safeGetJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const safeSetJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
};

// Момент последнего «начать путь заново». Таблицы рекордов неприкосновенны,
// поэтому сброс их не стирает, а ставит эту отметку: наследие и путь серии
// считаются только по записям моложе неё. Сами таблицы в играх показывают
// всю историю, как и мировая таблица на сервере.
export const SERIES_RESET_KEY = 'series-reset-at';

const seriesResetAt = () => {
  try { return Number(localStorage.getItem(SERIES_RESET_KEY)) || 0; } catch { return 0; }
};

// Момент записи рекорда: id — миллисекунды создания (так пишут все четыре
// игры), date — день, страховка для записей без id. Совсем без меток —
// древняя запись, после сброса она не считается.
const recordTime = (r) => {
  const byId = Number(r?.id);
  if (Number.isFinite(byId) && byId > 0) return byId;
  const byDate = Date.parse(String(r?.date ?? ''));
  return Number.isFinite(byDate) ? byDate : 0;
};

// Лучший счёт из локальной таблицы рекордов игры, учитывая только записи
// не старше отметки сброса. Пока сброса не было (since = 0), считаются все,
// включая записи древних форматов без меток времени.
const bestLocalScore = (g, since) => {
  const records = safeGetJson(g.recordsKey, []);
  if (!Array.isArray(records)) return 0;
  return records.reduce((best, r) => (recordTime(r) >= since
    ? Math.max(best, Number(r?.score) || 0) : best), 0);
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

// Метка игры в строке результата несёт уровень сложности: «НОВОЕДА·сложный».
// Наследие смотрит на игру, а не на уровень: партия на сложном открывает
// актив ровно так же, как на обычном. Локальные таблицы рекордов лежат в
// одном ключе на игру и уже смешаны по уровням — строки должны вести себя
// так же, иначе перенос молча пропадал бы у всех, кто играл не на обычном.
const sameGame = (lineTag, gameTag) => lineTag === gameTag
  || String(lineTag ?? '').startsWith(`${gameTag}·`);

/**
 * Что разблокировано на этом устройстве: локальные рекорды старых игр
 * плюс введённые строки. { delivery: bool, streaming: bool, tickets: bool }
 */
export function legacyUnlocks() {
  const out = {};
  const since = seriesResetAt();
  const lines = savedLines().map(parseResultLine).filter(Boolean);
  for (const g of LEGACY_GAMES) {
    const bestLocal = bestLocalScore(g, since);
    const bestLine = lines
      .filter((l) => sameGame(l.tag, g.tag))
      .reduce((best, l) => Math.max(best, l.score), 0);
    out[g.assetId] = Math.max(bestLocal, bestLine) >= g.threshold;
  }
  return out;
}

/**
 * Лучший счёт по каждой игре на этом устройстве (локальные рекорды плюс
 * введённые строки). Нужен, чтобы в НОВОГРАД переносились не только «да/нет»,
 * но и числа финала: касса победившей компании и её оценка.
 * { delivery: number, streaming: number, tickets: number }
 */
export function legacyScores() {
  const out = {};
  const since = seriesResetAt();
  const lines = savedLines().map(parseResultLine).filter(Boolean);
  for (const g of LEGACY_GAMES) {
    const bestLocal = bestLocalScore(g, since);
    const bestLine = lines
      .filter((l) => sameGame(l.tag, g.tag))
      .reduce((best, l) => Math.max(best, l.score), 0);
    out[g.assetId] = Math.max(bestLocal, bestLine);
  }
  return out;
}

/**
 * Насколько крупным был финал игры-источника относительно её «крепкого»
 * финала. 1.0 — крепкая победа, 2.0 — вдвое лучше и потолок переноса:
 * доведённая партия как раз туда и приходит. Сверху срезано, потому что
 * перенос обязан оставаться ощутимым, но не решающим партию НОВОГРАДА.
 */
export const LEGACY_RATIO_CAP = 2;
export function legacyRatio(assetId, scores = legacyScores()) {
  const game = LEGACY_GAMES.find((g) => g.assetId === assetId);
  const unit = game?.solid ?? game?.threshold ?? 0;
  if (!unit) return 0;
  const score = Number(scores[assetId]) || 0;
  if (score <= 0) return 0;
  return Math.min(LEGACY_RATIO_CAP, score / unit);
}

// Бонусы для конкретной партии НОВОГРАДА: свой актив + лицензия + партнёрство,
// плюс перенесённые числа финала своей игры (касса и оценка).
export function legacyFor(assetId, unlocks = legacyUnlocks(), scores = legacyScores()) {
  return {
    asset: Boolean(unlocks[assetId]),
    cinema: Boolean(unlocks.streaming),
    tickets: Boolean(unlocks.tickets),
    // Счёт финала своей игры и его отношение к «крепкому» порогу
    assetScore: Number(scores[assetId]) || 0,
    assetRatio: legacyRatio(assetId, scores),
  };
}

export function novogradBest() {
  const saved = safeGetJson(META_BEST_KEY, null);
  return Number(saved?.best) || 0;
}

// Запоминает лучший финал НОВОГРАДА — старые игры читают его для
// неэкономических обратных бонусов (бейдж, коды партий).
//
// «Достойность» зависит от стартового актива: у сложных активов оптимум
// втрое ниже, поэтому НОВОГРАД передаёт свой порог, а сюда она попадает
// уже флагом. Второй аргумент необязателен — без него работает общий
// порог, как раньше.
export function rememberNovogradResult(score, worthyAt = NOVOGRAD_WORTHY) {
  const saved = safeGetJson(META_BEST_KEY, null);
  const value = Number(score) || 0;
  const best = Math.max(Number(saved?.best) || 0, value);
  const worthy = Boolean(saved?.worthy) || value >= (Number(worthyAt) || NOVOGRAD_WORTHY);
  safeSetJson(META_BEST_KEY, { best, worthy });
  return best;
}

// Открыт ли обратный бонус (бейдж конгломерата в старых играх).
// Записи прошлых версий несли только счёт — для них сравниваем с общим
// порогом, чтобы уже заслуженный бейдж не пропал.
export function conglomerateUnlocked() {
  const saved = safeGetJson(META_BEST_KEY, null);
  if (saved && saved.worthy) return true;
  return novogradBest() >= NOVOGRAD_WORTHY;
}

// Секретная концовка: финалы всех трёх игр + достойный НОВОГРАД.
// Строго косметика — множителя к счёту нет и не будет.
export function tripleCrown(unlocks = legacyUnlocks()) {
  return Boolean(unlocks.delivery && unlocks.streaming && unlocks.tickets);
}

/**
 * Путь серии: где игрок находится на пути из четырёх игр. Считается по
 * локальным рекордам и введённым строкам, поэтому одинаково работает и на
 * витрине, и внутри любой игры.
 *
 * Прогресс каждой игры нормируется её «крепким» порогом и срезается на
 * LEGACY_RATIO_CAP — иначе одна рекордная партия делала бы путь бессмысленным.
 * Возвращает { games: [...], filled, total, share, missing }.
 */
export function seriesScorecard() {
  const scores = legacyScores();
  const best = novogradBest();
  const games = LEGACY_GAMES.map((g) => {
    const score = Number(scores[g.assetId]) || 0;
    return {
      assetId: g.assetId,
      tag: g.tag,
      score,
      threshold: g.threshold,
      solid: g.solid,
      // Прогресс меряется «крепким финалом», а ворота — входным порогом:
      // открыть актив легко, набрать полный перенос — нет.
      ratio: legacyRatio(g.assetId, scores),
      done: score >= g.threshold,
    };
  });
  games.push({
    assetId: 'ecosystem',
    tag: 'НОВОГРАД',
    score: best,
    threshold: NOVOGRAD_WORTHY,
    ratio: Math.min(LEGACY_RATIO_CAP, best / NOVOGRAD_WORTHY),
    done: conglomerateUnlocked(),
  });
  const filled = games.filter((g) => g.done).length;
  // Доля пути: у каждой игры равный вес, внутри игры — прогресс до «крепкого»
  // финала. Сыграть все четыре крепко = 100%; дальше полоса не растёт.
  const share = games.reduce((a, g) => a + Math.min(1, g.ratio), 0) / games.length;
  return {
    games,
    filled,
    total: games.length,
    share,
    missing: games.filter((g) => !g.done).map((g) => g.tag),
  };
}

/**
 * Возвращение в базовую игру после экосистемы: что даст новый финал.
 * Чисто справочный расчёт — экономику зачётной партии он не меняет
 * (правило набора: обратные бонусы неэкономические). Нужен, чтобы у
 * повторной партии была ясная цель, а не «сыграть ещё раз».
 *
 * Возвращает { played, best, ratio, nextRatio, target, maxed } или null,
 * если НОВОГРАД ещё не открывали — тогда звать возвращаться не за чем.
 */
export function returnTarget(assetId) {
  if (!novogradBest()) return null;
  const game = LEGACY_GAMES.find((g) => g.assetId === assetId);
  if (!game) return null;
  const best = Number(legacyScores()[assetId]) || 0;
  const unit = game.solid ?? game.threshold;
  const capped = legacyRatio(assetId);
  // Следующая ступень наследия — целое число «крепких финалов»
  const nextRatio = Math.min(LEGACY_RATIO_CAP, Math.floor(capped) + 1);
  return {
    played: best > 0,
    best,
    ratio: capped,
    nextRatio,
    target: Math.round(unit * nextRatio),
    maxed: capped >= LEGACY_RATIO_CAP,
  };
}

// Сохранение партии НОВОГРАДА — сбрасывается вместе с прогрессом набора
export const NOVOGRAD_SAVE_KEY = 'novograd-save-v1';

// Сохранения незаконченных партий всех игр набора. Версии в ключах меняет
// сама игра при несовместимой правке сейва — тогда ключ обновляется и тут.
export const GAME_SAVE_KEYS = [
  'novoeda-save-v3', 'kinoreka-save-v1', 'biletville-save-v1', NOVOGRAD_SAVE_KEY,
];

/**
 * Сброс пути серии: строки наследия, лучший финал НОВОГРАДА и незаконченные
 * партии всех четырёх игр стираются, а вместо стирания рекордов ставится
 * отметка времени. Таблицы рекордов неприкосновенны — и личные, и мировая:
 * они история игрока, а не состояние пути. Поэтому наследие и путь серии
 * после сброса считаются только по записям МОЛОЖЕ отметки (см. legacyUnlocks
 * и legacyScores), и НОВОГРАД встречает без «что перенеслось из прошлой
 * игры», хотя сами таблицы в играх показывают всё как показывали.
 *
 * Не трогаются: рекорды всех игр, места в мировой таблице, мировая таблица
 * на сервере, имя игрока, язык и выбранный уровень сложности.
 */
export function resetEcosystemProgress() {
  const cleared = [];
  for (const key of [META_BEST_KEY, META_LINES_KEY, PROTOCOL_KEY, ...GAME_SAVE_KEYS]) {
    try {
      if (localStorage.getItem(key) !== null) cleared.push(key);
      localStorage.removeItem(key);
    } catch { /* приватный режим */ }
  }
  try { localStorage.setItem(SERIES_RESET_KEY, String(Date.now())); } catch { /* приватный режим */ }
  return cleared;
}

// Коды «городов-побратимов» — символическая награда в старых играх
export const TWIN_CITY_SEEDS = ['новоград-побратим', 'старгород-побратим', 'таксоград-побратим'];

// ============================================================================
// Протокол «СКРЕПКА» — юмористическая секретная концовка.
//
// В каждой игре среди обычных событий спрятаны решения «доверить вопрос
// нейросети „СКРЕПКА"». Экономически такая опция — точная копия одной из
// обычных (сравнимость мировой таблицы священна), различие чисто сюжетное.
// Кто выиграл все четыре игры И во всех четырёх хоть раз доверился СКРЕПКЕ,
// видит на финале НОВОГРАДА альтернативную концовку. Строго косметика.
// ============================================================================

// Отметки доверия по играм: { delivery, streaming, tickets, ecosystem }
export const PROTOCOL_KEY = 'series-protocol';

const PROTOCOL_ASSETS = ['delivery', 'streaming', 'tickets', 'ecosystem'];

export function protocolFlags() {
  const saved = safeGetJson(PROTOCOL_KEY, {});
  return saved && typeof saved === 'object' ? saved : {};
}

// Зовётся интерфейсом игры, когда игрок доверил решение СКРЕПКЕ.
// Возвращает { flags, count } — счётчик нужен для хлебной крошки в тосте.
export function markProtocolChoice(assetId) {
  const flags = protocolFlags();
  if (PROTOCOL_ASSETS.includes(assetId)) {
    flags[assetId] = true;
    safeSetJson(PROTOCOL_KEY, flags);
  }
  return { flags, count: PROTOCOL_ASSETS.filter((a) => flags[a]).length };
}

// Секретная концовка открыта: доверие во всех четырёх играх плюс весь путь
// пройден побеждённым (финалы трёх игр и достойный НОВОГРАД).
export function secretEndingUnlocked() {
  const flags = protocolFlags();
  if (!PROTOCOL_ASSETS.every((a) => flags[a])) return false;
  return tripleCrown() && conglomerateUnlocked();
}
