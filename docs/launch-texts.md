# Лонч-тексты: Show HN, itch.io, Хабр

Рабочий документ, на сайт не публикуется.

Про технические детали — сознательное решение по площадкам. На Hacker News
принято, что автор в первом комментарии рассказывает «как оно устроено
внутри», — туда за этим и приходят, и без этого пост тонет. Поэтому в HN-версии
пара технических штрихов оставлена, но без хвастовства и почти без цифр.
Везде в остальном — никакой техники: история и приглашение поиграть.

Про имена компаний — сознательное решение: в текстах по умолчанию названы
индустрии, а не работодатели (вы действующий финдир, а игры шутят про
стриминг, билеты и антимонопольные дела). Где имя усилило бы текст, рядом
в [квадратных скобках] лежит именованный вариант — включать или нет,
решаете вы. Сумма P&L нигде не используется.

---

## 1. Show HN (Hacker News)

Постить утром по будням (14:00–16:00 UTC), первые 3–4 часа отвечать на
комментарии — обсуждение и есть пост.

**Title** (два варианта — первый с личной историей обычно живёт лучше):

> Show HN: I'm a finance exec who never coded. I built four business sims, starting on a plane

> Show HN: I built four business sims where going bankrupt actually teaches you something

**URL:** `https://ruben-deev.github.io/economics-simulators/?lang=en`

**Первый комментарий (от автора):**

> These games are, almost literally, my CV. I spent years running
> strategy and analytics for a quick-commerce grocery delivery, and
> today I'm the finance director of a streaming service and a ticketing
> business. I had never written a line of code in my life.
>
> A few months ago, on a long flight, I wanted to refresh how delivery
> economics actually works — the queues, the storms, the courier
> churn — so instead of opening a spreadsheet I opened an AI coding
> assistant. Three hours later there was a playable prototype. I still
> find it hard to believe this is something a person with zero
> programming experience can now do on a plane.
>
> Then it pulled me in: half-hour sessions before bed, instead of
> doomscrolling — and one game became four: food delivery, a streaming
> service, a ticketing marketplace, and an endgame where your winning
> business becomes the seed of a city-wide ecosystem. Each models a
> genuinely different kind of economics I've had to live with — in
> delivery, revenue grows with customer activity; in streaming, revenue
> is flat while your most loyal viewer quietly becomes your biggest
> cost; in ticketing, billions flow through you and you live on the
> percentages.
>
> The design rule came straight from an occupational habit: I've spent
> my career hunting doctored denominators in other people's metrics, so
> here there are no black boxes. Every number on screen can be traced,
> each turn has a factor-by-factor breakdown, and the full formula
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
> Happy to talk about the economics, the balancing (which ate more time
> than the games themselves) — or what building software as a
> first-timer with AI tools felt like from the finance side of the desk.

---

## 2. itch.io

Одна страница-хаб на все четыре игры (внешняя ссылка на сайт + четыре
скриншота, лучше вертикальных).

**Название:** Novograd Business Simulators

**Tagline:**

> Can you build a profitable business? The city doubts it.

**Описание страницы:**

> Four turn-based business sims set in one fictional city — built by a
> finance director who has actually run these businesses (delivery,
> streaming, ticketing) and had never written a line of code. The first
> prototype happened in three hours on a plane; the rest happened in
> half-hour evening sessions that used to be doomscrolling.
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
Хабы: «Разработка игр», «Игры и игровые консоли», можно «Карьера».
Заголовки-кандидаты:

1. «Я управлял экономикой доставки, стриминга и билетов. Потом собрал их
   в четыре игры — не умея программировать»
2. «Я финансовый директор и никогда не программировал. Первый симулятор
   собрал за три часа в самолёте»

**Скелет статьи (~15 минут чтения):**

1. **Завязка — личная.** Эти четыре игры — почти буквально резюме:
   несколько лет стратегии и аналитики в экспресс-доставке продуктов
   [вариант с именем: в Яндекс Лавке], сейчас — финансовый директор
   в стриминге и билетном бизнесе. Плюс FMCG и автопром до этого,
   физтех — и ни строчки кода за всю жизнь. В длинном перелёте
   захотелось вспомнить, как на самом деле устроена экономика
   доставки, — открыл AI-ассистент, и через три часа был играбельный
   прототип. Честное удивление как двигатель текста: то, что раньше
   требовало команды и месяцев, человек без опыта теперь делает
   в самолёте. Дальше — по полчаса перед сном вместо скроллинга,
   и одна игра превратилась в четыре: каждая про бизнес, чью экономику
   я считал руками.
1а. **Почему симулятор, а не конспект.** Слайды про юнит-экономику не
   работают: читатель кивает и забывает. Работает личное банкротство —
   желательно безопасное. Так появилась доставка еды с одним честным
   конфликтом: курьеров мало — клиенты уходят, курьеров много — платишь
   за простой.
2. **Правило «никаких чёрных ящиков».** Профдеформация: всю карьеру
   ищу подкрученные знаменатели в чужих метриках и финмоделях — поэтому
   собственная игра не имеет права говорить «вы проиграли», не показав,
   из чего это число собрано. Разбор хода по факторам, таблица
   юнит-экономики, опубликованные формулы. Пример с промо, которое
   «покупает» убыточные заказы, — и как игрок сам это обнаруживает.
3. **Почему игр стало четыре.** Потому что карьера подсказала
   продолжение: доставку я считал в прошлой роли, стриминг и билеты
   считаю в нынешней. Одни и те же слова — «рост», «удержание»,
   «вовлечённость» — в этих бизнесах означают противоположные вещи. Лояльный зритель стриминга как статья расходов;
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
7. **Финал.** Возврат к личной линии: самое ценное, что дал проект, —
   не игры, а обнаруженная возможность строить руками то, что раньше
   только считал в таблицах. Ссылка, челлендж недели, пакет для
   преподавателей. Без просьб про апвоты и колокольчик.

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
