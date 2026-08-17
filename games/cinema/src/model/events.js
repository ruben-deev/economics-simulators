// ============================================================================
// Случайные события месяца. Часть требует решения игрока.
//
// Афиши конкурента здесь нет: она действует каждый месяц и живёт в market.js.
// Событие — то, что случается редко и требует реакции; чужие премьеры —
// постоянный фон, к которому нужно уметь готовиться заранее.
// ============================================================================

import { weightedPick } from '../../../../shared/rng.js';

export function neutralModifiers() {
  return {
    demandMult: 1,        // множитель притока новых подписчиков
    hoursMult: 1,         // множитель часов просмотра
    churnAdd: 0,          // прибавка к оттоку
    awarenessAdd: 0,      // разовый прирост узнаваемости
    oneOffCost: 0,        // разовые расходы, ₽
    // Поштучные разовые расходы: «компенсация каждому подписчику» стоит
    // по размеру базы. Большой базе дорого то, что маленькой почти бесплатно —
    // это и делает выбор состояние-зависимым.
    oneOffCostPerSub: 0,
    // Расходы, индексируемые ценой таланта: запросы звёзд растут вместе с рынком
    oneOffCostTalent: 0,
    notes: [],
  };
}

export const EVENTS = [
  {
    id: 'award', weight: 6, minMonth: 8,
    title: { ru: 'Ваш сериал взял главный приз фестиваля', en: 'Your series wins the festival’s top prize' },
    text: {
      ru: 'Пресса неделю обсуждает вашу драму. Подписки идут сами, без единого рубля маркетинга.',
      en: 'The press spends a week discussing your drama. Sign-ups arrive on their own, without a rouble of marketing.',
    },
    effects: { awarenessAdd: 0.07, demandMult: 1.15 },
    lesson: {
      ru: 'Репутационный контент окупается не просмотрами, а стоимостью привлечения: о вас говорят бесплатно.',
      en: 'Prestige content pays back not in views but in acquisition cost: people talk about you for free.',
    },
  },
  {
    id: 'leak', weight: 5, minMonth: 6,
    title: { ru: 'Премьера утекла в сеть', en: 'The premiere leaks online' },
    text: {
      ru: 'За сутки до выхода все серии оказались на пиратских сайтах.',
      en: 'A day before release, every episode turned up on pirate sites.',
    },
    effects: { demandMult: 0.82, hoursMult: 0.93 },
    lesson: {
      ru: 'Пиратство бьёт не по выручке напрямую, а по всплеску подписок — а всплеск и есть то, ради чего снимали.',
      en: 'Piracy does not hit revenue directly, it hits the sign-up spike — and the spike is the whole reason the show was made.',
    },
  },
  {
    id: 'outage', weight: 6, minMonth: 4,
    title: { ru: 'Сбой в вечер премьеры', en: 'Outage on premiere night' },
    text: {
      ru: 'Плеер лёг на три часа ровно тогда, когда все пришли смотреть.',
      en: 'The player went down for three hours exactly when everyone arrived to watch.',
    },
    effects: { churnAdd: 0.02, hoursMult: 0.9, oneOffCost: 25_000_000 },
    lesson: {
      ru: 'Надёжность — часть продукта. Зритель прощает слабый каталог, но не прощает чёрный экран в вечер, который он ждал.',
      en: 'Reliability is part of the product. Viewers forgive a thin catalogue; they do not forgive a black screen on the night they were waiting for.',
    },
  },
  {
    id: 'cdnPrice', weight: 5, minMonth: 5,
    title: { ru: 'Трафик подорожал', en: 'Bandwidth gets more expensive' },
    text: {
      ru: 'Провайдер пересмотрел тарифы на исходящий трафик.',
      en: 'Your provider has repriced outbound traffic.',
    },
    effects: { cdnMult: 1.25 },
    lesson: {
      ru: 'Единственная переменная статья в подписочном бизнесе растёт вместе с лояльностью аудитории.',
      en: 'The only variable cost line in a subscription business grows in step with audience loyalty.',
    },
  },
  {
    id: 'password', weight: 5, minMonth: 12,
    title: { ru: 'Волна общих паролей', en: 'Password sharing spreads' },
    text: {
      ru: 'Одной подпиской пользуются в трёх квартирах. Часы растут, деньги — нет.',
      en: 'One subscription is being used in three flats. Hours grow, money does not.',
    },
    effects: { hoursMult: 1.18, demandMult: 0.9 },
    lesson: {
      ru: 'Часы просмотра — не выручка. В подписке они чистый расход, пока не превратились в новую подписку.',
      en: 'Watch hours are not revenue. In a subscription business they are pure cost until they turn into another subscription.',
    },
  },

  // --- События с выбором ---
  {
    id: 'starDeal', weight: 6, minMonth: 9,
    title: { ru: 'Звезда просит долю', en: 'A star asks for a cut' },
    text: {
      ru: 'Актёр, на котором держится ваш главный проект, требует пересмотреть контракт перед вторым сезоном.',
      en: 'The actor your flagship project rests on wants the contract reopened before season two.',
    },
    lesson: {
      ru: 'Переговорная сила таланта — причина, по которой себестоимость успешного сериала растёт быстрее его аудитории.',
      en: 'The bargaining power of talent is why a successful show’s cost grows faster than its audience.',
    },
    options: [
      {
        label: { ru: 'Заплатить (260 млн ₽ × индекс таланта)', en: 'Pay up ($2.6M × talent index)' },
        detail: { ru: 'Запрос звезды растёт вместе с рынком: в начале партии это 260 млн, к концу — вдвое-втрое больше.', en: 'The star’s ask grows with the market: $2.6M early in the game, two or three times that by the end.' },
        effects: { oneOffCostTalent: 260_000_000, awarenessAdd: 0.03 },
      },
      {
        label: { ru: 'Заменить актёра', en: 'Recast the role' },
        detail: { ru: 'Экономим деньги, но зрители замечают и уходят. Чем дороже рынок таланта, тем чаще замена — правильный ответ.', en: 'Saves the money, but viewers notice and leave. The pricier the talent market, the more often recasting is the right call.' },
        effects: { churnAdd: 0.010, demandMult: 0.98 },
      },
      {
        // Протокол «СКРЕПКА»: экономика — точная копия замены актёра,
        // различие чисто сюжетное (сравнимость мировой таблицы священна).
        secret: true,
        label: { ru: 'Сгенерировать актёра нейросетью «СКРЕПКА»', en: 'Have the PAPERCLIP neural network generate an actor' },
        detail: {
          ru: 'Дешевле живой звезды, гонораров не просит. Зрители замечают, что герой моргает строго раз в 4,7 секунды, — часть уходит.',
          en: 'Cheaper than a living star and never asks for a fee. Viewers notice the hero blinks exactly once every 4.7 seconds — some leave.',
        },
        effects: { churnAdd: 0.010, demandMult: 0.98 },
      },
    ],
  },
  {
    id: 'sportsRights', weight: 5, minMonth: 10,
    title: { ru: 'На рынок вышли права на спорт', en: 'Sports rights hit the market' },
    text: {
      ru: 'Продаются права на трансляции главной лиги страны. Аудитория огромная, цена — тоже.',
      en: 'Broadcast rights to the country’s main league are for sale. The audience is enormous; so is the price.',
    },
    lesson: {
      ru: 'Спорт приводит аудиторию мгновенно и уходит вместе с правами. Это аренда трафика, а не строительство актива.',
      en: 'Sport brings an audience instantly and leaves when the rights do. It is renting traffic, not building an asset.',
    },
    options: [
      {
        label: { ru: 'Купить права (500 млн ₽)', en: 'Buy the rights ($5M)' },
        detail: { ru: 'Мощный приток и рост часов, но деньги ушли безвозвратно.', en: 'A strong inflow and more hours, but the money is gone for good.' },
        effects: { oneOffCost: 500_000_000, demandMult: 1.16, hoursMult: 1.08, awarenessAdd: 0.05 },
      },
      {
        label: { ru: 'Пропустить', en: 'Pass' },
        detail: { ru: 'Права уходят конкуренту, часть зрителей — за ними.', en: 'The rights go to a rival, and some viewers follow them.' },
        effects: { churnAdd: 0.010 },
      },
    ],
  },
  {
    id: 'boardPressure', weight: 5, minMonth: 14,
    title: { ru: 'Совет директоров требует роста', en: 'The board demands growth' },
    text: {
      ru: 'Инвесторы хотят видеть прибавку подписчиков к следующему кварталу и намекают на снижение цены.',
      en: 'Investors want subscriber growth by next quarter and are hinting at a price cut.',
    },
    lesson: {
      ru: 'Подписчик, пришедший на скидку, уходит при первом повышении. Рост базы и рост выручки — разные вещи.',
      en: 'A subscriber who arrived for a discount leaves at the first price rise. Growing the base and growing revenue are different things.',
    },
    options: [
      {
        label: { ru: 'Устроить распродажу (80 ₽ скидки на подписчика)', en: 'Run a sale ($0.80 off per subscriber)' },
        detail: { ru: 'Скидка достаётся и действующей базе: маленькой базе распродажа почти бесплатна, большой — очень дорога.', en: 'The discount reaches the existing base too: nearly free with a small base, very expensive with a large one.' },
        effects: { oneOffCostPerSub: 80, demandMult: 1.12, churnAdd: 0.01, valuationBonus: 0.005 },
      },
      {
        label: { ru: 'Отстоять цену', en: 'Hold the price' },
        detail: { ru: 'Инвесторы недовольны, оценка ниже.', en: 'Investors are unhappy and the valuation suffers.' },
        effects: { valuationBonus: -0.005 },
      },
      {
        // Протокол «СКРЕПКА»: экономика — копия «отстоять цену»
        secret: true,
        label: { ru: 'Пусть с советом поговорит нейросеть «СКРЕПКА»', en: 'Let the PAPERCLIP neural network talk to the board' },
        detail: {
          ru: 'СКРЕПКА вежливо объяснила, что скидка — это кредит у собственной выручки. Совет недоволен, но впечатлён. Оценка ниже.',
          en: 'PAPERCLIP politely explained that a discount is a loan taken from your own revenue. The board is unhappy but impressed. Valuation down.',
        },
        effects: { valuationBonus: -0.005 },
      },
    ],
  },
  {
    id: 'dataLeak', weight: 4, minMonth: 16,
    title: { ru: 'Утечка данных зрителей', en: 'Viewer data leak' },
    text: {
      ru: 'В сеть попала база истории просмотров. Журналисты уже пишут, что именно смотрели ваши подписчики.',
      en: 'A viewing-history database has surfaced online. Journalists are already writing about what your subscribers actually watched.',
    },
    lesson: {
      ru: 'Данные, на которых учатся ваши алгоритмы, — это ещё и обязательство. Оно не отражается в P&L, пока не случится утечка.',
      en: 'The data your algorithms learn from is also a liability. It never shows up in the P&L until the day it leaks.',
    },
    options: [
      {
        label: { ru: 'Признать и компенсировать (60 ₽ на подписчика)', en: 'Own it and compensate ($0.60 per subscriber)' },
        detail: { ru: 'Компенсация каждому: цена растёт вместе с базой. Маленькому сервису честность почти ничего не стоит.', en: 'Compensation for everyone: the price grows with the base. For a small service honesty costs almost nothing.' },
        effects: { oneOffCostPerSub: 60, churnAdd: 0.006 },
      },
      {
        label: { ru: 'Промолчать', en: 'Say nothing' },
        detail: { ru: 'Дешевле сейчас, дороже потом — и тем дороже, чем заметнее вы стали.', en: 'Cheaper now, more expensive later — and the more visible you are, the more expensive it gets.' },
        effects: { churnAdd: 0.008, awarenessAdd: -0.01, valuationBonus: -0.005 },
      },
    ],
  },
];

export function eventById(id) {
  return EVENTS.find((e) => e.id === id) ?? null;
}

// Вероятность события ~30% в месяц. Каждое событие случается не больше
// раза за партию: «права на лигу» трижды за игру (аудит 2026-08, жалоба
// игрока) превращали сюжетный выбор в лотерейный билет — прежний rollEvent
// вообще не помнил показанного. Пул к концу партии тает — это нормально:
// поздние месяцы и так решают накопленным, а не событиями.
export function rollEvent(rng, month, flags = {}, seenIds = []) {
  if (month < 3) return null;
  if (rng() > 0.30) return null;
  const seen = new Set(seenIds);
  const pool = EVENTS.filter((e) => month >= (e.minMonth ?? 0) && !seen.has(e.id));
  const picked = weightedPick(rng, pool);
  return picked ? { ...picked } : null;
}

export function applyEvent(mods, event, optionIndex) {
  if (!event) return mods;
  const effects = { ...(event.effects ?? {}) };
  if (event.options && event.options[optionIndex]) {
    Object.assign(effects, event.options[optionIndex].effects);
  }
  for (const [key, value] of Object.entries(effects)) {
    if (key === 'demandMult' || key === 'hoursMult' || key === 'cdnMult') {
      mods[key] = (mods[key] ?? 1) * value;
    } else if (key === 'notes') {
      continue;
    } else if (typeof value === 'number' && key in mods) {
      mods[key] += value;
    } else {
      mods[key] = value;
    }
  }
  mods.notes.push(event.id);
  return mods;
}
