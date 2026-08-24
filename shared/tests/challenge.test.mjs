// Челлендж недели: код детерминирован от даты и одинаков всю ISO-неделю.
import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeCode } from '../challenge.js';

test('код недели одинаков с понедельника по воскресенье', () => {
  // 2026-08-24 — понедельник ISO-недели 35
  const days = ['24', '25', '26', '27', '28', '29', '30'];
  for (const d of days) {
    assert.equal(challengeCode(new Date(`2026-08-${d}T12:00:00Z`)), '2026-w35');
  }
  assert.equal(challengeCode(new Date('2026-08-31T12:00:00Z')), '2026-w36');
});

test('границы года считаются по ISO: неделя принадлежит году её четверга', () => {
  assert.equal(challengeCode(new Date('2026-01-01T12:00:00Z')), '2026-w01');
  // 1 января 2027 — пятница, её неделя началась в 2026-м и остаётся w53
  assert.equal(challengeCode(new Date('2027-01-01T12:00:00Z')), '2026-w53');
});

test('код годится в сид и в URL: латиница, цифры, дефис', () => {
  assert.match(challengeCode(new Date()), /^\d{4}-w\d{2}$/);
});
