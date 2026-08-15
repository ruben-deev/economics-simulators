// ============================================================================
// Строки интерфейса игры «НОВОГРАД». Пары { ru, en }.
// Регистрируются в ядре локализации вызовом setStrings() при старте.
// ============================================================================

export const STRINGS = {
  // --- шапка ---
  brandTitle: { ru: 'НОВОГРАД', en: 'NOVOGRAD' },
  brandSub: { ru: 'симулятор экосистемы · финал серии', en: 'ecosystem simulator · the finale of the series' },
  btnRestart: { ru: 'Заново', en: 'Restart' },
  btnHelpTitle: { ru: 'Как играть', en: 'How to play' },
  btnNext: { ru: 'Прожить месяц {month} →', en: 'Run month {month} →' },
  btnResults: { ru: 'Итоги партии', en: 'Final results' },
  btnHome: { ru: 'Игры', en: 'Games' },
  btnHomeTitle: { ru: 'Ко всем играм набора', en: 'All games of the set' },
  langToggle: { ru: 'EN', en: 'RU' },
  langTitle: { ru: 'Switch to English', en: 'Переключить на русский' },

  // --- KPI ---
  kpiMonth: { ru: 'Месяц', en: 'Month' },
  kpiMonthEvent: { ru: '⚡ событие', en: '⚡ event' },
  kpiMonthCity: { ru: 'холдинг «Новоград»', en: 'Novograd holding' },
  kpiCash: { ru: 'Касса', en: 'Cash' },
  kpiCashOut: { ru: 'деньги кончились', en: 'out of money' },
  kpiRunway: { ru: 'хватит на {months} мес.', en: '{months} months of runway' },
  kpiProfitable: { ru: 'операционно прибыльны', en: 'operationally profitable' },
  kpiUnique: { ru: 'Клиенты холдинга', en: 'Holding customers' },
  kpiUniqueSub: { ru: 'уникальных людей', en: 'unique people' },
  kpiArpu: { ru: 'ARPU холдинга', en: 'Holding ARPU' },
  kpiArpuSub: { ru: '₽ с клиента в месяц', en: '₽ per customer per month' },
  kpiProfit: { ru: 'Прибыль / мес', en: 'Profit / mo' },
  kpiProfitSub: { ru: 'вклад {value}', en: 'contribution {value}' },
  kpiMulti: { ru: 'Два и более сервисов', en: 'Two or more services' },
  kpiMultiSub: { ru: '{value} человек', en: '{value} people' },
  kpiEquity: { ru: 'Оценка × доля', en: 'Valuation × stake' },
  kpiEquitySub: { ru: 'ваша доля {value}', en: 'your stake {value}' },
  kpiStart: { ru: 'Старт', en: 'Start' },
  kpiStartSub: { ru: 'казна победителя рынка', en: 'the market winner’s treasury' },

  // --- панели ---
  panelLevers: { ru: 'Рычаги холдинга', en: 'Holding levers' },
  panelVerticals: { ru: 'Вертикали', en: 'Verticals' },
  panelBoard: { ru: 'Совет директоров', en: 'Board of directors' },
  panelFunding: { ru: 'Финансирование', en: 'Funding' },
  panelDynamics: { ru: 'Динамика', en: 'Trends' },
  leverWhy: { ru: 'зачем это?', en: 'why does this matter?' },
  leverGroupLockedTaxi: {
    ru: 'Рычаги такси появятся после запуска вертикали — карточка «Такси» в панели «Вертикали».',
    en: 'Taxi levers appear once the vertical is launched — see the Taxi card in the Verticals panel.',
  },
  leverGroupLockedEcom: {
    ru: 'Рычаги е-кома появятся после запуска вертикали. Совет согласует третью ногу с 8-го месяца при прибыльном стартовом активе.',
    en: 'E-commerce levers appear once the vertical is launched. The board approves a third leg from month 8, with the starting asset profitable.',
  },

  // --- живые сводки групп рычагов ---
  readoutFood: {
    ru: 'Отток ~<b>{lost}</b> клиентов/мес, приток (возврат + органика + кросс-селл) ~<b class="{cls}">{gained}</b>.',
    en: 'Churn ~<b>{lost}</b> customers/mo; inflow (win-back + organic + cross-sell) ~<b class="{cls}">{gained}</b>.',
  },
  readoutFoodPool: {
    ru: 'Пул возврата: {pool} недавно ушедших — только их и можно вернуть маркетингом.',
    en: 'Win-back pool: {pool} recent leavers — marketing can bring back only them.',
  },
  readoutFoodExodus: {
    ru: 'Монетизация за порогом: клиенты уходят к конкуренту ускоренно.',
    en: 'Monetisation past the threshold: customers are fleeing to the competitor.',
  },
  readoutTaxi: {
    ru: 'Парк: <b>{drivers}</b> водителей → мощность <b>{capacity}</b> поездок/мес; бюджет доведёт ~{hires} новых водителей.',
    en: 'Fleet: <b>{drivers}</b> drivers → capacity <b>{capacity}</b> trips/mo; the budget onboards ~{hires} new drivers.',
  },
  readoutTaxiDemand: {
    ru: 'Спрос прошлого месяца: {demand} поездок → загрузка парка <b class="{cls}">{util}</b>.',
    en: 'Last month’s demand: {demand} trips → fleet utilisation <b class="{cls}">{util}</b>.',
  },
  readoutTaxiWar: {
    ru: 'Идёт война с «Таксоградом»: приток урезан, цены продавлены (ещё {months} мес.).',
    en: 'The Taxograd war is on: intake cut, fares pushed down ({months} months left).',
  },
  readoutFocus: {
    ru: 'Штраф фокуса к исполнению всех вертикалей: <b class="{cls}">−{penalty}</b>.',
    en: 'Focus penalty on every vertical’s execution: <b class="{cls}">−{penalty}</b>.',
  },
  readoutFocusSingle: {
    ru: 'Пока вертикаль одна, фокус не размыт — управляющая компания почти не нужна.',
    en: 'With a single vertical focus is undiluted — you barely need the management company.',
  },
  readoutCross: {
    ru: 'Кросс-селл в прошлом месяце привёл <b>{conv}</b> клиентов.{wasted}',
    en: 'Cross-sell brought <b>{conv}</b> customers last month.{wasted}',
  },
  readoutCrossWasted: {
    ru: ' Сгорело о ёмкость канала: {wasted}.',
    en: ' Burned against the channel’s capacity: {wasted}.',
  },
  readoutEcom: {
    ru: 'Е-ком: <b>{users}</b> клиентов; отток ~{lost}/мес против притока ~<b class="{cls}">{gained}</b>.',
    en: 'E-commerce: <b>{users}</b> customers; churn ~{lost}/mo against ~<b class="{cls}">{gained}</b> arriving.',
  },
  readoutEcomCapacity: { ru: 'Мощность логистики: <b class="{cls}">{level}</b> от предела — от неё зависят чек, отток и готовность базы пробовать посылки.', en: 'Logistics capacity: <b class="{cls}">{level}</b> of the ceiling — it drives basket size, churn and the base’s readiness to try parcels.' },
  readoutEcomUnit: { ru: 'Устойчивая экономика ноги: <b class="{cls}">{steady}</b> в месяц (вклад с клиентов минус фикс и ассортимент). Сверху вы платите за рост: {growth} на маркетинг и мощность.', en: 'The leg’s steady economics: <b class="{cls}">{steady}</b> a month (customer contribution less fixed costs and range). On top of that you pay for growth: {growth} on marketing and capacity.' },
  readoutEcomLogistics: {
    ru: 'Общая логистика: курьеры хаба возят посылки в непик — маржа выше, но пиковые конфликты стоят еде качества.',
    en: 'Shared logistics: the hub’s couriers carry parcels off-peak — higher margin, but peak conflicts cost food some quality.',
  },
  readoutPlus: {
    ru: 'Plus: <b>{subs}</b> подписчиков из {multi} мульти-клиентов — подписка усиливает удержание всех сервисов.',
    en: 'Plus: <b>{subs}</b> subscribers out of {multi} multi-service customers — the subscription hardens retention everywhere.',
  },

  // --- бюджетная полоса ---
  budgetTitle: { ru: 'Расходы месяца при текущих решениях: <b>{total}</b>', en: 'This month’s spend at current settings: <b>{total}</b>' },
  budgetFixed: { ru: 'фиксы и офис', en: 'fixed & HQ' },
  budgetFood: { ru: 'ядро', en: 'core' },
  budgetTaxi: { ru: 'такси', en: 'taxi' },
  budgetEcom: { ru: 'торговля', en: 'retail' },
  budgetEco: { ru: 'экосистема', en: 'ecosystem' },
  budgetNet: {
    ru: 'Вклад прошлого месяца {contribution} → прибыль примерно <b class="{cls}">{net}</b>.',
    en: 'Last month’s contribution {contribution} → profit roughly <b class="{cls}">{net}</b>.',
  },

  // --- карта экосистемы ---
  mapTitle: { ru: 'Карта экосистемы', en: 'Ecosystem map' },
  mapCity: { ru: 'Новоград · {adults} взрослых горожан', en: 'Novograd · {adults} adult residents' },
  mapFood: { ru: 'Еда', en: 'Food' },
  mapHub: { ru: 'Ядро', en: 'Core' },
  mapEcom: { ru: 'Торговля', en: 'Retail' },
  mapEcomOff: { ru: 'торговля не запущена', en: 'retail not launched' },
  mapPlus: { ru: 'Plus · {subs}', en: 'Plus · {subs}' },
  mapCrisis: { ru: 'спад · {months} мес.', en: 'downturn · {months} mo' },
  mapTaxi: { ru: 'Такси', en: 'Taxi' },
  mapTaxiOff: { ru: 'такси не запущено', en: 'taxi not launched' },
  mapBoth: { ru: 'оба сервиса', en: 'both services' },
  mapCross: { ru: 'кросс-селл', en: 'cross-sell' },
  mapCrossBack: { ru: 'кросс-селл', en: 'cross-sell' },
  mapCold: { ru: 'маркетинг', en: 'marketing' },
  mapWinback: { ru: 'возврат и органика', en: 'win-back & organic' },
  mapFed: { ru: 'набег федеральной экосистемы · {months} мес.', en: 'national ecosystem raid · {months} mo' },
  mapUnique: {
    ru: 'Уникальных клиентов холдинга: {unique} — {share} города. Круги — базы сервисов, их пересечение — люди в двух сервисах.',
    en: 'Unique holding customers: {unique} — {share} of the city. Circles are service bases; their overlap is people on both.',
  },
  mapCaption: {
    ru: 'Подписи — потоки клиентов за прошлый месяц: зелёное — пришли по кросс-селлу из общей базы, бирюзовое — приведены холодным маркетингом, синее — возврат и органика хаба, красное — ушли. Чем больше пересечение кругов, тем крепче экосистема.',
    en: 'Labels are last month’s customer flows: green joined via cross-sell from the shared base, teal was brought in by cold marketing, blue is the hub’s win-back and organic inflow, red left. The bigger the circle overlap, the stronger the ecosystem.',
  },

  // --- вертикали ---
  vertAsset: { ru: 'стартовый актив', en: 'starting asset' },
  vertAssetFrom: { ru: 'финал игры {game}', en: 'the endgame of {game}' },
  vertAssetStats: {
    ru: '{users} клиентов · ARPU {arpu} ₽/мес · маржа {margin}',
    en: '{users} customers · ARPU ₽{arpu}/mo · margin {margin}',
  },
  vertLive: { ru: 'работает', en: 'running' },
  vertLiveStats: {
    ru: '{users} клиентов · {drivers} водителей · подача {fill}',
    en: '{users} customers · {drivers} drivers · pickup fill {fill}',
  },
  vertLaunch: { ru: 'запустить за {cost}', en: 'launch for {cost}' },
  vertPlanned: { ru: 'заявка подана — ворота пока закрыты', en: 'requested — the gate is still closed' },
  vertLocked: {
    ru: 'ворота совета: с месяца {month} и при прибыльном стартовом активе ({n} мес подряд)',
    en: 'board gate: from month {month}, with the starting asset profitable ({n} months running)',
  },
  vertWar: { ru: '⚔️ война со «{name}»: ещё {months} мес.', en: '⚔️ war with {name}: {months} months left' },
  vertFixedNote: {
    ru: 'Запуск {cost} разово + {monthly}/мес фикса. «{incumbent}» ответит демпингом: {war} месяцев приток урезан и цены рынка продавлены.',
    en: 'Launch {cost} one-off + {monthly}/mo fixed. {incumbent} will answer with dumping: for {war} months your intake is cut and market fares are pushed down.',
  },
  vertFuture: { ru: 'следующая фаза', en: 'next phase' },
  vertLogistics: { ru: 'Ваша курьерская логистика: запуск дешевле на {discount}.', en: 'Your courier logistics: launch {discount} cheaper.' },
  vertEcomStats: { ru: '{users} клиентов · маржа {margin}', en: '{users} customers · margin {margin}' },
  plusName: { ru: 'Подписка «Новоград Plus»', en: 'Novograd Plus subscription' },
  plusHint: {
    ru: 'Склейка экосистемы: подписчик пользуется всеми сервисами чаще и уходит реже. Выгоды стоят маржи — это покупка удержания. Дилемма Amazon Prime.',
    en: 'The ecosystem’s glue: a subscriber uses every service more and churns less. The perks cost margin — you are buying retention. The Amazon Prime dilemma.',
  },
  plusStats: { ru: '{subs} подписчиков · {price} ₽/мес', en: '{subs} subscribers · ₽{price}/mo' },
  plusNeedsVerticals: { ru: 'нужна вторая вертикаль', en: 'needs a second vertical' },
  plusNeedsVerticalsToast: {
    ru: 'Подписке нужно, что склеивать: сначала запустите хотя бы одну вертикаль рядом с хабом.',
    en: 'The subscription needs something to glue: launch at least one vertical beside the hub first.',
  },
  partnerOwn: { ru: 'уже ваше', en: 'already yours' },
  partnerJoin: { ru: 'включить · {fee}', en: 'enable · {fee}' },
  partnerFree: { ru: 'бесплатно', en: 'free' },
  perMonth: { ru: '{value}/мес', en: '{value}/mo' },
  partnerCinema: { ru: 'Кино в подписке', en: 'Cinema in the subscription' },
  partnerCinemaHint: {
    ru: 'Лицензия стриминга в Plus: подписка конвертит лучше и держит крепче. Кино входит партнёрской вертикалью — микроменеджмент остался в КИНОРЕКЕ.',
    en: 'A streaming licence inside Plus: the subscription converts better and holds tighter. Cinema joins as a partner vertical — the micromanagement stayed in KINOREKA.',
  },
  partnerCinemaNeedsPlus: {
    ru: 'Лицензия кино живёт внутри подписки: сначала запустите «Новоград Plus».',
    en: 'The cinema licence lives inside the subscription: launch Novograd Plus first.',
  },
  partnerTickets: { ru: 'Партнёрство по билетам', en: 'Ticketing partnership' },
  partnerTicketsHint: {
    ru: 'Афиши и события для мульти-клиентов: событийная выручка и чуть крепче подписка. Билеты входят партнёрством — микроменеджмент остался в БИЛЕТВИЛЕ.',
    en: 'Listings and events for multi-service customers: event revenue and a slightly stickier subscription. Ticketing joins as a partnership — the micromanagement stayed in BILETVILLE.',
  },
  vertCloseHint: { ru: 'нажмите, чтобы закрыть вертикаль (клиенты и парк будут распущены)', en: 'click to shut the vertical down (customers and fleet are released)' },
  vertLockedToast: {
    ru: 'Совет пока не согласует запуск: нужен месяц {month} и прибыльный стартовый актив {n} месяца подряд. Заявка сохранена.',
    en: 'The board will not approve the launch yet: you need month {month} and the starting asset profitable for {n} straight months. The request is saved.',
  },

  // --- совет ---
  goalYear: { ru: 'Год {year}', en: 'Year {year}' },
  goalSecondLeg: {
    ru: 'Вторая нога: к концу года у такси должно быть не меньше {target} клиентов.',
    en: 'A second leg: the taxi vertical must have at least {target} customers by year end.',
  },
  goalGlue: {
    ru: 'Склейка экосистемы: {target} клиентов должны пользоваться двумя и более сервисами — и не ценой базы (минимум {floor} уникальных).',
    en: 'Ecosystem glue: {target} of customers must use two or more services — and not at the base’s expense (at least {floor} unique customers).',
  },
  goalProfit: {
    ru: 'Прибыльная экосистема, а не зоопарк: {target} прибыльных месяцев за год при базе не меньше {floor} человек.',
    en: 'A profitable ecosystem, not a zoo: {target} profitable months this year with the base at no less than {floor} people.',
  },
  goalNow: { ru: 'Сейчас: {value}', en: 'Now: {value}' },
  goalPassed: { ru: 'выполнена', en: 'met' },
  goalFailed: { ru: 'провалена', en: 'missed' },
  goalDone: { ru: 'Целей больше нет: год решающий, совет ждёт итогов партии.', en: 'No more goals: it is the final year, the board is waiting for the endgame.' },
  goalCapped: {
    ru: 'Совет урезал бюджеты привлечения до {cap} в месяц (до месяца {until}).',
    en: 'The board has capped every acquisition budget at {cap} a month (until month {until}).',
  },

  // --- финансирование ---
  fundingHead: {
    ru: 'Оценка холдинга: <b>{valuation}</b>. Ваша доля {equity}, привлечено {raised}.',
    en: 'Holding valuation: <b>{valuation}</b>. Your stake {equity}, raised so far {raised}.',
  },
  fundingRunway: { ru: 'При текущем темпе кассы хватит на {n} мес.', en: 'At the current burn the cash lasts {n} months.' },
  fundingDilution: { ru: 'размытие {dilution} → ваша доля {equity}', en: 'dilution {dilution} → your stake {equity}' },
  fundingTake: { ru: 'Взять', en: 'Raise' },
  fundingNote: {
    ru: 'Раунд — это продажа доли по сегодняшней оценке. Экспансия почти всегда требует чужих денег: вопрос лишь, по какой оценке вы их берёте.',
    en: 'A round sells a stake at today’s valuation. Expansion almost always takes outside money — the only question is the valuation you take it at.',
  },
  fundingLocked: { ru: 'Раунды открываются с месяца {month}.', en: 'Rounds open from month {month}.' },
  fundingDone: { ru: 'Раунд закрыт: +{amount} за {dilution} доли.', en: 'Round closed: +{amount} for {dilution} of equity.' },

  // --- событие ---
  eventAuto: { ru: 'Событие подействует само — решений не требует.', en: 'The event applies on its own — no decision required.' },
  eventLesson: { ru: 'Урок:', en: 'Lesson:' },
  eventChoiceNeeded: { ru: 'Сначала выберите, как ответить на событие месяца.', en: 'First choose your answer to this month’s event.' },

  // --- отчёт ---
  reportMonth0: { ru: 'Месяц 0 · перед первым ходом', en: 'Month 0 · before the first move' },
  reportStartTitle: { ru: 'Вы выиграли прошлую игру.', en: 'You won the previous game.' },
  reportStartIntro: {
    ru: 'Ваш стартовый актив — {asset} — выиграл свой рынок: Новоград насыщен, расти числом клиентов больше некуда. В казне {cash}, совет ждёт экосистему. Первый настоящий ход — куда идти дальше, и у каждого пути своя цена:',
    en: 'Your starting asset — {asset} — has won its market: Novograd is saturated and there is no one left to acquire. The treasury holds {cash}, and the board expects an ecosystem. The first real move is choosing where to go next — and every path has its price:',
  },
  forkLaunchTitle: { ru: 'Запустить такси сразу.', en: 'Launch taxi right away.' },
  forkLaunchBody: {
    ru: 'Разово {cost}, «Таксоград» ответит {war} месяцами демпинга, и первый год вертикаль будет убыточной. Зато время работает на вас: каждый месяц роста компаундится до конца партии.',
    en: 'A one-off {cost}; Taxograd answers with {war} months of dumping, and the vertical loses money in year one. But time works for you: every month of growth compounds to the end of the game.',
  },
  forkSaveTitle: { ru: 'Подкопить и зайти позже.', en: 'Save up and enter later.' },
  forkSaveBody: {
    ru: 'Меньше риска банкротства и раунды по лучшей оценке — но каждый месяц ожидания это минус месяцы роста такси, а совет к концу года ждёт вторую ногу.',
    en: 'Less bankruptcy risk and rounds at a better valuation — but every month of waiting costs taxi growth, and the board expects a second leg by year end.',
  },
  forkMilkTitle: { ru: 'Дожимать корову.', en: 'Milk the cow.' },
  forkMilkBody: {
    ru: 'Поднять монетизацию стартового актива: деньги сейчас и без чужих раундов. Цена — ускоренный отток базы, а база — это ещё и пул кросс-селла будущих вертикалей.',
    en: 'Raise the starting asset’s monetisation: money now, no outside rounds. The price is faster base churn — and that base is the future verticals’ cross-sell pool.',
  },
  forkFooter: {
    ru: 'Общая база клиентов — главный ресурс всех трёх путей: посмотрите её состав во вкладке «База» и следите за ARPU холдинга в шапке.',
    en: 'The shared customer base is the key resource of all three paths: see its make-up in the Base tab and watch holding ARPU in the header.',
  },
  reportTitle: { ru: 'Итоги месяца {month}', en: 'Month {month} results' },
  reportHeadStats: {
    ru: 'выручка {revenue} · хаб {food} · такси {taxi}',
    en: 'revenue {revenue} · hub {food} · taxi {taxi}',
  },
  reportDelta: {
    ru: 'К прошлому месяцу: выручка {revenue}, прибыль {profit}, касса {cash}.',
    en: 'Versus last month: revenue {revenue}, profit {profit}, cash {cash}.',
  },
  statRevenue: { ru: 'Выручка холдинга', en: 'Holding revenue' },
  statRevenueSub: { ru: 'хаб {food} · такси {taxi}', en: 'hub {food} · taxi {taxi}' },
  statProfit: { ru: 'Прибыль', en: 'Profit' },
  statProfitSub: { ru: 'вклад {contribution} − расходы {opex}', en: 'contribution {contribution} − opex {opex}' },
  statUnique: { ru: 'Клиенты холдинга', en: 'Holding customers' },
  statUniqueSub: { ru: 'хаб {food} · такси {taxi} · мульти {both}', en: 'hub {food} · taxi {taxi} · multi {both}' },
  statArpu: { ru: 'ARPU холдинга', en: 'Holding ARPU' },
  statArpuSub: { ru: 'выручка на уникального клиента', en: 'revenue per unique customer' },
  statTaxi: { ru: 'Такси', en: 'Taxi' },
  statTaxiSub: { ru: '{drivers} водителей · подача {fill}', en: '{drivers} drivers · pickup fill {fill}' },
  statTaxiOff: { ru: 'не запущено', en: 'not launched' },
  statEcom: { ru: 'Онлайн-торговля', en: 'Online retail' },
  statEcomSub: { ru: 'маржа {margin} с общей логистикой', en: 'margin {margin} with shared logistics' },
  statPlus: { ru: 'Подписчики Plus', en: 'Plus subscribers' },
  statPlusSub: { ru: '+{conv} / −{churned} за месяц', en: '+{conv} / −{churned} this month' },
  statCross: { ru: 'Кросс-селл за месяц', en: 'Cross-sell this month' },
  statCrossSub: { ru: 'клиент за {cac} против {cold} холодного', en: 'a customer for {cac} vs {cold} cold' },
  statCrossOff: { ru: 'канал не включён', en: 'channel not in use' },
  statMulti: { ru: 'Два и более сервисов', en: 'Two or more services' },
  statMultiSub: { ru: 'премия инвестора за склейку: +{premium}', en: 'the investor’s glue premium: +{premium}' },
  statFocus: { ru: 'Фокус менеджмента', en: 'Management focus' },
  statFocusSub: { ru: 'штраф к исполнению −{penalty}', en: 'execution penalty −{penalty}' },
  statFocusOk: { ru: 'исполнение не размыто', en: 'execution undiluted' },

  launchNote: {
    ru: 'Запущено такси: разовый платёж {cost}. «Таксоград» объявил войну — {months} месяцев демпинга.',
    en: 'Taxi launched: one-off cost {cost}. Taxograd declared war — {months} months of dumping.',
  },
  closeNote: {
    ru: 'Вертикаль такси закрыта: клиенты и парк распущены, фикс больше не платится.',
    en: 'The taxi vertical is shut down: customers and fleet released, the fixed cost is gone.',
  },

  driversTitle: { ru: 'Почему выручка изменилась на {delta}', en: 'Why revenue moved by {delta}' },
  driversNet: { ru: 'Итого', en: 'Net' },
  driverUnique: { ru: 'Клиенты холдинга', en: 'Holding customers' },
  driverArpu: { ru: 'ARPU (выручка с клиента)', en: 'ARPU (revenue per customer)' },
  driversFormula: {
    ru: 'Выручка = клиенты × ARPU. После насыщения первый множитель почти заморожен — партию решает второй.',
    en: 'Revenue = customers × ARPU. After saturation the first factor is nearly frozen — the second one decides the game.',
  },

  // --- предупреждения ---
  alertNoTaxi: {
    ru: 'Совет ждёт вторую ногу: цель первого года — {target} клиентов такси, а вертикаль ещё не запущена.',
    en: 'The board expects a second leg: the year-one goal is {target} taxi customers, and the vertical is not launched yet.',
  },
  alertWar: {
    ru: 'Война с «Таксоградом»: приток такси урезан и цены продавлены ещё {months} мес. Это конечно — но каждый месяц войны стоит денег.',
    en: 'The Taxograd war: taxi intake is cut and fares pushed down for {months} more months. It is finite — but every month of it costs money.',
  },
  alertNoDrivers: {
    ru: 'Водителей не хватает: подача выполняется на {fill}, клиенты уходят из-за долгого ожидания.',
    en: 'Not enough drivers: pickups are filled at {fill}, customers leave over the wait.',
  },
  alertIdleDrivers: {
    ru: 'Парк простаивает: загрузка водителя {util}. Водители без заработка уходят сами — мощность должна идти за спросом.',
    en: 'The fleet is idle: driver utilisation is {util}. Drivers without earnings quit on their own — capacity must follow demand.',
  },
  alertCrossWasted: {
    ru: 'Кросс-селл упёрся в ёмкость канала: {wasted} из бюджета сгорело. Пул соседней вертикали не бесконечен — лишний рубль здесь ничего не покупает.',
    en: 'Cross-sell hit the channel’s capacity: {wasted} of the budget burned. The neighbouring vertical’s pool is finite — an extra rouble buys nothing here.',
  },
  alertTakeExodus: {
    ru: 'Монетизация {take} — за порогом: клиенты хаба уходят к конкуренту ускоренно, и вместе с ними тает пул кросс-селла.',
    en: 'Monetisation at {take} is past the threshold: the hub’s customers are fleeing — and the cross-sell pool thins with them.',
  },
  alertFoodShrinking: {
    ru: 'База хаба сжимается: −{lost} против +{gained} за месяц. В насыщенном рынке вернуть клиента дороже, чем удержать.',
    en: 'The hub base is shrinking: −{lost} against +{gained} this month. In a saturated market re-acquiring costs more than retaining.',
  },
  alertWinbackDry: {
    ru: 'Пул возврата исчерпан: {wasted} бюджета возврата не нашли, кого возвращать.',
    en: 'The win-back pool is dry: {wasted} of the budget found no one to bring back.',
  },
  alertFocus: {
    ru: 'Фокус размыт: исполнение всех вертикалей теряет {penalty}. Управляющая компания выкупает этот штраф.',
    en: 'Focus is diluted: every vertical’s execution loses {penalty}. The management company buys that penalty back.',
  },
  alertTrust: {
    ru: 'Доверие к единому аккаунту подорвано ещё на {months} мес.: кросс-селл работает вполсилы.',
    en: 'Trust in the unified account is dented for {months} more months: cross-sell runs at half power.',
  },
  alertRunway: {
    ru: 'Кассы хватит примерно на {months} мес. при текущем темпе (−{burn}/мес). Раунд лучше поднимать до того, как деньги кончились.',
    en: 'Cash covers roughly {months} months at the current burn (−{burn}/mo). Raise before the money runs out, not after.',
  },
  alertProfit: { ru: 'Холдинг прибылен: +{value} за месяц.', en: 'The holding is profitable: +{value} this month.' },
  alertFed: {
    ru: 'Набег федеральной экосистемы: привлечение дороже, отток выше ещё {months} мес. Лучшая защита — клиенты двух сервисов: их переманить сложнее.',
    en: 'The national ecosystem’s raid: dearer acquisition and higher churn for {months} more months. The best defence is two-service customers — they are harder to poach.',
  },
  alertCrisis: {
    ru: 'Экономический спад: рынок сжат ещё {months} мес. Переменные расходы сжимаются сами — следите за постоянными.',
    en: 'The downturn: the market stays shrunk for {months} more months. Variable costs shrink on their own — watch the fixed ones.',
  },
  alertCrisisCut: {
    ru: 'Спад ещё {months} мес.: фиксы срезаны на 25%, но исполнение страдает — отток выше обычного.',
    en: 'The downturn runs {months} more months: fixed costs are cut 25%, but execution suffers — churn is above normal.',
  },
  alertEcomGateOpen: {
    ru: 'Совет готов согласовать третью ногу: е-ком доступен к запуску — у вашей логистики здесь скидка.',
    en: 'The board is ready to approve a third leg: e-commerce is available — your logistics earns a discount here.',
  },
  alertPlusReady: {
    ru: 'У вас {multi} клиентов с двумя сервисами — подписке Plus уже есть что склеивать.',
    en: 'You have {multi} customers on two services — Plus already has something to glue.',
  },
  alertPlusPricey: {
    ru: 'Подписка почти не растёт: премиальная цена сужает круг желающих.',
    en: 'The subscription is barely growing: the premium price narrows the audience.',
  },
  alertLegal: {
    ru: 'Идёт антимонопольное дело: юристы {cost}/мес ещё {months} мес., а внимание прессы режет кросс-селл.',
    en: 'The antitrust case is running: {cost}/mo of lawyers for {months} more months, and press attention is cutting cross-sell.',
  },
  alertSplit: {
    ru: 'Логистика отделена: е-ком покупает доставку по рынку — его маржа ниже, чем была бы внутри холдинга.',
    en: 'Logistics is split off: e-commerce buys delivery at market rates, so its margin is below what it would be inside the holding.',
  },
  alertSupervision: {
    ru: 'Единый аккаунт под надзором: согласия собираются строже, ёмкость кросс-селла ниже до конца партии.',
    en: 'The unified account is under supervision: consent is stricter and cross-sell capacity stays lower to the end of the game.',
  },
  jumpGo: { ru: 'показать →', en: 'show →' },

  // --- новости ---
  newsPanel: { ru: 'Город и рынок', en: 'City and market' },
  newsEmpty: { ru: 'Тихий месяц: рынок ждёт вашего следующего шага.', en: 'A quiet month: the market is waiting for your next move.' },
  newsGateOpen: {
    ru: 'Совет готов согласовать запуск такси: стартовый актив прибыльный, ворота открыты.',
    en: 'The board is ready to approve the taxi launch: the starting asset is profitable, the gate is open.',
  },
  newsWarStarted: { ru: '«Таксоград» начал войну: демпинг и перехват вашей рекламы.', en: 'Taxograd opened the war: dumping and intercepting your ads.' },
  newsWarLeft: { ru: 'Война с «Таксоградом»: ещё {months} мес. демпинга.', en: 'The Taxograd war: {months} more months of dumping.' },
  newsWarOver: { ru: 'Война закончилась: рынок такси вернулся к нормальным ценам.', en: 'The war is over: the taxi market is back to normal fares.' },
  newsCustomers: { ru: 'Клиенты холдинга: +{came} / −{left} — {verdict}', en: 'Holding customers: +{came} / −{left} — {verdict}' },
  newsCustomersGood: { ru: 'база растёт', en: 'the base is growing' },
  newsCustomersEven: { ru: 'база стоит на месте', en: 'the base is flat' },
  newsCustomersBad: { ru: 'уходит больше, чем приходит', en: 'more leave than arrive' },
  newsCross: {
    ru: 'Кросс-селл привёл {conv} клиентов (в такси {toTaxi}, в еду {toFood}).',
    en: 'Cross-sell brought {conv} customers ({toTaxi} to taxi, {toFood} to food).',
  },
  newsGoalTight: {
    ru: 'До отчёта совету {months} мес., цель года пока не выполнена.',
    en: '{months} months to the board review, and the year’s goal is not met yet.',
  },
  newsFed: {
    ru: 'Федеральная экосистема давит на город: ещё {months} мес. дорогого привлечения.',
    en: 'The national ecosystem is pressing the city: {months} more months of dear acquisition.',
  },
  newsFedOver: {
    ru: 'Набег федеральной экосистемы выдохся: рынок привлечения вернулся к норме.',
    en: 'The national ecosystem’s raid has run out of steam: acquisition is back to normal.',
  },
  newsCrisis: {
    ru: 'Экономический спад: горожане экономят ещё {months} мес.',
    en: 'The downturn: the city keeps saving for {months} more months.',
  },
  newsCrisisOver: {
    ru: 'Спад закончился: спрос вернулся к обычному уровню.',
    en: 'The downturn is over: demand is back to its usual level.',
  },
  newsAirport: {
    ru: 'Аэропорт ваш: официальные стоянки дают постоянный поток дальних поездок.',
    en: 'The airport is yours: official ranks feed a permanent stream of long rides.',
  },

  // --- графики ---
  chartClients: { ru: 'Клиенты', en: 'Customers' },
  chartClientsCaption: {
    ru: 'Общая база — главный ресурс экосистемы: хаб кормит вертикали клиентами, а пересечение удерживает всех.',
    en: 'The shared base is the ecosystem’s main resource: the hub feeds the verticals with customers, and the overlap retains everyone.',
  },
  chartMoney: { ru: 'Деньги', en: 'Money' },
  chartMoneyCaption: {
    ru: 'Выручка, вклад и прибыль холдинга. Пока новые вертикали в инвестиционной фазе, прибыль держит только дисциплина хаба.',
    en: 'Holding revenue, contribution and profit. While the new verticals are in their investment phase, only hub discipline keeps profit alive.',
  },
  chartCash: { ru: 'Касса', en: 'Cash' },
  chartCashCaption: {
    ru: 'Касса и раунды. Экспансия почти всегда живёт на чужие деньги — вопрос в оценке, по которой вы их берёте.',
    en: 'Cash and rounds. Expansion nearly always runs on outside money — the question is the valuation you take it at.',
  },
  chartArpu: { ru: 'ARPU', en: 'ARPU' },
  chartArpuCaption: {
    ru: 'Выручка холдинга на уникального клиента. Это и есть ответ на потолок рынка: расти выручкой с человека, а не числом людей.',
    en: 'Holding revenue per unique customer. This is the answer to the market ceiling: grow revenue per person, not the head count.',
  },
  chartValue: { ru: 'Оценка', en: 'Valuation' },
  chartValueCaption: {
    ru: 'Сумма частей: зрелый хаб и растущие вертикали оцениваются разными множителями, премия — за клиентов двух и более сервисов.',
    en: 'Sum of parts: the mature hub and the growing verticals carry different multiples; the premium is for multi-service customers.',
  },
  chartAcq: { ru: 'Привлечение', en: 'Acquisition' },
  chartAcqCaption: {
    ru: 'Два канала роста такси: кросс-селл из своей базы и холодный маркетинг. У кросс-селла ниже цена, у маркетинга — выше потолок.',
    en: 'Taxi’s two growth channels: cross-sell from your own base and cold marketing. Cross-sell is cheaper; marketing scales higher.',
  },
  seriesFood: { ru: 'Ядро', en: 'Core' },
  seriesTaxi: { ru: 'Такси', en: 'Taxi' },
  seriesEcom: { ru: 'Торговля', en: 'Retail' },
  seriesBoth: { ru: 'Мульти-клиенты', en: 'Multi-service' },
  seriesPlus: { ru: 'Подписчики Plus', en: 'Plus subs' },
  seriesUnique: { ru: 'Уникальные', en: 'Unique' },
  seriesRevenue: { ru: 'Выручка', en: 'Revenue' },
  seriesContribution: { ru: 'Вклад', en: 'Contribution' },
  seriesProfit: { ru: 'Прибыль', en: 'Profit' },
  seriesArpu: { ru: 'ARPU, ₽/мес', en: 'ARPU, ₽/mo' },
  seriesValueFood: { ru: 'Оценка еды', en: 'Food value' },
  seriesValueTaxi: { ru: 'Оценка такси', en: 'Taxi value' },
  seriesValueEcom: { ru: 'Оценка е-кома', en: 'E-com value' },
  seriesValuePlus: { ru: 'Оценка подписки', en: 'Plus value' },
  seriesValueTotal: { ru: 'Оценка холдинга', en: 'Holding value' },
  seriesCrossAcq: { ru: 'Кросс-селл, чел/мес', en: 'Cross-sell, people/mo' },
  seriesColdAcq: { ru: 'Маркетинг, чел/мес', en: 'Marketing, people/mo' },
  chartChangesTitle: { ru: 'Решения:', en: 'Decisions:' },
  chartChangeItem: { ru: 'м{turn} — {what}', en: 'mo {turn} — {what}' },
  chartChangeVerticals: { ru: 'вертикали', en: 'verticals' },
  chartChangePartners: { ru: 'партнёрства', en: 'partnerships' },
  pnlEmpty: { ru: 'Сыграйте первый месяц — появится динамика.', en: 'Play the first month and the trends will appear.' },

  // --- правая колонка: оценка (sum-of-parts) ---
  tabSop: { ru: 'Оценка', en: 'Valuation' },
  tabPnl: { ru: 'P&L', en: 'P&L' },
  tabBase: { ru: 'База', en: 'Base' },
  tabHelp: { ru: 'Справка', en: 'How to play' },
  sopIntro: {
    ru: 'Инвестор оценивает холдинг по сумме частей: каждая вертикаль — своим множителем от годовой выручки. Зрелый стартовый актив стоит как дойная корова, растущие вертикали — как история роста.',
    en: 'Investors value the holding as a sum of parts: each vertical gets its own multiple of annualised revenue. The mature starting asset is priced like a cash cow, the growing verticals like a growth story.',
  },
  sopColPart: { ru: 'Вертикаль', en: 'Vertical' },
  sopColRunRate: { ru: 'Выручка, год', en: 'Revenue, yr' },
  sopColGrowth: { ru: 'Рост', en: 'Growth' },
  sopColMargin: { ru: 'Маржа', en: 'Margin' },
  sopColValue: { ru: 'Оценка', en: 'Value' },
  sopPartFood: { ru: 'Стартовый актив', en: 'Starting asset' },
  sopPartTaxi: { ru: 'Такси', en: 'Taxi' },
  sopPartEcom: { ru: 'Онлайн-торговля', en: 'Online retail' },
  sopPartPlus: { ru: 'Подписка Plus', en: 'Plus subscription' },
  sopThirdAct: {
    ru: 'Третий акт: инвесторы требуют прибыльную экосистему, а не зоопарк — убыточные части в последний год дисконтируются жёстче.',
    en: 'Act three: investors demand a profitable ecosystem, not a zoo — loss-making parts are discounted harder in the final year.',
  },
  sopZoo: { ru: 'убыточна и не растёт — считается обязательством', en: 'loss-making and not growing — counted as a liability' },
  sopPremium: { ru: 'Премия за кросс-селл ({share} клиентов с 2+ сервисами)', en: 'Cross-sell premium ({share} customers on 2+ services)' },
  sopBonus: { ru: 'Репутация у совета и инвесторов', en: 'Standing with the board and investors' },
  sopTotal: { ru: 'Оценка холдинга', en: 'Holding valuation' },
  sopNote: {
    ru: 'Премию платят только за замеряемую склейку — долю клиентов двух и более сервисов. Убыточная вертикаль без роста — «зоопарк»: инвестор вычитает её годовой burn.',
    en: 'The premium is paid only for measurable glue — the share of customers on two or more services. A loss-making vertical without growth is a “zoo”: investors subtract its annual burn.',
  },

  // --- правая колонка: P&L ---
  pnlRevenueFood: { ru: 'Выручка хаба', en: 'Hub revenue' },
  pnlRevenueTaxi: { ru: 'Выручка такси', en: 'Taxi revenue' },
  pnlRevenueEcom: { ru: 'Выручка е-кома', en: 'E-commerce revenue' },
  pnlRevenuePlus: { ru: 'Подписка Plus', en: 'Plus subscriptions' },
  pnlRevenueTickets: { ru: 'Партнёрство по билетам', en: 'Ticketing partnership' },
  pnlRevenue: { ru: 'Выручка холдинга', en: 'Holding revenue' },
  pnlContribFood: { ru: 'Вклад хаба', en: 'Hub contribution' },
  pnlContribTaxi: { ru: 'Вклад такси', en: 'Taxi contribution' },
  pnlContribEcom: { ru: 'Вклад е-кома', en: 'E-commerce contribution' },
  pnlPlusNet: { ru: 'Подписка минус её выгоды', en: 'Subscription net of perks' },
  pnlContribution: { ru: 'Вклад', en: 'Contribution' },
  pnlFixedFood: { ru: 'Фикс хаба', en: 'Hub fixed costs' },
  pnlFixedTaxi: { ru: 'Фикс такси', en: 'Taxi fixed costs' },
  pnlFixedEcom: { ru: 'Фикс е-кома', en: 'E-commerce fixed costs' },
  pnlHq: { ru: 'Управление холдинга', en: 'Holding HQ' },
  pnlLegal: { ru: 'Юристы по антимонопольному делу', en: 'Antitrust lawyers' },
  pnlMgmt: { ru: 'Управляющая компания', en: 'Management company' },
  pnlCrossSell: { ru: 'Кросс-селл', en: 'Cross-sell' },
  pnlFoodOps: { ru: 'Сервис хаба', en: 'Hub service' },
  pnlFoodMarketing: { ru: 'Возврат клиентов хаба', en: 'Hub win-back' },
  pnlTaxiSupply: { ru: 'Привлечение водителей', en: 'Driver acquisition' },
  pnlTaxiMarketing: { ru: 'Маркетинг такси', en: 'Taxi marketing' },
  pnlEcomOps: { ru: 'Ассортимент и обработка заказов', en: 'Range and order handling' },
  pnlFinance: { ru: 'Финансовая команда', en: 'Finance team' },
  pnlMisc: { ru: 'Прочие расходы ({rate} выручки)', en: 'Miscellaneous ({rate} of revenue)' },
  sopColMultiple: { ru: 'Множитель', en: 'Multiple' },
  sopMultipleNote: {
    ru: 'Множитель к годовой выручке рынок даёт за темп роста и маржу: растущая прибыльная часть стоит несколько выручек, зрелая — около одной, убыточная не стоит ничего и вычитается как обязательство. Колонку показывает финансовая команда — без неё видно, сколько стоит часть, но не почему столько.',
    en: 'The market applies a multiple to annual revenue based on growth and margin: a growing profitable part is worth several revenues, a mature one about one, a loss-making one is worth nothing and is subtracted as a liability. The column is supplied by your finance team — without one you see what a part is worth, but not why.',
  },
  sopMultipleLocked: {
    ru: 'Как именно рынок превращает выручку и маржу в оценку, разбирает финансовая команда — сейчас она для этого слишком слаба.',
    en: 'Exactly how the market turns revenue and margin into a valuation is your finance team’s job to explain — right now it is too weak for that.',
  },
  readoutFinance: {
    ru: 'Финансовая команда: сила <b class="{cls}">{level}</b>. Прочие расходы — {misc} выручки, условия раунда лучше на {round}.',
    en: 'Finance team: strength <b class="{cls}">{level}</b>. Miscellaneous costs run at {misc} of revenue; round terms improve by {round}.',
  },
  readoutFinanceFree: {
    ru: 'На лёгком уровне команда уже собрана и вам ничего не стоит.',
    en: 'On the easy level the team is already in place and costs you nothing.',
  },
  readoutFinanceHalf: {
    ru: 'Половина силы стоит {half} в месяц — цена растёт вместе с выручкой холдинга.',
    en: 'Half its strength costs {half} a month — the price grows with the holding’s revenue.',
  },
  adviceTitle: { ru: 'Разбор месяца от финансовой команды', en: 'The finance team’s read on the month' },
  adviceCac: {
    ru: 'Холодный клиент обходится в {cac}, а приносит около {value} за год. Канал не окупается — либо дешевле, либо меньше.',
    en: 'A cold customer costs {cac} and brings about {value} a year. The channel does not pay for itself — make it cheaper or smaller.',
  },
  adviceCrossWaste: {
    ru: 'Кросс-селл сжёг {wasted} впустую: денег больше, чем людей, готовых попробовать второй сервис в этом месяце.',
    en: 'Cross-sell burned {wasted} for nothing: more money than people ready to try a second service this month.',
  },
  adviceRunway: {
    ru: 'Кассы хватит примерно на {months} мес. при текущем сжигании {burn} в месяц. Раунд берут заранее, а не в последний месяц: слабый холдинг отдаёт больше доли.',
    en: 'Cash lasts about {months} months at the current burn of {burn} a month. Rounds are raised early, not in the final month: a weak holding gives away more equity.',
  },
  adviceFocus: {
    ru: 'Фокус размыт на {penalty}: исполнение проседает во всех сервисах сразу. Либо управляющая компания, либо на одну вертикаль меньше.',
    en: 'Focus is diluted by {penalty}: execution sags across every service at once. Either a management company or one vertical fewer.',
  },
  adviceTake: {
    ru: 'Монетизация за порогом терпения: деньги приходят сейчас, а уходящие клиенты уносят с собой будущий кросс-селл.',
    en: 'Monetisation is past the tolerance threshold: the money comes now, and the leavers take your future cross-sell with them.',
  },
  adviceEcomThin: {
    ru: 'Е-ком убыточен при почти нулевой мощности логистики: так эта нога не сходится никогда — либо мощность, либо закрывать.',
    en: 'E-commerce is loss-making with almost no logistics capacity: that leg never adds up this way — either fund the capacity or close it.',
  },
  advicePlusThin: {
    ru: 'Подписка стоит дороже, чем приносит, и охватывает мало кого: Plus окупается массовостью, а не ценой.',
    en: 'The subscription costs more than it earns and reaches too few people: Plus pays off through scale, not price.',
  },
  welcomeDifficulty: { ru: 'Уровень сложности', en: 'Difficulty' },
  welcomeDifficultyNote: {
    ru: 'Механики на всех уровнях одни и те же. Разница одна: сколько стоит финансовая команда — та, что режет «прочие расходы», объясняет вашу оценку и разбирает решения месяца.',
    en: 'The mechanics are identical on every level. One thing changes: what the finance team costs — the team that cuts miscellaneous expenses, explains your valuation and reads your monthly decisions.',
  },
  gameOverDifficulty: {
    ru: 'Уровень: <b>{level}</b>. {note}',
    en: 'Level: <b>{level}</b>. {note}',
  },
  gameOverRanked: { ru: 'Результат идёт в мировую таблицу этого уровня.', en: 'The result goes to this level’s world table.' },
  gameOverUnranked: { ru: 'Тренировочный уровень: в мировую таблицу результат не идёт.', en: 'Training level: the result is not submitted to the world table.' },
  pnlEcomLogistics: { ru: 'Мощность логистики', en: 'Logistics capacity' },
  pnlEcomMarketing: { ru: 'Маркетинг е-кома', en: 'E-commerce marketing' },
  pnlLicense: { ru: 'Лицензия кино в Plus', en: 'Cinema licence for Plus' },
  pnlTicketsFee: { ru: 'Абонентка партнёрства по билетам', en: 'Ticketing partnership fee' },
  pnlOperatingProfit: { ru: 'Операционная прибыль', en: 'Operating profit' },
  pnlOneOff: { ru: 'Разовые расходы', en: 'One-off costs' },
  pnlCashChange: { ru: 'Изменение кассы', en: 'Cash change' },
  pnlNote: {
    ru: 'Вклад — выручка минус переменные расходы вертикалей. Ниже — постоянные и бюджеты: они не зависят от того, сколько заказов и поездок случилось.',
    en: 'Contribution is revenue minus the verticals’ variable costs. Below come fixed costs and budgets: they do not depend on how many orders and rides happened.',
  },

  // --- правая колонка: база ---
  baseIntro: {
    ru: 'Общая база клиентов города — главный ресурс экосистемы. Пересечение — люди, живущие в двух и более сервисах: они уходят реже и стоят инвестору дороже.',
    en: 'The city’s shared customer base is the ecosystem’s main resource. The overlap — people on two or more services — churns less and is worth more to investors.',
  },
  baseColWho: { ru: 'Сегмент', en: 'Segment' },
  baseColCount: { ru: 'Людей', en: 'People' },
  baseFood: { ru: 'Клиенты хаба', en: 'Hub customers' },
  baseTaxi: { ru: 'Клиенты такси', en: 'Taxi customers' },
  baseEcom: { ru: 'Покупатели', en: 'Retail customers' },
  baseBoth: { ru: 'Два и более сервисов', en: 'Two or more services' },
  basePlus: { ru: 'Подписчики Plus', en: 'Plus subscribers' },
  baseUnique: { ru: 'Уникальных клиентов', en: 'Unique customers' },
  baseMultiShare: { ru: 'Доля с двумя и более сервисами', en: 'Share on two or more services' },
  baseReturnPool: { ru: 'Пул возврата хаба (недавно ушли)', en: 'Hub win-back pool (recent leavers)' },
  baseAcqTitle: { ru: 'Каналы привлечения за месяц', en: 'Acquisition channels this month' },
  baseColChannel: { ru: 'Канал', en: 'Channel' },
  baseColPeople: { ru: 'Пришло', en: 'Arrived' },
  baseColCac: { ru: 'Цена клиента', en: 'Cost per customer' },
  baseChCross: { ru: 'Кросс-селл (хаб → такси)', en: 'Cross-sell (hub → taxi)' },
  baseChCrossEcom: { ru: 'Кросс-селл (хаб → е-ком)', en: 'Cross-sell (hub → e-com)' },
  baseChColdEcom: { ru: 'Маркетинг е-кома (холодный)', en: 'E-com marketing (cold)' },
  baseChCrossBack: { ru: 'Кросс-селл (обратно в хаб)', en: 'Cross-sell (back to the hub)' },
  baseChCold: { ru: 'Маркетинг такси (холодный)', en: 'Taxi marketing (cold)' },
  baseChWinback: { ru: 'Возврат в хаб', en: 'Hub win-back' },
  baseChOrganic: { ru: 'Органика хаба', en: 'Hub organic' },
  baseAcqNote: {
    ru: 'Кросс-селл дешевле холодного в разы, но у него есть ёмкость: пул соседней вертикали конечен, а конверсия зависит от качества принимающего сервиса. Маркетинг дороже, зато масштабируем и приводит новых для холдинга людей.',
    en: 'Cross-sell is several times cheaper than cold — but it has a ceiling: the neighbouring pool is finite, and conversion depends on the receiving service’s quality. Marketing costs more but scales, and brings people new to the holding.',
  },
  baseNoTaxi: {
    ru: 'Пока вертикаль одна, кросс-селлу некуда продавать: канал появится вместе с такси.',
    en: 'With a single vertical there is nowhere to cross-sell: the channel appears together with taxi.',
  },

  // --- справка ---
  helpWhatTitle: { ru: 'Что это за игра', en: 'What this game is' },
  helpWhatText: {
    ru: 'Вы — генеральный директор компании, победившей на своём рынке: стартовый актив (доставка, стриминг или билеты) выбирается на экране приветствия. Рынок насыщен, и расти дальше можно только выручкой с клиента: новые вертикали, кросс-селл, общая база. Ход — месяц, партия — три года.',
    en: 'You run the company that won its market: the starting asset (delivery, streaming or ticketing) is chosen on the welcome screen. The market is saturated, so further growth can only come from revenue per customer: new verticals, cross-sell, a shared base. A turn is a month; the game is three years.',
  },
  helpAssetTitle: { ru: 'Стартовый актив — «класс персонажа»', en: 'The starting asset is your character class' },
  helpAssetText: {
    ru: 'Стартовый актив задаёт форму экосистемы: у доставки дешёвая синергия с е-комом (курьеры уже ездят по городу), у стриминга — подписка и свой контент, у билетов — партнёрская сеть, удешевляющая любое привлечение. Amazon, Яндекс и Сбер построили разные экосистемы, потому что начинали с разного. Все три старта играбельны; сыгранный финал соответствующей игры усиливает свой актив.',
    en: 'The starting asset dictates the ecosystem’s shape: delivery has cheap synergy with e-commerce (the couriers already roam the city), streaming brings the subscription habit and its own content, ticketing a partner network that cheapens all acquisition. Amazon, Yandex and Sber built different ecosystems because they started from different assets. All three starts are playable; a finished endgame of the matching game boosts its asset.',
  },
  helpCrossTitle: { ru: 'Кросс-селл против маркетинга', en: 'Cross-sell versus marketing' },
  helpCrossFormula: {
    ru: 'приток = min(бюджет / цена клиента, пул × охват × качество сервиса)',
    en: 'intake = min(budget / cost per customer, pool × reach × service quality)',
  },
  helpCrossText: {
    ru: 'Кросс-селл конвертирует клиентов соседней вертикали — в разы дешевле холодного, но упирается в ёмкость пула и в качество принимающего сервиса: мёртвую вертикаль не спасает никакой трафик. Холодный маркетинг дороже, зато растит общую базу города.',
    en: 'Cross-sell converts the neighbouring vertical’s customers — far cheaper than cold, but capped by the pool’s capacity and the receiving service’s quality: no amount of traffic saves a dead product. Cold marketing costs more but grows the city-wide base.',
  },
  helpWarTitle: { ru: 'Война за рынок', en: 'The market war' },
  helpWarText: {
    ru: 'В такси уже десять лет живёт «Таксоград». На ваш вход он ответит конечной войной: демпинг режет ваш приток и продавливает цены. Ранний вход платит войну на маленькой базе, поздний — теряет месяцы роста. Тайминг — и есть решение.',
    en: 'Taxograd has run the taxi market for a decade. It answers your entry with a finite war: dumping cuts your intake and pushes fares down. Enter early and you pay the war on a small base; enter late and you lose months of growth. The timing is the decision.',
  },
  helpPlusTitle: { ru: 'Подписка Plus и партнёрства', en: 'The Plus subscription and partnerships' },
  helpPlusText: {
    ru: 'Plus — покупка удержания за маржу: выгоды подписчику стоят примерно столько же, сколько он платит, а окупается подписка частотой и оттоком, который она режет во всех сервисах сразу. Кино и билеты входят в экосистему лицензией и партнёрством — играбельные версии остались в КИНОРЕКЕ и БИЛЕТВИЛЕ.',
    en: 'Plus buys retention with margin: the perks cost roughly what the subscriber pays, and the subscription pays off through frequency and the churn it cuts across every service at once. Cinema and ticketing join via a licence and a partnership — their playable versions stayed in KINOREKA and BILETVILLE.',
  },
  helpMetaTitle: { ru: 'Наследие и «тройная корона»', en: 'Legacy and the triple crown' },
  helpMetaText: {
    ru: 'Финалы старых игр открывают стартовые бонусы (актив, льготная лицензия, льготное партнёрство) — они складываются, но замерены так, чтобы чувствоваться и не решать партию. Льготы по абоненткам действуют первый год: наследие — фора на старте, а не рента на все три года. За финалы всех трёх игр и достойный НОВОГРАД полагается секретная концовка — строго косметическая. Успешный НОВОГРАД, в свою очередь, открывает в старых играх бейдж и коды партий: экономических прибавок в их зачётных партиях нет — они сломали бы честность общей таблицы.',
    en: 'The old games’ endgames unlock starting bonuses (asset, discounted licence, discounted partnership) — they stack, but are sized to be felt without deciding the game. The fee discounts last the first year: a legacy is a head start, not a rent for all three years. Finishing all three plus a worthy NOVOGRAD earns a secret ending — strictly cosmetic. A successful NOVOGRAD in turn unlocks a badge and game codes in the old games: no economic gains in their ranked runs — that would break the fairness of the shared table.',
  },
  helpFocusTitle: { ru: 'Каннибализация фокуса', en: 'Focus cannibalisation' },
  helpFocusText: {
    ru: 'Маркетинг и менеджмент общие: каждая новая вертикаль размывает исполнение всех остальных. Управляющая компания выкупает штраф — это цена «ещё одного сервиса», которую не видно в его собственном P&L.',
    en: 'Marketing and management are shared: every new vertical dilutes the execution of all the others. The management company buys the penalty back — the cost of “one more service” that never shows in its own P&L.',
  },
  helpScoreTitle: { ru: 'Счёт партии', en: 'The final score' },
  helpScoreFormula: {
    ru: 'итог = (оценка холдинга + касса) × ваша доля',
    en: 'score = (holding valuation + cash) × your stake',
  },
  helpScoreText: {
    ru: 'Оценка — сумма частей: каждая вертикаль своим множителем, премия за долю клиентов двух и более сервисов, вычет за убыточные вертикали без роста. Касса принадлежит акционерам: рубль, не потраченный к финалу, стоит рубль.',
    en: 'The valuation is a sum of parts: each vertical at its own multiple, a premium for the share of two-plus-service customers, a deduction for loss-making verticals without growth. Cash belongs to the shareholders: an unspent rouble is worth a rouble.',
  },
  helpSpiralsTitle: { ru: 'Спирали, которые стоит знать', en: 'Spirals worth knowing' },
  helpSpiralMilk: {
    ru: 'Дожим коровы: монетизация выше порога даёт деньги сейчас и сжигает базу — а с ней пул кросс-селла и оценку.',
    en: 'Over-milking: monetisation past the threshold pays now and burns the base — and with it the cross-sell pool and the valuation.',
  },
  helpSpiralDrivers: {
    ru: 'Водители: мало — долгая подача и отток клиентов; много — простой и отток водителей. Мощность ведут за спросом.',
    en: 'Drivers: too few means long pickups and customer churn; too many means idleness and driver churn. Capacity follows demand.',
  },
  helpSpiralZoo: {
    ru: 'Зоопарк: убыточная вертикаль без роста вычитается из оценки. Запуск ради запуска наказывается.',
    en: 'The zoo: a loss-making vertical without growth is deducted from the valuation. Launching for its own sake is punished.',
  },
  helpLimitsTitle: { ru: 'Границы модели', en: 'Limits of the model' },
  helpLimitsText: {
    ru: 'Модель иллюстрирует механику экосистемы: общая база, кросс-селл, сумма частей. За кадром — регуляторика слияний, реальная конкуренция экосистем и многое другое. Числа условные, подобранные для играбельности.',
    en: 'The model illustrates ecosystem mechanics: a shared base, cross-sell, sum-of-parts. Merger regulation, real ecosystem-on-ecosystem competition and much more stay off screen. The numbers are notional, chosen for playability.',
  },
  helpModalTitle: { ru: 'Как играть', en: 'How to play' },
  helpModalOk: { ru: 'Понятно', en: 'Got it' },
  helpSeed: { ru: 'Код этой партии: <b>{seed}</b> — введите его на экране приветствия, чтобы сыграть тот же город ещё раз.', en: 'This game’s code: <b>{seed}</b> — enter it on the welcome screen to play the same city again.' },
  helpVersion: { ru: 'Сборка {version} от {date}.', en: 'Build {version}, {date}.' },
  helpVersionDev: { ru: 'Сборка из исходников (не раздаваемый файл).', en: 'Built from source (not a distributed file).' },
  helpAuthor: { ru: 'Игру сделал <b><a href="https://www.linkedin.com/in/ruben-deev" target="_blank" rel="noopener">Ruben Deev</a></b>. Лицензия <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ru" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>: свободно для учёбы и некоммерческого использования с указанием автора.', en: 'Made by <b><a href="https://www.linkedin.com/in/ruben-deev" target="_blank" rel="noopener">Ruben Deev</a></b>. Licensed <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>: free for education and non-commercial use with attribution.' },

  // --- приветствие ---
  welcomeTitle: { ru: 'НОВОГРАД: экосистема', en: 'NOVOGRAD: the ecosystem' },
  welcomeRole: { ru: 'Вы — генеральный директор компании, которая уже выиграла свой рынок: одна из трёх игр серии закончилась победой, город насыщен, расти числом клиентов больше некуда. Эта партия начинается там, где закончилась прошлая.', en: 'You are the CEO of a company that has already won its market: one of the three games of the series ended in victory, the city is saturated, and there is no one left to acquire. This game starts where the previous one ended.' },
  welcomeTurn: { ru: 'Ход — месяц, партия — три года. Вы управляете холдингом на уровне портфеля: несколько рычагов на вертикаль, микроменеджмент остался в исходных играх.', en: 'A turn is a month; the game is three years. You run the holding at portfolio level: a few levers per vertical — the micromanagement stayed in the original games.' },
  welcomeTension: { ru: 'Главное напряжение: дожимать насыщенную корову или строить вторую ногу — такси, кросс-селл, общая база. Деньги сейчас против выручки с клиента завтра; и на ваш вход хозяин рынка ответит войной.', en: 'The core tension: milk the saturated cow, or build a second leg — taxi, cross-sell, the shared base. Money now versus revenue per customer later; and the market’s owner will answer your entry with a war.' },
  welcomeGoal: { ru: 'Счёт партии — стоимость вашей доли: (оценка холдинга по сумме частей + касса) × доля. Инвестор платит премию за клиентов двух и более сервисов.', en: 'The score is the value of your stake: (sum-of-parts valuation + cash) × your stake. Investors pay a premium for customers on two or more services.' },
  welcomeHint: { ru: 'Начните с вкладки «База»: посмотрите, из чего состоит общая база клиентов, — и следите за ARPU холдинга в шапке.', en: 'Start with the Base tab: see what the shared customer base is made of — and keep an eye on holding ARPU in the header.' },
  welcomeStart: { ru: 'Начать партию', en: 'Start the game' },
  welcomeMore: { ru: 'Подробнее', en: 'More' },
  welcomeBest: { ru: 'Ваш рекорд на этом устройстве: {score}.', en: 'Your best on this device: {score}.' },
  welcomeAsset: { ru: 'Стартовый актив — класс персонажа', en: 'Starting asset — your character class' },
  welcomeAssetChoice: {
    ru: 'Форма экосистемы диктуется тем, с чего вы начинаете: у доставки дешёвый е-ком (курьеры), у стриминга — подписка, у билетов — партнёрская сеть. ★ — финал этой игры сыгран, актив усилен.',
    en: 'The ecosystem’s shape follows what you start from: delivery gets cheap e-commerce (couriers), streaming gets the subscription, ticketing gets the partner network. ★ — that game’s endgame is played; the asset is boosted.',
  },
  welcomeLegacy: { ru: 'Наследие набора', en: 'The set’s legacy' },
  welcomeLegacyNote: {
    ru: 'Финалы старых игр усиливают НОВОГРАД: свой актив, льготные первый год лицензия кино и партнёрство по билетам — и числа вашего финала: чем больше вы там заработали, тем больше касса на старте и выше оценка у инвесторов. На этом устройстве финалы видны сами; со строкой результата — с любого.',
    en: 'The old games’ endgames strengthen NOVOGRAD: your own asset, a discounted cinema licence and ticketing partnership for the first year — and the numbers of your finale: the more you earned there, the more cash you start with and the higher investors price you. On this device endgames are picked up automatically; a result string works from any device.',
  },
  welcomeCarryTitle: { ru: 'Что перенеслось из прошлой игры:', en: 'What carried over from the previous game:' },
  welcomeCarry: {
    ru: 'Финал {game} на {score}. Касса на старте: <b>{cash}</b> ({bonus} к базовой) — это деньги, которые вы там не потратили. Прошлая оценка стала репутацией у инвесторов: раунд оценивают на {round} выше, а ниже {floor} вас не оценят вовсе — за те же деньги вы отдадите меньшую долю.',
    en: 'A {game} finale worth {score}. Opening cash: <b>{cash}</b> ({bonus} over the base) — the money you did not spend there. The old valuation became your standing with investors: rounds are priced {round} higher and never below {floor} — the same money costs you a smaller stake.',
  },
  welcomeCarryNone: { ru: 'без прибавки: до «крепкого» финала не дотянуло', en: 'no bonus: short of a solid finale' },
  welcomeCarryEmpty: {
    ru: 'Числа прошлой игры пока не перенесены: сыграйте одну из трёх игр на этом устройстве или введите строку результата выше — в НОВОГРАД перейдут ваша касса и оценка, а не только отметка «сыграно».',
    en: 'No numbers carried over yet: play one of the three games on this device or paste a result string above — your cash and valuation will carry into NOVOGRAD, not just a “played” mark.',
  },
  welcomeLegacyPlaceholder: { ru: 'строка результата, например НОВОЕДА|v1.10.5|…', en: 'result string, e.g. НОВОЕДА|v1.10.5|…' },
  welcomeLegacyAdd: { ru: 'Ввести', en: 'Add' },
  welcomeLegacyReset: { ru: 'Сбросить путь', en: 'Reset path' },
  welcomeLegacyResetAsk: {
    ru: 'Пройти путь набора заново? Забудутся введённые строки результатов, лучший финал НОВОГРАДА и текущая партия. Таблицы рекордов всех игр останутся на месте.',
    en: 'Start the set’s path over? This forgets entered result strings, your best NOVOGRAD finale and the current game. Every game’s record table stays.',
  },
  welcomeLegacyResetDone: { ru: 'Путь набора сброшен. Рекорды игр не тронуты.', en: 'The set’s path is reset. Game records are untouched.' },
  welcomeLegacyAdded: { ru: 'Строка принята: {tag}. Наследие обновлено.', en: 'String accepted: {tag}. Legacy updated.' },
  welcomeLegacyBad: { ru: 'Строка не прошла проверку контрольной суммы.', en: 'The string failed its checksum.' },
  welcomeNumbers: { ru: '<b>О числах.</b> Модель — из рабочего опыта, числа условные, подобранные для играбельности: не бенчмарки и не данные реальных компаний. Игра иллюстрирует механику связей, а не величины; оценивать по ней настоящий бизнес нельзя.', en: '<b>About the numbers.</b> The model comes from working experience; the numbers are notional, chosen for playability — not benchmarks, not real companies’ data. The game illustrates the mechanics of the relationships, not the magnitudes; it is not a tool for valuing a real business.' },
  footNumbers: { ru: 'Числа в модели условные, не отраслевые бенчмарки: игра иллюстрирует механику связей, а не величины.', en: 'The numbers in the model are notional, not industry benchmarks: the game illustrates the mechanics of the relationships, not the magnitudes.' },
  seedLabel: { ru: 'Код партии (необязательно)', en: 'Game code (optional)' },
  seedPlaceholder: { ru: 'например, урок-7б', en: 'e.g. class-7b' },
  seedNote: { ru: 'Одинаковый код — одинаковый город у всех, кто его ввёл. Пустое поле — случайный.', en: 'The same code gives everyone the same city. Empty means random.' },

  // --- финал ---
  gameOverFinished: { ru: 'Три года прошли', en: 'Three years are up' },
  gameOverBankrupt: { ru: 'Деньги кончились', en: 'Out of money' },
  gameOverFinishedText: {
    ru: 'Партия окончена. Совет подводит итог: чего стоит построенное — и сколько из этого принадлежит вам.',
    en: 'The game is over. The board takes stock: what you built is worth — and how much of it is yours.',
  },
  gameOverBankruptText: {
    ru: 'Касса ушла в минус на месяце {month}. Экосистема строится на чужие деньги, но и они кончаются.',
    en: 'Cash went negative in month {month}. Ecosystems are built on other people’s money — but that runs out too.',
  },
  scoreValuation: { ru: 'Оценка холдинга', en: 'Holding valuation' },
  scoreStake: { ru: 'Ваша доля', en: 'Your stake' },
  scoreResult: { ru: 'Итог: доля × (оценка + касса)', en: 'Score: stake × (valuation + cash)' },
  scoreRaised: { ru: 'Привлечено', en: 'Raised' },
  scoreCash: { ru: 'Касса', en: 'Cash' },
  scoreGrade: { ru: 'Вердикт', en: 'Verdict' },
  gradeExcellent: { ru: 'Экосистема состоялась', en: 'A true ecosystem' },
  gradeSolid: { ru: 'Крепкий холдинг', en: 'A solid holding' },
  gradeSurvived: { ru: 'Выжили', en: 'Survived' },
  gradeModest: { ru: 'Скромный итог', en: 'A modest outcome' },
  gradeBankrupt: { ru: 'Банкротство', en: 'Bankruptcy' },
  gradeScale: { ru: 'Шкала для старта «{asset}»: «экосистема состоялась» — итог от {a}, «крепкий холдинг» — от {b}, «выжили» — от {c}. У каждого стартового актива шкала своя: их потолки расходятся втрое, и общая линейка объявляла бы отличную партию за маленький актив скромной. Доведённые стратегии заканчивают выше {a} — выжить легко, выиграть нет.', en: 'The scale for the “{asset}” start: “a true ecosystem” from {a}, “a solid holding” from {b}, “survived” from {c}. Every starting asset has its own scale: their ceilings differ threefold, and a single ruler would call an excellent game on a small asset modest. Polished strategies finish above {a} — surviving is easy, winning is not.' },
  gameOverLastMonth: {
    ru: 'Последний месяц: выручка {revenue}, ARPU {arpu} ₽, клиентов {unique}, из них с двумя и более сервисами {multi}.',
    en: 'Final month: revenue {revenue}, ARPU ₽{arpu}, {unique} customers, {multi} of them on two or more services.',
  },
  gameOverQuestions: {
    ru: 'Вопросы для разбора: когда вы запустили такси и почему именно тогда? Сколько стоил клиент из кросс-селла против холодного? Что случилось бы с оценкой, если бы вы просто дожимали еду все три года?',
    en: 'Debrief questions: when did you launch taxi, and why then? What did a cross-sell customer cost versus cold? What would the valuation be had you simply milked food for all three years?',
  },
  crownTitle: { ru: 'Конгломерат Новограда', en: 'The Novograd Conglomerate' },
  crownText: {
    ru: 'Вы прошли весь путь: победили в доставке, стриминге и билетах — и собрали из побед экосистему, которой гордился бы любой совет директоров. Город просыпается под ваши уведомления: еда к завтраку, такси к подъезду, посылка к вечеру, кино к ночи. Титул остаётся в ваших рекордах. Это чистая косметика: к счёту он не прибавляет ни рубля — конгломераты строят не ради множителей.',
    en: 'You walked the whole road: won delivery, streaming and ticketing — and forged the victories into an ecosystem any board would be proud of. The city wakes to your notifications: breakfast delivered, a taxi at the door, a parcel by evening, a film at night. The title stays in your records. It is pure cosmetics: not a rouble is added to the score — conglomerates are not built for multipliers.',
  },
  // --- после финала: год конгломерата ---
  endlessStart: { ru: 'Играть год конгломерата', en: 'Play the conglomerate year' },
  endlessTitle: { ru: 'Год конгломерата', en: 'The conglomerate year' },
  endlessIntro: {
    ru: 'Партия зачтена, счёт в таблице заморожен. Дальше — ещё {months} месяцев, и играют уже не за оценку, а за зрелость: совет хочет видеть склейку не ниже {glue} и рост холдинга на {growth} за год.',
    en: 'The game is scored and your table result is frozen. Ahead are {months} more months, played not for valuation but for maturity: the board wants glue at no less than {glue} and the holding to grow {growth} over the year.',
  },
  endlessRule: {
    ru: 'Главное правило акта: чужих денег больше нет. Три года экспансия жила на раунды — теперь холдинг обязан расти сам, и привычный ход «поднять ещё раунд» закрыт.',
    en: 'The rule of the act: there is no outside money left. For three years the expansion ran on rounds — now the holding has to grow on its own, and the familiar move of raising another round is closed.',
  },
  fundingClosedEndless: {
    ru: 'Раунды закрыты: в год конгломерата холдинг живёт на свои. Касса пополняется только прибылью.',
    en: 'Rounds are closed: in the conglomerate year the holding lives on its own. Cash comes from profit alone.',
  },
  goalConglomerate: {
    ru: 'Год конгломерата: удержать склейку не ниже {glue} и вырастить холдинг на {growth} — без единого раунда.',
    en: 'The conglomerate year: hold glue at {glue} or better and grow the holding {growth} — without a single round.',
  },
  goalConglomerateNow: { ru: 'склейка {glue}, рост {growth}', en: 'glue {glue}, growth {growth}' },
  endlessOverTitle: { ru: 'Год конгломерата прожит', en: 'The conglomerate year is over' },
  endlessWon: {
    ru: 'Совет удовлетворён: холдинг вырос сам и склейка выдержала. Это и есть зрелая экосистема — она больше не нуждается в чужих деньгах, чтобы становиться дороже.',
    en: 'The board is satisfied: the holding grew on its own and the glue held. That is a mature ecosystem — it no longer needs outside money to become more valuable.',
  },
  endlessLost: {
    ru: 'Планку взять не удалось. Без раундов видно, чем экосистема держалась на самом деле: рост, купленный чужими деньгами, кончается вместе с ними.',
    en: 'The bar was not cleared. Without rounds it becomes visible what the ecosystem actually ran on: growth bought with outside money ends when that money does.',
  },
  endlessRanked: { ru: 'Зачётный итог', en: 'Scored result' },
  endlessNow: { ru: 'Сейчас', en: 'Now' },
  endlessGrowth: { ru: 'Рост за год', en: 'Growth this year' },
  endlessGlue: { ru: 'Склейка', en: 'Glue' },
  endlessScaleNote: {
    ru: 'Планка акта: склейка от {glue} и рост от {growth}. Замер: сильная сборка берёт её в половине партий, слабая — никогда.',
    en: 'The act’s bar: glue from {glue} and growth from {growth}. Measured: a strong build clears it in about half its runs, a weak one never.',
  },
  endlessResultNote: {
    ru: 'Строка года конгломерата помечена тегом НОВОГРАД+ и идёт в отдельную таблицу: зачётный результат партии она не заменяет.',
    en: 'The conglomerate-year string carries the NOVOGRAD+ tag and goes to a separate table: it does not replace your scored result.',
  },
  backTitle: { ru: 'До «Конгломерата Новограда» осталось немного.', en: 'The Novograd Conglomerate is within reach.' },
  backText: {
    ru: 'Секретную концовку открывают финалы всех трёх игр набора плюс достойный НОВОГРАД. Вам не хватает: {games}. Каждый выигранный там финал заодно усиливает старт здесь.',
    en: 'The secret ending needs finales of all three games of the set plus a worthy NOVOGRAD. You are missing: {games}. Each finale you win there also strengthens your start here.',
  },
  gameOverPlayAgain: { ru: 'Сыграть ещё раз', en: 'Play again' },
  gameOverCharts: { ru: 'Посмотреть графики', en: 'See the charts' },
  deathTitle: { ru: 'Деньги на исходе', en: 'The money is running out' },
  deathText: {
    ru: 'В кассе {cash}, темп −{burn}/мес: {runway}. Раунд ещё доступен — после нуля договариваться будет поздно.',
    en: 'Cash {cash}, burn −{burn}/mo: {runway}. A round is still possible — after zero there is nothing to negotiate with.',
  },
  deathRunway: { ru: 'хватит примерно на {n} мес.', en: 'roughly {n} months left' },
  deathRaise: { ru: 'Взять {amount} (−{dilution} доли)', en: 'Raise {amount} (−{dilution} stake)' },
  deathRaised: { ru: 'Раунд закрыт: +{amount}, ваша доля {equity}.', en: 'Round closed: +{amount}, your stake {equity}.' },
  deathIgnore: { ru: 'Продолжить как есть', en: 'Carry on as is' },
  deathWaterfall: { ru: 'Последние месяцы', en: 'The final months' },
  wfTurn: { ru: 'м{n}', en: 'mo {n}' },
  wfRevenue: { ru: 'Выручка', en: 'Revenue' },
  wfCosts: { ru: 'Расходы', en: 'Costs' },
  wfProfit: { ru: 'Итог месяца', en: 'Month net' },
  wfCash: { ru: 'Касса', en: 'Cash' },
  restartTitle: { ru: 'Начать заново?', en: 'Start over?' },
  restartText: { ru: 'Текущая партия будет потеряна.', en: 'The current game will be lost.' },
  restartYes: { ru: 'Да, заново', en: 'Yes, restart' },
  restartNo: { ru: 'Отмена', en: 'Cancel' },

  // --- строка результата и рекорды ---
  resultTitle: { ru: 'Строка результата', en: 'Result string' },
  resultNote: { ru: 'Скопируйте и отправьте преподавателю: в строке зашиты код партии, счёт и контрольная сумма.', en: 'Copy it and send it to your teacher: the string carries the game code, the score and a checksum.' },
  resultCopy: { ru: 'Скопировать', en: 'Copy' },
  resultCopied: { ru: 'Строка результата скопирована.', en: 'Result string copied.' },
  recordsTitle: { ru: 'Ваши лучшие партии на этом устройстве', en: 'Your best games on this device' },
  recordsDate: { ru: 'Дата', en: 'Date' },
  recordsCode: { ru: 'Код партии', en: 'Game code' },
  recordsScore: { ru: 'Итог', en: 'Score' },
  recordsOutcome: { ru: 'Исход', en: 'Outcome' },
  recordsOutcomeFinished: { ru: 'финиш', en: 'finished' },
  recordsOutcomeBankrupt: { ru: 'банкрот', en: 'bankrupt' },
  recordsOutcomeConglomerate: { ru: '👑 конгломерат', en: '👑 conglomerate' },
  recordsYou: { ru: '← эта партия', en: '← this game' },
  lbTitle: { ru: 'Мировая таблица', en: 'World leaderboard' },

  // --- крушение ---
  crashTitle: { ru: 'Игра не смогла запуститься', en: 'The game failed to start' },
  crashText: { ru: 'Скорее всего, браузер слишком старый или сохранение осталось от другой версии. Сохранение уже сброшено — попробуйте перезапустить.', en: 'Most likely the browser is too old, or the save is left over from another version. The save has been cleared — try restarting.' },
  crashReset: { ru: 'Перезапустить', en: 'Restart' },
  crashBrowser: { ru: 'Если не помогло — пришлите текст выше: по нему видно, чего не хватает браузеру.', en: 'If that did not help, send the text above: it shows what the browser is missing.' },
};
