// ============================================================================
// Пакет преподавателя: по одному zip на игру в downloads/.
//
//   node shared/tools/teacher-pack.js
//
// Внутри архива всё, что нужно для занятия без подготовки: офлайн-сборка
// игры, методичка и разбор формул на двух языках, шаблон таблицы для сбора
// результатов и записка с планом на первые пять минут. HTML документации
// пакуется автономным: таблица стилей инлайнится, ссылка «к играм»
// переписывается на сайт (в архиве витрины нет).
//
// Zip пишется своими руками (метод store + CRC32) и нарочно детерминирован:
// фиксированная метка времени у записей означает, что пересборка без
// изменений даёт байт в байт тот же файл — git не видит ложных диффов.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://ruben-deev.github.io/economics-simulators/';

const GAMES = [
  { dir: 'foodtech', slug: 'novoeda', ru: 'НОВОЕДА — доставка еды', en: 'NOVOEDA — food delivery' },
  { dir: 'cinema', slug: 'kinoreka', ru: 'КИНОРЕКА — онлайн-кинотеатр', en: 'KINOREKA — streaming' },
  { dir: 'tickets', slug: 'biletville', ru: 'БИЛЕТВИЛЬ — билетный сервис', en: 'BILETVILLE — ticketing' },
  { dir: 'ecosystem', slug: 'novograd', ru: 'НОВОГРАД — экосистема', en: 'NOVOGRAD — ecosystem' },
];

// --- CRC32 (тот же полином, что в zip) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- минимальный zip: метод store, имена в UTF-8, фиксированное время ---
function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = 0x0000; // 00:00:00
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // версия
    local.writeUInt16LE(0x0800, 6);      // флаг: имена в UTF-8
    local.writeUInt16LE(0, 8);           // метод store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const b of central) cdSize += b.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(cdStart, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

// Документация автономно: инлайн стилей + «к играм» ведёт на сайт
const styles = readFileSync(join(ROOT, 'shared', 'styles.css'), 'utf8');
function standaloneDoc(path) {
  let html = readFileSync(path, 'utf8');
  html = html.replace(/<link rel="stylesheet" href="[^"]*styles\.css" \/>/,
    `<style>\n${styles}\n</style>`);
  html = html.replace(/href="(\.\.\/)+index\.html"/g, `href="${SITE}"`);
  return Buffer.from(html, 'utf8');
}

function readmeText(g, distName) {
  return `${g.ru} · ${g.en}
================================================================

ПАКЕТ ПРЕПОДАВАТЕЛЯ · TEACHER PACK

Что внутри / What is inside:
  ${distName}
      — сама игра одним файлом: двойной щелчок, интернет не нужен.
        The game as a single file: double-click it, no internet needed.
  docs/teacher-guide.html (RU) · docs/en/teacher-guide.html (EN)
      — сценарии занятий с хронометражем.
        Lesson plans with timings.
  docs/economics.html (RU) · docs/en/economics.html (EN)
      — разбор всех формул модели.
        The full formula write-up.
  results.csv
      — шаблон таблицы для сбора работ.
        A template for collecting results.

Первые пять минут занятия / The first five minutes:
  1. Придумайте код партии (например, "урок-7б") и продиктуйте группе.
     Invent a game code (say, "class-7b") and dictate it to the group.
  2. Каждый вводит код на экране приветствия — у всех один город.
     Everyone enters it on the welcome screen — same city for all.
  3. В конце соберите строки результата: контрольная сумма не даст
     подделать счёт. Кнопка «Скопировать» — на финальном экране.
     Collect the result strings at the end: the checksum makes score
     doctoring harder than honest play. The Copy button is on the
     final screen.

Онлайн-версия и язык в ссылке / Online version and language links:
  ${SITE}games/${g.dir}/?lang=ru
  ${SITE}games/${g.dir}/?lang=en

Лицензия / Licence: CC BY-NC-SA 4.0 · Ruben Deev
`;
}

const RESULTS_CSV = '﻿Имя / Name;Строка результата / Result string;Комментарий / Notes\n';

mkdirSync(join(ROOT, 'downloads'), { recursive: true });
for (const g of GAMES) {
  const distDir = join(ROOT, 'games', g.dir, 'dist');
  const distName = readdirSync(distDir).find((f) => f.endsWith('.html'));
  if (!distName) throw new Error(`${g.dir}: нет сборки в dist/`);
  const docs = join(ROOT, 'docs', g.dir);
  const entries = [
    { name: 'README.txt', data: Buffer.from(readmeText(g, distName), 'utf8') },
    { name: 'results.csv', data: Buffer.from(RESULTS_CSV, 'utf8') },
    { name: distName, data: readFileSync(join(distDir, distName)) },
    { name: 'docs/teacher-guide.html', data: standaloneDoc(join(docs, 'teacher-guide.html')) },
    { name: 'docs/en/teacher-guide.html', data: standaloneDoc(join(docs, 'en', 'teacher-guide.html')) },
    { name: 'docs/economics.html', data: standaloneDoc(join(docs, 'economics.html')) },
    { name: 'docs/en/economics.html', data: standaloneDoc(join(docs, 'en', 'economics.html')) },
  ];
  const zip = makeZip(entries);
  const out = join(ROOT, 'downloads', `${g.slug}-teacher-pack.zip`);
  writeFileSync(out, zip);
  console.log(`пакет: downloads/${g.slug}-teacher-pack.zip (${Math.round(zip.length / 1024)} КБ)`);
}
