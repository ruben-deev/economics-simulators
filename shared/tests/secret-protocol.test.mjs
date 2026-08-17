// Инвариант протокола «СКРЕПКА»: в каждой игре есть секретные опции,
// они спрятаны в двух событиях-носителях, стоят последними в списке
// и экономически точно копируют одну из обычных опций своего события —
// сравнимость мировой таблицы священна, различие только сюжетное.
//
// Появление носителя в партии — обычный случай событий, поэтому строгой
// гарантии «ровно один раз за партию» нет и быть не должно: форсирование
// исказило бы поток событий и отпечатки баланса. Здесь проверяется то,
// что гарантировать можно: сами опции на месте и устроены честно.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const GAMES = [
  ['НОВОЕДА', '../../games/foodtech/src/model/events.js'],
  ['КИНОРЕКА', '../../games/cinema/src/model/events.js'],
  ['БИЛЕТВИЛЬ', '../../games/tickets/src/model/events.js'],
  ['НОВОГРАД', '../../games/ecosystem/src/model/events.js'],
];

for (const [tag, path] of GAMES) {
  test(`СКРЕПКА в игре ${tag}: два носителя, копия экономики, оба языка`, async () => {
    const { EVENTS } = await import(path);
    const carriers = EVENTS.filter((e) => (e.options ?? []).some((o) => o.secret));
    assert.equal(carriers.length, 2,
      'носителей ровно два — какой попадётся в партии, решает обычный случай событий');

    for (const ev of carriers) {
      const secrets = ev.options.filter((o) => o.secret);
      assert.equal(secrets.length, 1, `у события ${ev.id} одна секретная опция`);
      const secret = secrets[0];

      // Секретная опция стоит последней: обычные ответы не сдвигаются,
      // и сохранённый в старой партии индекс выбора не меняет смысла
      assert.equal(ev.options.indexOf(secret), ev.options.length - 1,
        `секретная опция ${ev.id} — последняя в списке`);

      // Оба языка на месте, имя нейросети — тоже
      assert.ok(secret.label?.ru?.includes('СКРЕПКА'), `label.ru ${ev.id} называет СКРЕПКУ`);
      assert.ok(secret.label?.en?.includes('PAPERCLIP'), `label.en ${ev.id} называет PAPERCLIP`);
      assert.ok(secret.detail?.ru && secret.detail?.en, `detail ${ev.id} двуязычен`);

      // Экономика — точная копия одной из обычных опций этого же события
      const mirrored = ev.options.some((o) => !o.secret
        && isDeepStrictEqual(o.effects ?? {}, secret.effects ?? {}));
      assert.ok(mirrored,
        `эффекты секретной опции ${ev.id} совпадают с одной из обычных — иначе мировая таблица несравнима`);
    }
  });
}
