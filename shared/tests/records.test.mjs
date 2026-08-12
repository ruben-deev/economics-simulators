// Тесты кода партии и строки результата. Часть с localStorage не тестируется:
// это браузерное хранилище, и в node его нет — логика там тривиальная.

import test from 'node:test';
import assert from 'node:assert/strict';

import { checksum, resultString, verifyResult } from '../records.js';

test('контрольная сумма стабильна и чувствительна к правкам', () => {
  assert.equal(checksum('НОВОЕДА|v1.9.0|урок-7б|2412000000|52'),
    checksum('НОВОЕДА|v1.9.0|урок-7б|2412000000|52'));
  assert.notEqual(checksum('a'), checksum('b'));
  // «дописал нолик» меняет сумму — ровно тот случай, от которого защищаемся
  assert.notEqual(checksum('score|100'), checksum('score|1000'));
  assert.match(checksum('anything'), /^[0-9A-F]{4}$/);
});

test('строка результата собирается и проверяется', () => {
  const line = resultString({ tag: 'НОВОЕДА', version: '1.9.0', seed: 'урок-7б', score: 2_412_345_678.9, turns: 52 });
  assert.ok(line.startsWith('НОВОЕДА|v1.9.0|урок-7б|2412345679|52|#'));
  assert.ok(verifyResult(line), 'честная строка проходит проверку');
  assert.ok(!verifyResult(line.replace('2412345679', '9412345679')),
    'подправленный счёт проверку не проходит');
  assert.ok(!verifyResult('мусор без суммы'));
});
