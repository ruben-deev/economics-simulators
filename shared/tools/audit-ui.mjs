// Аудит интерфейса: четыре игры × два языка × широкий и телефон.
//
// Ищет ровно то, что модельные тесты поймать не могут: переполнение страницы,
// незаполненные подстановки {…}, сырые ключи строк, кириллицу в английской
// версии, пустые панели, мелкие цели нажатия и ошибки консоли.
//
// Требует поднятого сервера и браузера (playwright подключается абсолютным
// путём ниже — на другой машине поправьте импорт):
//   PORT=8899 node shared/tools/serve.js &
//   node shared/tools/audit-ui.mjs
//
// Ловушки прогона, на которых уже обжигались: кнопка хода живёт в шапке, и
// если спрятать .topbar ради скриншота — ход перестанет нажиматься; первая
// кнопка финальной модалки начинает НОВУЮ партию, поэтому разорившийся прогон
// молча стартует заново; язык переключается ключом game-lang в localStorage.
import { readdirSync } from 'node:fs';
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const ROOT = process.env.AUDIT_ROOT ?? 'http://127.0.0.1:8899/games';

// Имя сборки берём с диска, а не вписываем сюда: вписанное однажды устаревает
// при первом же поднятии версии, и аудит начинает добросовестно проверять
// страницу 404 — она не переполняется, не показывает сырых ключей и молча
// получает «чисто». На этом уже обожглись: три игры из четырёх проверялись
// вхолостую целый релиз.
const dist = (dir) => {
  const path = new URL(`../../games/${dir}/dist`, import.meta.url).pathname;
  const files = readdirSync(path).filter((f) => f.endsWith('.html'));
  if (files.length !== 1) throw new Error(`${dir}/dist: ожидали одну сборку, нашли ${files.length}`);
  return `${ROOT}/${dir}/dist/${files[0]}`;
};

const GAMES = [
  { name: 'НОВОЕДА', url: dist('foodtech'), turns: 14,
    warm: async (page) => {
      for (const id of ['center', 'sever', 'zarechie']) {
        await page.locator(`#districts [data-id="${id}"]`).first().click({ timeout: 400 }).catch(() => {});
      }
      await page.evaluate(() => {
        for (const [k, v] of [['targetCouriers', 600], ['marketing', 900000], ['sales', 400000], ['courierPay', 190]]) {
          const el = document.getElementById(`in-${k}`);
          if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      });
    } },
  { name: 'КИНОРЕКА', url: dist('cinema'), turns: 14, warm: async () => {} },
  { name: 'БИЛЕТВИЛЬ', url: dist('tickets'), turns: 14,
    warm: async (page) => {
      for (const id of ['club', 'theatre']) {
        await page.locator(`[data-platform="${id}"]`).first().click({ timeout: 400 }).catch(() => {});
      }
    } },
  { name: 'НОВОГРАД', url: dist('ecosystem'), turns: 14,
    warm: async (page) => {
      await page.locator('[data-vertical="taxi"]').first().click({ timeout: 400 }).catch(() => {});
    } },
];
const problems = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// Сначала МОДУЛЬНАЯ версия каждой игры — именно она открывается по ссылке
// с главной страницы сайта (games/<игра>/index.html грузит src/main.js).
// Однофайловая сборка её не заменяет: сборщик переписывает импорты и уже
// скрывал живую поломку — dist собирался и играл, а модульная страница
// умирала молча. Проверка дешёвая: страница должна загрузиться, показать
// текст и кнопку хода, и не выругаться в консоль.
for (const dir of ['foodtech', 'cinema', 'tickets', 'ecosystem']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/lbEndpoint|Failed to fetch|net::|favicon|metrika|mc\.yandex/.test(m.text())) errs.push(m.text());
  });
  await page.goto(`${ROOT}/${dir}/index.html`).catch(() => {});
  await page.waitForTimeout(900);
  const len = await page.evaluate(() => document.body.innerText.trim().length).catch(() => 0);
  const btn = await page.locator('#btn-next').count().catch(() => 0);
  const where = `${dir} · модульная версия`;
  if (errs.length) problems.push(`${where}: ошибки — ${errs.slice(0, 2).join(' | ')}`);
  if (len < 200) problems.push(`${where}: страница пустая (${len} символов текста)`);
  if (!btn) problems.push(`${where}: нет кнопки хода — игра не собралась`);
  await ctx.close();
}
console.log('модульные версии: проверены');

for (const g of GAMES) {
  for (const lang of ['ru', 'en']) {
    for (const [tag, w, h] of [['широкий', 1440, 900], ['телефон', 390, 844]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/lbEndpoint|Failed to fetch|net::|favicon/.test(m.text())) errs.push(m.text());
      });
      const where = `${g.name} · ${lang} · ${tag}`;
      await page.goto(g.url);
      await page.evaluate((l) => localStorage.setItem('game-lang', l), lang);
      await page.reload();
      await page.waitForTimeout(350);
      // Первый экран закрывается кнопкой «Начать», а не нижним рядом: там
      // стоит «Подробнее», и она открывает справку, из которой возвращаются
      // обратно на первый экран. Прежний сценарий жал нижнюю кнопку трижды и
      // ходил по кругу welcome → справка → welcome: партия не начиналась, а
      // аудит списывал это на «пустые панели» в графике.
      for (let k = 0; k < 4; k++) {
        const start = page.locator('#welcome-start');
        if (await start.count()) { await start.click({ timeout: 500 }).catch(() => {}); await page.waitForTimeout(80); continue; }
        const btn = page.locator('#modal-root [data-act="0"]').first();
        if (!(await btn.count())) break;
        await btn.click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(80);
      }
      await g.warm(page);
      for (let i = 0; i < g.turns; i++) {
        const inline = page.locator('#event-slot .event-option').first();
        if (await inline.count()) await inline.click({ timeout: 250 }).catch(() => {});
        await page.locator('#btn-next').click({ timeout: 600 }).catch(() => {});
        await page.waitForTimeout(60);
        const modal = page.locator('#modal-root [data-act="0"]').first();
        if (await modal.count()) await modal.click({ timeout: 250 }).catch(() => {});
      }
      await page.waitForTimeout(250);

      // 1. Горизонтальное переполнение страницы
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(`${where}: страница шире экрана на ${overflow}px`);

      // 2. Незаполненные подстановки и сырые ключи
      const text = await page.evaluate(() => document.body.innerText);
      const holes = text.match(/\{[a-zA-Z]+\}/g);
      if (holes) problems.push(`${where}: незаполненные подстановки ${[...new Set(holes)].join(' ')}`);
      const rawKeys = text.match(/\b(map|flow|hall|district|lever|event|board)[A-Z][a-zA-Z]{3,}\b/g);
      if (rawKeys) problems.push(`${where}: сырые ключи строк ${[...new Set(rawKeys)].slice(0, 5).join(' ')}`);

      // 3. Кириллица в английской версии (кроме имён собственных игр)
      if (lang === 'en') {
        const cyr = text.split('\n').filter((l) => /[а-яё]/i.test(l)
          && !/НОВОЕДА|КИНОРЕКА|БИЛЕТВИЛЬ|НОВОГРАД/.test(l));
        if (cyr.length) problems.push(`${where}: непереведённые строки — ${cyr.slice(0, 3).map((x) => x.slice(0, 40)).join(' | ')}`);
      }

      // 4. Пустые панели
      const empty = await page.evaluate(() => Array.from(document.querySelectorAll('.panel'))
        .filter((p) => p.innerText.trim().length < 12)
        .map((p) => (p.querySelector('.panel-title')?.innerText ?? p.id ?? '?')));
      if (empty.length) problems.push(`${where}: пустые панели — ${empty.join(', ')}`);

      // 5. Мелкие цели нажатия на телефоне
      if (tag === 'телефон') {
        const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, .district, .event-option, [data-vertical], [data-platform]'))
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 28; })
          .map((el) => `${el.tagName}.${el.className}`.slice(0, 40)).slice(0, 4));
        if (small.length) problems.push(`${where}: цели нажатия мельче 28px — ${small.join(', ')}`);
      }

      // 6. Ошибки в консоли
      if (errs.length) problems.push(`${where}: ошибки — ${errs.slice(0, 2).join(' | ')}`);
      await ctx.close();
    }
  }
  console.log(`${g.name}: проверен`);
}
await b.close();
console.log('\n=== НАЙДЕНО ===');
if (!problems.length) console.log('чисто');
for (const p of problems) console.log('•', p);
