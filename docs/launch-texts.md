# Лонч-тексты: Show HN, itch.io, Хабр

Рабочий документ, на сайт не публикуется. Три готовых текста для трёх
площадок + список сообществ второй волны. Все ссылки — на витрину; для
Show HN и itch.io язык по умолчанию английский, это уже так работает
(язык выбирается по браузеру, `?lang=` фиксирует его в ссылке).

---

## 1. Show HN (Hacker News)

Правила HN: заголовок без маркетинга, первый комментарий — от автора, с
техническими деталями и честными ограничениями. Постить утром по будням
(14:00–16:00 UTC), отвечать на комментарии первые 3–4 часа.

**Title:**

> Show HN: Four business simulators where every number on screen is explainable

**URL:** `https://ruben-deev.github.io/economics-simulators/?lang=en`

**Первый комментарий (от автора):**

> I built four browser business sims — food delivery, a streaming service,
> a ticketing marketplace, and an "ecosystem" endgame that merges them.
> They started as teaching tools for unit economics, so the design rule was:
> no black boxes. Every number on screen can be traced — each turn has a
> factor-by-factor breakdown, a unit-economics table, a P&L, and the full
> formula write-ups are published next to the games.
>
> Some things that might be technically interesting:
>
> - Vanilla JS, no framework, no build deps. Each game also ships as a
>   single self-contained HTML file that runs from a USB stick.
> - Deterministic worlds: a game code (seed) reproduces the exact same
>   city — weather, events, rival moves — so a classroom can play one city
>   and compare honestly. There is a weekly challenge code on the index.
> - The balance is measured, not hand-tuned: reference strategies replay
>   hundreds of runs, and goal bars sit where the better half of strategies
>   clears them. The measurement notes are in the docs.
> - Result strings are signed with a checksum, so the world leaderboard
>   (a Google Apps Script over a spreadsheet) can reject doctored scores.
> - Compatibility floor is Safari 14.1/Chrome 90, enforced by a test that
>   scans the built files for newer APIs.
>
> Models are simplified on purpose (the docs list what each game leaves
> out), and the numbers are notional — it teaches mechanisms, not
> valuations. Russian and English, free, no accounts, no ads.
>
> Happy to answer anything about the economics models or the balancing
> process.

---

## 2. itch.io

Создать одну страницу на все четыре игры (проект типа «HTML playable in
browser» → вариант «внешняя ссылка» или залить dist-файлы как webgame).
Рекомендация: страница-хаб со ссылкой на сайт + четыре скриншота.

**Название:** Novograd Business Simulators

**Короткое описание (tagline):**

> Can you build a profitable business? The city doubts it. Four honest
> business sims: food delivery, streaming, ticketing — and the ecosystem
> endgame.

**Описание страницы:**

> Four turn-based business simulators built as teaching tools for real unit
> economics. No black boxes: every number on screen has a factor-by-factor
> explanation, a unit-economics table and a P&L behind it.
>
> **🛵 NOVOEDA — food delivery.** Demand vs throughput. Above 90%
> utilisation delivery time explodes and the customer base starts eating
> itself. Weather hits from both sides.
>
> **🎬 KINOREKA — streaming.** A market war against a living rival.
> Engagement is your best loyalty signal — and your biggest variable cost.
>
> **🎟️ BILETVILLE — ticketing.** A two-sided market: billions pass through
> you, percentages become yours. Resellers pad the turnover and drain the
> reputation.
>
> **🏙️ NOVOGRAD — the ecosystem endgame.** Merge your winning businesses
> into one holding: cross-sell vs cold marketing, a subscription that glues
> verticals, an antitrust case when you get too big.
>
> Deterministic worlds (one game code = one identical city for the whole
> group), a world leaderboard with signed result strings, a weekly
> challenge, three difficulty levels, English and Russian. Free, no
> accounts, runs in any browser since 2021 — or install it on your phone
> and play offline.
>
> The full formula write-ups and classroom lesson plans are published with
> the games. And yes, the series has a secret ending. That is all we are
> going to say. 📎

**Метаданные:** Genre: Simulation · Tags: economy, management,
business-simulation, tycoon, educational, browser, free · Pricing: free /
donations off (лицензия NC) · Classification: Games → Simulation.

---

## 3. Хабр (статья)

Формат: «как это устроено», а не анонс. Хаб: «Разработка игр»,
«Математика», «Учебный процесс в IT». Заголовок-кандидаты:

1. «Симулятор бизнеса, в котором каждую цифру можно объяснить: как я
   балансировал экономику замерами, а не интуицией»
2. «Цель, которую берут все, ничему не учит: как ставить планки в
   экономической игре»

**Скелет статьи (по существующим материалам, писать ~15 минут чтения):**

1. **Зачем.** Учебный тренажёр юнит-экономики: не выиграть, а увидеть,
   почему решения ведут к последствиям. Четыре игры = четыре типа
   экономики (выручка растёт с активностью / фиксирована при растущем
   расходе / проценты с чужого оборота / сумма частей холдинга).
2. **Правило «никаких чёрных ящиков».** Разбор хода по факторам, таблица
   юнит-экономики, P&L, опубликованные формулы. Пример: формула спроса
   НОВОЕДЫ с эластичностями по районам — и как студент её проверяет прямо
   в игре.
3. **Главная часть: баланс замерами.** Методология из measure.js своими
   словами: политики вместо ручной игры, 24 фиксированных кода, медианы
   вместо средних, банкротство = 0. История про то, как 8 кодов дали три
   несуществующих вывода. Планка цели = «берёт лучшая половина, не берёт
   середина»; цель года 2 КИНОРЕКИ, которую пришлось менять местами с
   годом 3, — живой пример.
4. **Детерминированный мир и класс.** Один код — один город; строка
   результата с контрольной суммой; мировая таблица на Apps Script
   (5 минут на развёртку, файл — в репозитории).
5. **Совместимость как фича.** Safari 14.1 как планка, тест, сканирующий
   собранные файлы на новые API; почему single-file dist и почему
   мессенджеры показывают HTML без JS.
6. **Что не получилось / что дальше.** Честно: условные числа, чего в
   моделях нет, открытые вопросы баланса.
7. **Финал.** Ссылка, челлендж недели, приглашение преподавателям (пакет
   одним архивом). Без просьб про апвоты.

---

## 4. Вторая волна: сообщества

* **Reddit:** r/tycoon, r/incremental_games (это не инкременталка — но
  аудитория своя, честно пометить), r/WebGames, r/basegame. Формат — как
  Show HN: история + честные детали, не ссылка в лоб.
* **Преподавательские:** сообщества преподавателей экономики и бизнеса
  (Facebook/Telegram-группы, «Экономика в школе»), рассылка коллегам с
  пакетом преподавателя. Это самый конверсионный канал: один преподаватель
  = поток студентов каждый семестр.
* **Продуктовые чаты и каналы** (RU): те, где обсуждают юнит-экономику и
  маркетплейсы, — формат «пост-разбор» из docs/promo-posts.md без ссылки в
  первом сообщении.
* **lichess-эффект:** предложить игры паре авторов YouTube/Telegram,
  которые разбирают бизнес-кейсы, как готовый интерактив к их формату.

Ритм: Show HN и Хабр не в один день (перекрёстный трафик размывает
обсуждение). Сначала Хабр (RU-ядро уже есть), через неделю Show HN,
itch.io — в любой момент, он работает как долгий хвост.
