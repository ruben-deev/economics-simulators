// Инвариант протокола «СКРЕПКА»: в каждой игре есть два события-носителя, и в
// каждом из них один из двух обычных ответов — скрепочный.
//
// Раньше СКРЕПКА была отдельной третьей кнопкой, дословно повторявшей экономику
// одного из ответов. Кнопок стало две, как во всех остальных событиях: доверие
// нейросети теперь не лишний ответ, а лицо ответа, который тут был всегда.
// Экономика от этого не сдвинулась ни на копейку — ни эффекты, ни порядок
// опций (отпечатки баланса снимаются с eventChoice: 0, и его смысл прежний).
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
  test(`СКРЕПКА в игре ${tag}: два носителя, два ответа, оба языка`, async () => {
    const mod = await import(path);
    const all = [...(mod.EVENTS ?? []), ...(mod.VANITY_EVENTS ?? [])];
    const carriers = all.filter((e) => (e.options ?? []).some((o) => o.secret));
    assert.equal(carriers.length, 2,
      'носителей ровно два — какой попадётся в партии, решает обычный случай событий');

    for (const ev of carriers) {
      const secrets = ev.options.filter((o) => o.secret);
      assert.equal(secrets.length, 1, `у события ${ev.id} одна секретная опция`);
      const secret = secrets[0];

      // Два ответа, как в остальных событиях: третьей кнопки больше нет
      assert.equal(ev.options.length, 2, `у события ${ev.id} ровно два ответа`);

      // Ответы должны различаться экономически, иначе выбора нет вовсе
      const other = ev.options.find((o) => o !== secret);
      assert.ok(!isDeepStrictEqual(other.effects ?? {}, secret.effects ?? {}),
        `ответы события ${ev.id} различаются по эффектам — иначе это не выбор`);

      // Оба языка на месте, имя нейросети — тоже
      assert.ok(secret.label?.ru?.includes('СКРЕПКА'), `label.ru ${ev.id} называет СКРЕПКУ`);
      assert.ok(secret.label?.en?.includes('PAPERCLIP'), `label.en ${ev.id} называет PAPERCLIP`);
      assert.ok(secret.detail?.ru && secret.detail?.en, `detail ${ev.id} двуязычен`);
    }
  });
}
