# Лонч-тексты: Show HN, itch.io, Хабр

Рабочий документ, на сайт не публикуется.

Про технические детали — сознательное решение по площадкам. На Hacker News
принято, что автор в первом комментарии рассказывает «как оно устроено
внутри», — туда за этим и приходят, и без этого пост тонет. Поэтому в HN-версии
пара технических штрихов оставлена, но без хвастовства и почти без цифр.
Везде в остальном — никакой техники: история и приглашение поиграть.

---

## 1. Show HN (Hacker News)

Постить утром по будням (14:00–16:00 UTC), первые 3–4 часа отвечать на
комментарии — обсуждение и есть пост.

**Title:**

> Show HN: I built four business sims where going bankrupt actually teaches you something

**URL:** `https://ruben-deev.github.io/economics-simulators/?lang=en`

**Первый комментарий (от автора):**

> I teach unit economics on the side, and at some point I got tired of
> slides. Nobody remembers a slide about courier utilisation. Everybody
> remembers the week their delivery service collapsed because they saved
> a little money on courier pay right before a storm.
>
> So I built four browser sims: food delivery, a streaming service, a
> ticketing marketplace, and an endgame where your winning business
> becomes the seed of a city-wide ecosystem. Each one models a genuinely
> different kind of economics — in delivery, revenue grows with customer
> activity; in streaming, revenue is flat while your most loyal viewer
> quietly becomes your biggest cost; in ticketing, billions flow through
> you and you live on the percentages.
>
> The design rule was "no black boxes": every number on screen can be
> traced, each turn has a factor-by-factor breakdown, and the full formula
> write-ups are published next to the games. If the game claims your
> promo burned money, it can show you exactly where.
>
> A few details HN might enjoy: it's vanilla JS with no dependencies, each
> game also ships as a single self-contained HTML file that runs from a
> USB stick, and worlds are deterministic — one shared game code gives a
> whole classroom the same city, same weather, same rival, so the results
> are actually comparable. The leaderboard accepts results as signed
> strings, because students are students.
>
> Free, no accounts, English and Russian. The models are deliberately
> simplified and the docs are honest about what each one leaves out.
> Happy to talk about the economics — or about the balancing, which ate
> more time than the games themselves.

---

## 2. itch.io

Одна страница-хаб на все четыре игры (внешняя ссылка на сайт + четыре
скриншота, лучше вертикальных).

**Название:** Novograd Business Simulators

**Tagline:**

> Can you build a profitable business? The city doubts it.

**Описание страницы:**

> Four turn-based business sims set in one fictional city — built by
> someone who teaches unit economics and got tired of slides.
>
> **🛵 NOVOEDA — food delivery.** A storm is the best thing that can
> happen to you: everyone wants dumplings, nobody wants to leave home.
> Unfortunately, that includes your couriers.
>
> **🎬 KINOREKA — streaming.** Your most loyal subscriber pays the same
> as everyone else and watches like there's no tomorrow — at your
> expense. The ideal customer paid in January and left for the summer.
> Also, there's a rival, and he's not asleep.
>
> **🎟️ BILETVILLE — ticketing.** Billions pass through your service.
> None of them are yours. You live on percentages, and the bank collects
> its share from every ticket before you do.
>
> **🏙️ NOVOGRAD — the ecosystem.** Take a business you've won and turn
> it into an empire: taxi, e-commerce, one subscription to rule them all.
> Learn why the food app keeps offering you scooters, and what an
> antitrust case feels like from the inside.
>
> Every number on screen can be explained — the games were built as
> teaching tools, so they never say "you lost", they say "here is
> exactly what killed you". There's a weekly challenge where everyone
> plays the same city, a world leaderboard, and a hidden ending we are
> not going to talk about. 📎
>
> Free, no accounts, runs in any browser — or install it on your phone
> and play offline. English and Russian.

**Метаданные:** Genre: Simulation · Tags: economy, management,
business-simulation, tycoon, educational, browser, free · Pricing: free.

---

## 3. Хабр (статья)

Формат «как это устроено», но через историю, а не через спецификацию.
Хабы: «Разработка игр», «Учебный процесс в IT». Заголовки-кандидаты:

1. «Никто не запоминает слайд про юнит-экономику. Все запоминают неделю,
   когда их доставка утонула»
2. «Я сделал четыре бизнес-симулятора, чтобы студенты разорялись с пользой»

**Скелет статьи (~15 минут чтения):**

1. **Завязка.** Слайды про юнит-экономику не работают: студент кивает и
   забывает. Работает личное банкротство — желательно безопасное. Так
   появилась доставка еды с одним честным конфликтом: курьеров мало —
   клиенты уходят, курьеров много — платишь за простой.
2. **Правило «никаких чёрных ящиков».** Игра не имеет права говорить
   «вы проиграли» без объяснения. Разбор хода по факторам, таблица
   юнит-экономики, опубликованные формулы. Пример с промо, которое
   «покупает» убыточные заказы, — и как игрок сам это обнаруживает.
3. **Почему игр стало четыре.** Одни и те же слова — «рост»,
   «удержание», «вовлечённость» — в разных типах бизнеса означают
   противоположные вещи. Лояльный зритель стриминга как статья расходов;
   миллиарды, которые проезжают через билетный сервис транзитом.
   Экосистема как финал: всё выученное сталкивается лбами.
4. **Самая честная часть: баланс.** Как балансировать экономику, если
   «поиграл — вроде нормально» не аргумент. Стратегии-роботы, десятки
   прогонов, медианы вместо средних. История о том, как маленькая
   выборка однажды породила три красивых вывода, которые пришлось
   отменять. И правило для целей: планка, которую берут все, учит тому
   же, чему планка, которую не берёт никто, — ничему.
5. **Класс как мультиплеер без сервера.** Один код партии — один город
   на всю группу: одна погода, один конкурент, честное сравнение.
   Строка результата с контрольной суммой — потому что студенты
   изобретательны.
6. **Что не получилось и что вырезано.** Честный список упрощений — и
   почему для учебной модели упрощение не баг.
7. **Финал.** Ссылка, челлендж недели, пакет для преподавателей. Без
   просьб про апвоты и колокольчик.

---

## 4. Вторая волна: сообщества

* **Reddit:** r/tycoon, r/WebGames, r/incremental_games (честно пометить,
  что это не инкременталка — но аудитория пересекается). Формат тот же:
  история, не ссылка в лоб.
* **Преподаватели** — самый конверсионный канал: один преподаватель — это
  поток студентов каждый семестр. Сообщества преподавателей экономики,
  личная рассылка коллегам с пакетом преподавателя.
* **Продуктовые каналы и чаты (RU)** — туда идут посты-разборы из
  `docs/promo-posts.md`, по одному, без залпов.
* **Авторы разборов бизнес-кейсов** (YouTube/Telegram) — предложить игры
  как готовый интерактив к их формату: «а теперь попробуйте сами».

Ритм: сначала Хабр (русское ядро уже есть), через неделю Show HN, itch.io —
когда угодно, это длинный хвост. Хабр и HN не в один день: перекрёстный
трафик размывает оба обсуждения.
