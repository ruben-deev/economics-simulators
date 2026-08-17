// Мета-прогрессия набора: строки результата, наследие, обратные бонусы.
// localStorage подменяется — тесты гоняются в node без браузера.

import test from 'node:test';
import assert from 'node:assert/strict';

// Подмена localStorage ДО импорта модуля: meta.js читает его лениво,
// но страховка от порядка импортов лишней не будет.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  // length и key(i) нужны полному сбросу: он перебирает хранилище,
  // выискивая ключи lb-mine-*. Без них перебор молча не находит ничего.
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};

const {
  parseResultLine, addResultLine, savedLines, legacyUnlocks, legacyScores, legacyFor,
  rememberNovogradResult, novogradBest, conglomerateUnlocked, tripleCrown,
  LEGACY_GAMES, NOVOGRAD_WORTHY, META_BEST_KEY, legacyRatio, LEGACY_RATIO_CAP,
  resetEcosystemProgress, NOVOGRAD_SAVE_KEY,
  markProtocolChoice, protocolFlags, secretEndingUnlocked,
} = await import('../meta.js');
const { resultString } = await import('../records.js');

const line = (tag, score) => resultString({ tag, version: '1.0.0', seed: 'мета', score, turns: 36 });

test('строка результата разбирается только с честной контрольной суммой', () => {
  const ok = line('НОВОЕДА', 2_000_000_000);
  const parsed = parseResultLine(ok);
  assert.equal(parsed.tag, 'НОВОЕДА');
  assert.equal(parsed.score, 2_000_000_000);
  assert.equal(parseResultLine(ok.replace('2000000000', '9000000000')), null,
    'подделанный счёт не проходит проверку суммы');
  assert.equal(parseResultLine('мусор'), null);
});

test('введённые строки открывают наследие, пороги — грейд «крепкий»', () => {
  store.clear();
  let unlocks = legacyUnlocks();
  assert.deepEqual(unlocks, { delivery: false, streaming: false, tickets: false });

  // Слабый финал не открывает: берём половину действующего порога, чтобы
  // тест не устаревал при перекалибровках входов
  const deliveryGate = LEGACY_GAMES.find((g) => g.assetId === 'delivery').threshold;
  addResultLine(line('НОВОЕДА', deliveryGate / 2));
  assert.equal(legacyUnlocks().delivery, false, 'ниже порога — не считается');

  addResultLine(line('НОВОЕДА', 1.5e9));
  addResultLine(line('КИНОРЕКА', 4e10));
  assert.deepEqual(legacyUnlocks(), { delivery: true, streaming: true, tickets: false });
  assert.equal(tripleCrown(), false, 'короны нет без третьей игры');

  addResultLine(line('БИЛЕТВИЛЬ', 5e9));
  assert.equal(tripleCrown(), true);
  assert.equal(savedLines().length, 4);

  // Дубли не копятся
  addResultLine(line('БИЛЕТВИЛЬ', 5e9));
  assert.equal(savedLines().length, 4);
});

test('локальные рекорды старых игр открывают наследие сами', () => {
  store.clear();
  const g = LEGACY_GAMES[0];
  store.set(g.recordsKey, JSON.stringify([{ score: g.threshold + 1, outcome: 'finished' }]));
  assert.equal(legacyUnlocks().delivery, true);
});

test('legacyFor: свой актив — только от своей игры, лицензия и партнёрство — всегда', () => {
  store.clear();
  addResultLine(line('КИНОРЕКА', 4e10));
  const forDelivery = legacyFor('delivery');
  assert.equal(forDelivery.asset, false, 'финал КИНОРЕКИ не делает своим актив доставки');
  assert.equal(forDelivery.cinema, true, 'лицензия кино — от финала КИНОРЕКИ');
  assert.equal(forDelivery.tickets, false);
  assert.equal(forDelivery.assetScore, 0, 'чужой финал не переносит числа в ваш актив');
  const forStreaming = legacyFor('streaming');
  assert.equal(forStreaming.asset, true, 'стриминговому активу финал КИНОРЕКИ — свой');
});

test('в НОВОГРАД переносятся числа финала, а не только отметка «сыграно»', () => {
  store.clear();
  const g = LEGACY_GAMES.find((x) => x.assetId === 'delivery');
  // Единица переноса — «крепкий финал», а не входной порог: открыть актив
  // легко, набрать полный перенос — нет.
  addResultLine(line(g.tag, g.solid));
  assert.equal(legacyRatio('delivery'), 1, 'крепкий финал — единица шкалы');
  assert.equal(legacyFor('delivery').assetScore, g.solid, 'счёт финала доступен движку');

  // Вход открыт задолго до крепкого финала, но чисел ещё не переносит
  store.clear();
  addResultLine(line(g.tag, g.threshold));
  assert.equal(legacyFor('delivery').asset, true, 'входной порог открывает актив');
  assert.ok(legacyRatio('delivery') < 1, 'но перенос по числам ещё неполный');

  // Победа вдвое крупнее крепкой переносит вдвое больше — и это потолок
  addResultLine(line(g.tag, g.solid * 2));
  assert.equal(legacyRatio('delivery'), 2);

  // Сверху шкала срезана: рекордная прошлая партия не решает новую
  addResultLine(line(g.tag, g.solid * 50));
  assert.equal(legacyRatio('delivery'), LEGACY_RATIO_CAP, 'перенос ограничен потолком');

  // Числа чужой игры в ваш актив не текут
  assert.equal(legacyRatio('tickets'), 0);
});

test('строка с уровнем сложности открывает наследие так же, как обычная', () => {
  store.clear();
  const g = LEGACY_GAMES.find((x) => x.assetId === 'delivery');
  // Метка партии несёт уровень: «НОВОЕДА·сложный». Наследие смотрит на игру,
  // а не на уровень — иначе перенос молча пропадал бы у всех, кто играл
  // не на обычном.
  addResultLine(line(`${g.tag}·сложный`, g.solid * 2));
  assert.equal(legacyFor('delivery').asset, true, 'актив открыт');
  assert.equal(legacyRatio('delivery'), 2, 'и числа финала перенеслись полностью');
  // Чужая игра из-за общего префикса не подхватывается
  assert.equal(legacyRatio('tickets'), 0);
});

test('обратный бонус открывается достойным финалом НОВОГРАДА', () => {
  store.clear();
  assert.equal(conglomerateUnlocked(), false);
  rememberNovogradResult(NOVOGRAD_WORTHY - 1);
  assert.equal(conglomerateUnlocked(), false);
  rememberNovogradResult(NOVOGRAD_WORTHY + 1);
  assert.equal(conglomerateUnlocked(), true);
  assert.equal(novogradBest(), NOVOGRAD_WORTHY + 1);
  // Худший результат не затирает лучший
  rememberNovogradResult(1);
  assert.equal(novogradBest(), NOVOGRAD_WORTHY + 1);
});

test('порог достойного финала приходит от актива, а не общий на всех', () => {
  store.clear();
  // Сложный стартовый актив: его потолок втрое ниже, поэтому НОВОГРАД
  // передаёт свой порог. Счёт ниже общего порога всё равно засчитывается.
  const hardWorthy = NOVOGRAD_WORTHY / 4;
  rememberNovogradResult(hardWorthy - 1, hardWorthy);
  assert.equal(conglomerateUnlocked(), false, 'ниже своего порога — не открыт');
  rememberNovogradResult(hardWorthy + 1, hardWorthy);
  assert.equal(conglomerateUnlocked(), true, 'выше своего порога — открыт');

  // Запись прошлой версии несла только счёт: заслуженный бейдж не пропадает
  store.clear();
  localStorage.setItem(META_BEST_KEY, JSON.stringify({ best: NOVOGRAD_WORTHY + 1 }));
  assert.equal(conglomerateUnlocked(), true, 'старая запись читается по общему порогу');
});

test('сброс пути: наследие и партии стираются, рекорды неприкосновенны', () => {
  store.clear();
  const g = LEGACY_GAMES[0];
  // Заработанный рекорд (id — миллисекунды записи, как пишут игры),
  // строка наследия, сохранения и место в мировой таблице
  const oldRecord = [{ id: String(Date.now() - 60_000), score: g.threshold * 2 }];
  localStorage.setItem(g.recordsKey, JSON.stringify(oldRecord));
  addResultLine(line(g.tag, g.threshold * 2));
  rememberNovogradResult(5e9);
  localStorage.setItem(NOVOGRAD_SAVE_KEY, '{"state":{}}');
  localStorage.setItem('novoeda-save-v3', '{"state":{}}');
  localStorage.setItem('lb-mine-НОВОЕДА', '{"rank":3}');
  // Имя, язык и уровень сложности сброс пережить обязаны
  localStorage.setItem('lb-name', 'Аня');
  localStorage.setItem('series-difficulty', 'hard');
  assert.equal(legacyUnlocks().delivery, true);

  const cleared = resetEcosystemProgress();
  assert.ok(cleared.length >= 4, 'сброшено всё перечисленное');
  assert.equal(novogradBest(), 0, 'лучший финал НОВОГРАДА забыт');
  assert.equal(savedLines().length, 0, 'введённые строки наследия забыты');
  assert.equal(localStorage.getItem(NOVOGRAD_SAVE_KEY), null, 'партия НОВОГРАДА сброшена');
  assert.equal(localStorage.getItem('novoeda-save-v3'), null, 'партия НОВОЕДЫ сброшена');
  assert.equal(conglomerateUnlocked(), false, 'обратный бонус закрыт заново');
  // Таблицы рекордов неприкосновенны (правило владельца): сброс ставит
  // отметку времени, и старые записи перестают питать наследие — но из
  // таблиц не пропадают. Мировую таблицу сброс не трогает по построению.
  assert.equal(localStorage.getItem(g.recordsKey), JSON.stringify(oldRecord),
    'таблица рекордов не тронута');
  assert.equal(localStorage.getItem('lb-mine-НОВОЕДА'), '{"rank":3}',
    'место в мировой таблице не тронуто');
  assert.equal(legacyUnlocks().delivery, false, 'старый рекорд наследие больше не открывает');
  assert.equal(legacyScores().delivery, 0, 'и в перенос не попадает');
  assert.equal(localStorage.getItem('lb-name'), 'Аня', 'имя игрока пережило сброс');
  assert.equal(localStorage.getItem('series-difficulty'), 'hard', 'уровень пережил сброс');

  // Партия, сыгранная после сброса, открывает наследие заново
  const fresh = { id: String(Date.now() + 60_000), score: g.threshold * 2 };
  localStorage.setItem(g.recordsKey, JSON.stringify([...oldRecord, fresh]));
  assert.equal(legacyUnlocks().delivery, true, 'новая запись после сброса считается');

  // Запись без меток времени (древний формат) после сброса тоже не считается
  localStorage.setItem(g.recordsKey, JSON.stringify([{ score: g.threshold * 3 }]));
  assert.equal(legacyUnlocks().delivery, false, 'безвременная запись считается древней');
});

test('протокол «СКРЕПКА»: четыре доверия плюс весь пройденный путь', () => {
  store.clear();
  assert.equal(secretEndingUnlocked(), false, 'на чистом устройстве концовки нет');
  markProtocolChoice('delivery');
  markProtocolChoice('streaming');
  markProtocolChoice('tickets');
  const { count } = markProtocolChoice('ecosystem');
  assert.equal(count, 4, 'счётчик доверий для хлебной крошки в тосте');
  assert.equal(secretEndingUnlocked(), false, 'доверие без побед концовку не открывает');

  addResultLine(line('НОВОЕДА', 1.5e9));
  addResultLine(line('КИНОРЕКА', 4e10));
  addResultLine(line('БИЛЕТВИЛЬ', 5e9));
  rememberNovogradResult(5e9);
  assert.equal(secretEndingUnlocked(), true, 'четыре победы и четыре доверия — концовка открыта');

  // Мусорная метка игры молча не пишется
  markProtocolChoice('чужая-игра');
  assert.equal(Object.keys(protocolFlags()).length, 4, 'посторонние метки не копятся');

  // Сброс пути закрывает и секретную концовку
  resetEcosystemProgress();
  assert.equal(secretEndingUnlocked(), false, 'после сброса путь и протокол начинаются заново');
  assert.equal(Object.keys(protocolFlags()).length, 0, 'отметки доверия стёрты');
});
