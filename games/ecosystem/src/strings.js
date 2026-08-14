// ============================================================================
// Строки интерфейса игры «НОВОГРАД». Пары { ru, en }.
// Регистрируются в ядре локализации вызовом setStrings() при старте.
// ============================================================================

export const STRINGS = {
  // --- шапка ---
  brandTitle: { ru: 'НОВОГРАД', en: 'NOVOGRAD' },
  brandSub: { ru: 'экосистемный симулятор · эндгейм набора', en: 'ecosystem simulator · the endgame of the set' },
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
  vertFuture: { ru: 'после одобрения прототипа', en: 'after the prototype is approved' },
  vertCloseHint: { ru: 'нажмите, чтобы закрыть вертикаль (клиенты и парк будут распущены)', en: 'click to shut the vertical down (customers and fleet are released)' },
  vertLockedToast: {
    ru: 'Совет пока не согласует запуск: нужен месяц {month} и прибыльная еда {n} месяца подряд. Заявка сохранена.',
    en: 'The board will not approve the launch yet: you need month {month} and food profitable for {n} straight months. The request is saved.',
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
    ru: 'Доставка еды победила: рынок Новограда насыщен, расти числом клиентов больше некуда. В казне {cash}. Совет ждёт экосистему. План на первые ходы:',
    en: 'Food delivery has won: Novograd’s market is saturated and there is no one left to acquire. The treasury holds {cash}. The board expects an ecosystem. A plan for the first moves:',
  },
  reportStart1: {
    ru: 'Посмотрите на стартовый актив: сколько он приносит и как быстро тает база (вкладка «P&L» и панель «Вертикали»).',
    en: 'Look at your starting asset: what it earns and how fast the base is thinning (the P&L tab and the Verticals panel).',
  },
  reportStart2: {
    ru: 'Решите главный вопрос партии: когда открывать такси. Ворота совета — с месяца {month}, и «СитиДрайв» ответит войной.',
    en: 'Settle the game’s main question: when to open the taxi vertical. The board gate opens at month {month}, and CityDrive will answer with a war.',
  },
  reportStart3: {
    ru: 'После запуска сравнивайте два канала роста такси: холодный маркетинг и кросс-селл из базы еды (вкладка «База»).',
    en: 'After launch, compare taxi’s two growth channels: cold marketing and cross-sell from the food base (the Base tab).',
  },
  reportStart4: {
    ru: 'Следите за ARPU холдинга в шапке: после насыщения растёт не число клиентов, а выручка с каждого.',
    en: 'Watch holding ARPU in the header: after saturation it is revenue per customer that grows, not the customer count.',
  },
  reportTitle: { ru: 'Итоги месяца {month}', en: 'Month {month} results' },
  reportHeadStats: {
    ru: 'выручка {revenue} · еда {food} · такси {taxi}',
    en: 'revenue {revenue} · food {food} · taxi {taxi}',
  },
  reportDelta: {
    ru: 'К прошлому месяцу: выручка {revenue}, прибыль {profit}, касса {cash}.',
    en: 'Versus last month: revenue {revenue}, profit {profit}, cash {cash}.',
  },
  statRevenue: { ru: 'Выручка холдинга', en: 'Holding revenue' },
  statRevenueSub: { ru: 'еда {food} · такси {taxi}', en: 'food {food} · taxi {taxi}' },
  statProfit: { ru: 'Прибыль', en: 'Profit' },
  statProfitSub: { ru: 'вклад {contribution} − расходы {opex}', en: 'contribution {contribution} − opex {opex}' },
  statUnique: { ru: 'Клиенты холдинга', en: 'Holding customers' },
  statUniqueSub: { ru: 'еда {food} · такси {taxi} · оба {both}', en: 'food {food} · taxi {taxi} · both {both}' },
  statArpu: { ru: 'ARPU холдинга', en: 'Holding ARPU' },
  statArpuSub: { ru: 'выручка на уникального клиента', en: 'revenue per unique customer' },
  statTaxi: { ru: 'Такси', en: 'Taxi' },
  statTaxiSub: { ru: '{drivers} водителей · подача {fill}', en: '{drivers} drivers · pickup fill {fill}' },
  statTaxiOff: { ru: 'не запущено', en: 'not launched' },
  statCross: { ru: 'Кросс-селл за месяц', en: 'Cross-sell this month' },
  statCrossSub: { ru: 'клиент за {cac} против {cold} холодного', en: 'a customer for {cac} vs {cold} cold' },
  statCrossOff: { ru: 'канал не включён', en: 'channel not in use' },
  statMulti: { ru: 'Два и более сервисов', en: 'Two or more services' },
  statMultiSub: { ru: 'премия инвестора за склейку: +{premium}', en: 'the investor’s glue premium: +{premium}' },
  statFocus: { ru: 'Фокус менеджмента', en: 'Management focus' },
  statFocusSub: { ru: 'штраф к исполнению −{penalty}', en: 'execution penalty −{penalty}' },
  statFocusOk: { ru: 'исполнение не размыто', en: 'execution undiluted' },

  launchNote: {
    ru: 'Запущено такси: разовый платёж {cost}. «СитиДрайв» объявил войну — {months} месяцев демпинга.',
    en: 'Taxi launched: one-off cost {cost}. CityDrive declared war — {months} months of dumping.',
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
    ru: 'Война со «СитиДрайвом»: приток такси урезан и цены продавлены ещё {months} мес. Это конечно — но каждый месяц войны стоит денег.',
    en: 'The CityDrive war: taxi intake is cut and fares pushed down for {months} more months. It is finite — but every month of it costs money.',
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
    ru: 'Монетизация {take} — за порогом: клиенты еды уходят к конкуренту ускоренно, и вместе с ними тает пул кросс-селла.',
    en: 'Monetisation at {take} is past the threshold: food customers are fleeing — and the cross-sell pool thins with them.',
  },
  alertFoodShrinking: {
    ru: 'База еды сжимается: −{lost} против +{gained} за месяц. В насыщенном рынке вернуть дороже, чем удержать.',
    en: 'The food base is shrinking: −{lost} against +{gained} this month. In a saturated market re-acquiring costs more than retaining.',
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
  alertProfit: { ru: 'Холдинг прибыален: +{value} за месяц.', en: 'The holding is profitable: +{value} this month.' },
  jumpGo: { ru: 'показать →', en: 'show →' },

  // --- новости ---
  newsPanel: { ru: 'Город и рынок', en: 'City and market' },
  newsEmpty: { ru: 'Тихий месяц: рынок ждёт вашего следующего шага.', en: 'A quiet month: the market is waiting for your next move.' },
  newsGateOpen: {
    ru: 'Совет готов согласовать запуск такси: стартовый актив прибыльный, ворота открыты.',
    en: 'The board is ready to approve the taxi launch: the starting asset is profitable, the gate is open.',
  },
  newsWarStarted: { ru: '«СитиДрайв» начал войну: демпинг и перехват вашей рекламы.', en: 'CityDrive opened the war: dumping and intercepting your ads.' },
  newsWarLeft: { ru: 'Война со «СитиДрайвом»: ещё {months} мес. демпинга.', en: 'The CityDrive war: {months} more months of dumping.' },
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

  // --- графики ---
  chartClients: { ru: 'Клиенты', en: 'Customers' },
  chartClientsCaption: {
    ru: 'Общая база — главный ресурс экосистемы: еда кормит такси клиентами, пересечение удерживает обоих.',
    en: 'The shared base is the ecosystem’s main resource: food feeds taxi with customers, the overlap retains both.',
  },
  chartMoney: { ru: 'Деньги', en: 'Money' },
  chartMoneyCaption: {
    ru: 'Выручка, вклад и прибыль холдинга. Пока такси в инвестиционной фазе, прибыль держит только дисциплина еды.',
    en: 'Holding revenue, contribution and profit. While taxi is in its investment phase, only food discipline keeps profit alive.',
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
    ru: 'Сумма частей: зрелая еда и растущее такси оцениваются разными множителями, премия — за клиентов двух сервисов.',
    en: 'Sum of parts: mature food and growing taxi carry different multiples; the premium is for two-service customers.',
  },
  chartAcq: { ru: 'Привлечение', en: 'Acquisition' },
  chartAcqCaption: {
    ru: 'Два канала роста такси: кросс-селл из своей базы и холодный маркетинг. У кросс-селла ниже цена, у маркетинга — выше потолок.',
    en: 'Taxi’s two growth channels: cross-sell from your own base and cold marketing. Cross-sell is cheaper; marketing scales higher.',
  },
  seriesFood: { ru: 'Еда', en: 'Food' },
  seriesTaxi: { ru: 'Такси', en: 'Taxi' },
  seriesBoth: { ru: 'Оба сервиса', en: 'Both services' },
  seriesUnique: { ru: 'Уникальные', en: 'Unique' },
  seriesRevenue: { ru: 'Выручка', en: 'Revenue' },
  seriesContribution: { ru: 'Вклад', en: 'Contribution' },
  seriesProfit: { ru: 'Прибыль', en: 'Profit' },
  seriesArpu: { ru: 'ARPU, ₽/мес', en: 'ARPU, ₽/mo' },
  seriesValueFood: { ru: 'Оценка еды', en: 'Food value' },
  seriesValueTaxi: { ru: 'Оценка такси', en: 'Taxi value' },
  seriesValueTotal: { ru: 'Оценка холдинга', en: 'Holding value' },
  seriesCrossAcq: { ru: 'Кросс-селл, чел/мес', en: 'Cross-sell, people/mo' },
  seriesColdAcq: { ru: 'Маркетинг, чел/мес', en: 'Marketing, people/mo' },
  chartChangesTitle: { ru: 'Решения:', en: 'Decisions:' },
  chartChangeItem: { ru: 'м{turn} — {what}', en: 'mo {turn} — {what}' },
  chartChangeVerticals: { ru: 'вертикали', en: 'verticals' },
  pnlEmpty: { ru: 'Сыграйте первый месяц — появится динамика.', en: 'Play the first month and the trends will appear.' },

  // --- правая колонка: оценка (sum-of-parts) ---
  tabSop: { ru: 'Оценка', en: 'Valuation' },
  tabPnl: { ru: 'P&L', en: 'P&L' },
  tabBase: { ru: 'База', en: 'Base' },
  tabHelp: { ru: 'Справка', en: 'How to play' },
  sopIntro: {
    ru: 'Инвестор оценивает холдинг по сумме частей: каждая вертикаль — своим множителем от годовой выручки. Зрелая еда стоит как дойная корова, растущее такси — как история роста.',
    en: 'Investors value the holding as a sum of parts: each vertical gets its own multiple of annualised revenue. Mature food is priced like a cash cow, growing taxi like a growth story.',
  },
  sopColPart: { ru: 'Вертикаль', en: 'Vertical' },
  sopColRunRate: { ru: 'Выручка, год', en: 'Revenue, yr' },
  sopColGrowth: { ru: 'Рост', en: 'Growth' },
  sopColMargin: { ru: 'Маржа', en: 'Margin' },
  sopColValue: { ru: 'Оценка', en: 'Value' },
  sopPartFood: { ru: 'Доставка еды', en: 'Food delivery' },
  sopPartTaxi: { ru: 'Такси', en: 'Taxi' },
  sopZoo: { ru: 'убыточна и не растёт — считается обязательством', en: 'loss-making and not growing — counted as a liability' },
  sopPremium: { ru: 'Премия за кросс-селл ({share} клиентов с 2+ сервисами)', en: 'Cross-sell premium ({share} customers on 2+ services)' },
  sopBonus: { ru: 'Репутация у совета и инвесторов', en: 'Standing with the board and investors' },
  sopTotal: { ru: 'Оценка холдинга', en: 'Holding valuation' },
  sopNote: {
    ru: 'Премию платят только за замеряемую склейку — долю клиентов двух и более сервисов. Убыточная вертикаль без роста — «зоопарк»: инвестор вычитает её годовой burn.',
    en: 'The premium is paid only for measurable glue — the share of customers on two or more services. A loss-making vertical without growth is a “zoo”: investors subtract its annual burn.',
  },

  // --- правая колонка: P&L ---
  pnlRevenueFood: { ru: 'Выручка еды', en: 'Food revenue' },
  pnlRevenueTaxi: { ru: 'Выручка такси', en: 'Taxi revenue' },
  pnlRevenue: { ru: 'Выручка холдинга', en: 'Holding revenue' },
  pnlContribFood: { ru: 'Вклад еды', en: 'Food contribution' },
  pnlContribTaxi: { ru: 'Вклад такси', en: 'Taxi contribution' },
  pnlContribution: { ru: 'Вклад', en: 'Contribution' },
  pnlFixedFood: { ru: 'Фикс еды', en: 'Food fixed costs' },
  pnlFixedTaxi: { ru: 'Фикс такси', en: 'Taxi fixed costs' },
  pnlHq: { ru: 'Управление холдинга', en: 'Holding HQ' },
  pnlMgmt: { ru: 'Управляющая компания', en: 'Management company' },
  pnlCrossSell: { ru: 'Кросс-селл', en: 'Cross-sell' },
  pnlFoodOps: { ru: 'Сервис еды', en: 'Food service' },
  pnlFoodMarketing: { ru: 'Возврат клиентов еды', en: 'Food win-back' },
  pnlTaxiSupply: { ru: 'Привлечение водителей', en: 'Driver acquisition' },
  pnlTaxiMarketing: { ru: 'Маркетинг такси', en: 'Taxi marketing' },
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
  baseFood: { ru: 'Клиенты еды', en: 'Food customers' },
  baseTaxi: { ru: 'Клиенты такси', en: 'Taxi customers' },
  baseBoth: { ru: 'Оба сервиса', en: 'Both services' },
  baseUnique: { ru: 'Уникальных клиентов', en: 'Unique customers' },
  baseMultiShare: { ru: 'Доля с двумя и более сервисами', en: 'Share on two or more services' },
  baseReturnPool: { ru: 'Пул возврата еды (недавно ушли)', en: 'Food win-back pool (recent leavers)' },
  baseAcqTitle: { ru: 'Каналы привлечения за месяц', en: 'Acquisition channels this month' },
  baseColChannel: { ru: 'Канал', en: 'Channel' },
  baseColPeople: { ru: 'Пришло', en: 'Arrived' },
  baseColCac: { ru: 'Цена клиента', en: 'Cost per customer' },
  baseChCross: { ru: 'Кросс-селл (еда → такси)', en: 'Cross-sell (food → taxi)' },
  baseChCrossBack: { ru: 'Кросс-селл (такси → еда)', en: 'Cross-sell (taxi → food)' },
  baseChCold: { ru: 'Маркетинг такси (холодный)', en: 'Taxi marketing (cold)' },
  baseChWinback: { ru: 'Возврат в еду', en: 'Food win-back' },
  baseChOrganic: { ru: 'Органика еды', en: 'Food organic' },
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
    ru: 'Вы — генеральный директор компании, победившей на своём рынке (в прототипе — доставка еды из НОВОЕДЫ). Рынок насыщен, и расти дальше можно только выручкой с клиента: новые вертикали, кросс-селл, общая база. Ход — месяц, партия — три года.',
    en: 'You run the company that won its market (in this prototype — food delivery from NOVOEDA). The market is saturated, so further growth can only come from revenue per customer: new verticals, cross-sell, a shared base. A turn is a month; the game is three years.',
  },
  helpAssetTitle: { ru: 'Стартовый актив — «класс персонажа»', en: 'The starting asset is your character class' },
  helpAssetText: {
    ru: 'Стартовый актив задаёт форму экосистемы: у доставки дешёвая синергия с е-комом (курьеры уже ездят по городу), у стриминга была бы подписка, у билетов — партнёрская сеть. Amazon, Яндекс и Сбер построили разные экосистемы, потому что начинали с разного. В прототипе играбелен один старт; остальные добавятся.',
    en: 'The starting asset dictates the ecosystem’s shape: delivery has cheap synergy with e-commerce (the couriers already roam the city), streaming would have subscriptions, ticketing a partner network. Amazon, Yandex and Sber built different ecosystems because they started from different assets. This prototype ships one start; the others follow.',
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
    ru: 'В такси уже десять лет живёт «СитиДрайв». На ваш вход он ответит конечной войной: демпинг режет ваш приток и продавливает цены. Ранний вход платит войну на маленькой базе, поздний — теряет месяцы роста. Тайминг — и есть решение.',
    en: 'CityDrive has run the taxi market for a decade. It answers your entry with a finite war: dumping cuts your intake and pushes fares down. Enter early and you pay the war on a small base; enter late and you lose months of growth. The timing is the decision.',
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
  welcomeRole: { ru: 'Вы — генеральный директор компании, которая уже выиграла свой рынок: доставка еды «Новоеда» победила, город насыщен, расти числом клиентов больше некуда. Эта партия начинается там, где закончилась прошлая игра.', en: 'You are the CEO of a company that has already won its market: Novoeda food delivery prevailed, the city is saturated, and there is no one left to acquire. This game starts where the previous one ended.' },
  welcomeTurn: { ru: 'Ход — месяц, партия — три года. Вы управляете холдингом на уровне портфеля: несколько рычагов на вертикаль, микроменеджмент остался в исходных играх.', en: 'A turn is a month; the game is three years. You run the holding at portfolio level: a few levers per vertical — the micromanagement stayed in the original games.' },
  welcomeTension: { ru: 'Главное напряжение: дожимать насыщенную корову или строить вторую ногу — такси, кросс-селл, общая база. Деньги сейчас против выручки с клиента завтра; и на ваш вход хозяин рынка ответит войной.', en: 'The core tension: milk the saturated cow, or build a second leg — taxi, cross-sell, the shared base. Money now versus revenue per customer later; and the market’s owner will answer your entry with a war.' },
  welcomeGoal: { ru: 'Счёт партии — стоимость вашей доли: (оценка холдинга по сумме частей + касса) × доля. Инвестор платит премию за клиентов двух и более сервисов.', en: 'The score is the value of your stake: (sum-of-parts valuation + cash) × your stake. Investors pay a premium for customers on two or more services.' },
  welcomeHint: { ru: 'Начните с вкладки «База»: посмотрите, из чего состоит общая база клиентов, — и следите за ARPU холдинга в шапке.', en: 'Start with the Base tab: see what the shared customer base is made of — and keep an eye on holding ARPU in the header.' },
  welcomeStart: { ru: 'Начать партию', en: 'Start the game' },
  welcomeMore: { ru: 'Подробнее', en: 'More' },
  welcomeBest: { ru: 'Ваш рекорд на этом устройстве: {score}.', en: 'Your best on this device: {score}.' },
  welcomeAsset: { ru: 'Стартовый актив', en: 'Starting asset' },
  welcomeAssetNote: { ru: 'В прототипе один старт — доставка. Старты от КИНОРЕКИ и БИЛЕТВИЛЯ добавятся следующими фазами: форма экосистемы у них будет другой.', en: 'The prototype ships one start — delivery. Starts from KINOREKA and BILETVILLE arrive in later phases: their ecosystems will take different shapes.' },
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
  gradeScale: { ru: 'Шкала: «экосистема состоялась» — итог от {a}, «крепкий холдинг» — от {b}, «выжили» — от {c}. Доведённые стратегии заканчивают партию выше {a} — выжить легко, выиграть нет.', en: 'The scale: “a true ecosystem” starts at {a}, “a solid holding” at {b}, “survived” at {c}. Polished strategies finish above {a} — surviving is easy, winning is not.' },
  gameOverLastMonth: {
    ru: 'Последний месяц: выручка {revenue}, ARPU {arpu} ₽, клиентов {unique}, из них с двумя сервисами {multi}.',
    en: 'Final month: revenue {revenue}, ARPU ₽{arpu}, {unique} customers, {multi} of them on both services.',
  },
  gameOverQuestions: {
    ru: 'Вопросы для разбора: когда вы запустили такси и почему именно тогда? Сколько стоил клиент из кросс-селла против холодного? Что случилось бы с оценкой, если бы вы просто дожимали еду все три года?',
    en: 'Debrief questions: when did you launch taxi, and why then? What did a cross-sell customer cost versus cold? What would the valuation be had you simply milked food for all three years?',
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
  recordsYou: { ru: '← эта партия', en: '← this game' },
  lbTitle: { ru: 'Мировая таблица', en: 'World leaderboard' },

  // --- крушение ---
  crashTitle: { ru: 'Игра не смогла запуститься', en: 'The game failed to start' },
  crashText: { ru: 'Скорее всего, браузер слишком старый или сохранение осталось от другой версии. Сохранение уже сброшено — попробуйте перезапустить.', en: 'Most likely the browser is too old, or the save is left over from another version. The save has been cleared — try restarting.' },
  crashReset: { ru: 'Перезапустить', en: 'Restart' },
  crashBrowser: { ru: 'Если не помогло — пришлите текст выше: по нему видно, чего не хватает браузеру.', en: 'If that did not help, send the text above: it shows what the browser is missing.' },
};
