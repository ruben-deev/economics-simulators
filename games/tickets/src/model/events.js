// ============================================================================
// События месяца.
//
// Часть просто случается — это фон, на котором проверяется запас прочности.
// Часть требует решения, и у каждого решения есть цена в обе стороны:
// «правильного» варианта нет, есть выбор, чем платить.
// ============================================================================

export function neutralModifiers() {
  return {
    demandMult: 1,       // множитель спроса зрителей
    conversionMult: 1,   // множитель конверсии
    orgJoinMult: 1,      // множитель притока организаторов
    orgAngerAdd: 0,      // прибавка к оттоку организаторов
    trustAdd: 0,         // разовое изменение доверия
    awarenessAdd: 0,     // разовый прирост охвата, доля потенциала
    oneOffCost: 0,       // разовые расходы, ₽
    oneOffGain: 0,       // разовые поступления, ₽
    // Уступка как доля месячного оборота: цена решения растёт вместе с вами.
    // Скидка крупному промоутеру почти бесплатна маленькому сервису и очень
    // дорога большому — это и делает выбор состояние-зависимым.
    gmvShareCost: 0,
    notes: [],
  };
}

export const EVENTS = [
  {
    id: 'cityFestival', weight: 7, minMonth: 3,
    title: { ru: 'Городской фестиваль', en: 'A city festival' },
    text: {
      ru: 'Мэрия открыла летнюю программу, и в городе внезапно много событий сразу.',
      en: 'The city hall opened its summer programme, and suddenly the city is full of events at once.',
    },
    lesson: {
      ru: 'Спрос на билеты — производная от афиши, а не от вашего маркетинга. Иногда афишу делает кто-то другой.',
      en: 'Ticket demand is a derivative of what is on, not of your marketing. Sometimes someone else makes the listings.',
    },
    effects: { demandMult: 1.16, awarenessAdd: 0.012 },
  },
  {
    id: 'rivalOutage', weight: 5, minMonth: 6,
    title: { ru: 'У конкурента упал сайт', en: 'The rival site went down' },
    text: {
      ru: 'Старт продаж крупного тура у соседа закончился ошибкой оплаты у половины покупателей. Люди пошли искать альтернативу.',
      en: 'A big tour on-sale at the rival ended in payment errors for half the buyers. People went looking for an alternative.',
    },
    lesson: {
      ru: 'В двустороннем рынке чужая авария — это ваш бесплатный маркетинг. Ровно до следующего месяца.',
      en: 'In a two-sided market someone else’s outage is free marketing for you. Exactly until next month.',
    },
    effects: { awarenessAdd: 0.02, orgJoinMult: 1.25 },
  },
  {
    id: 'weatherOff', weight: 5, minMonth: 4,
    title: { ru: 'Затяжная непогода', en: 'A long spell of bad weather' },
    text: {
      ru: 'Вторую неделю льёт. Открытые площадки переносят события, зрители не выходят из дома.',
      en: 'It has been raining for two weeks. Open-air venues are postponing, and nobody leaves the house.',
    },
    lesson: {
      ru: 'Оборот билетного сервиса зависит от вещей, на которые он не влияет вообще. Запас прочности — не роскошь.',
      en: 'A ticketing service’s turnover depends on things it does not influence at all. A buffer is not a luxury.',
    },
    effects: { demandMult: 0.86 },
  },
  {
    id: 'youthProgram', weight: 5, minMonth: 5,
    title: { ru: 'Программа для молодёжи', en: 'A youth ticket programme' },
    text: {
      ru: 'Государство запускает субсидию на билеты для студентов. Чтобы участвовать, нужно доработать оплату и отчётность.',
      en: 'The state is launching a subsidy for student tickets. Taking part means reworking payments and reporting.',
    },
    lesson: {
      ru: 'Чужие деньги в спросе выглядят подарком, пока не посчитаешь стоимость интеграции и то, что она делает вас зависимым.',
      en: 'Someone else’s money in demand looks like a gift until you count the integration cost — and the dependency it creates.',
    },
    options: [
      {
        label: { ru: 'Подключиться', en: 'Join the programme' },
        detail: { ru: 'Разово 80 млн ₽ на доработку. Спрос заметно вырастет.', en: 'A one-off $800K of work. Demand grows noticeably.' },
        effects: { oneOffCost: 80_000_000, demandMult: 1.11, awarenessAdd: 0.015 },
      },
      {
        label: { ru: 'Пропустить', en: 'Skip it' },
        detail: { ru: 'Ничего не тратим. Зритель уйдёт туда, где программа есть.', en: 'Costs nothing. The buyer goes where the programme works.' },
        effects: { demandMult: 0.97, orgJoinMult: 0.95 },
      },
    ],
  },
  {
    id: 'promoterDemand', weight: 7, minMonth: 6,
    title: { ru: 'Промоутер требует условий', en: 'A promoter demands terms' },
    text: {
      ru: 'Крупнейший из ваших промоутеров пришёл с готовым предложением конкурента и хочет комиссию вдвое ниже.',
      en: 'Your biggest promoter arrived with a written rival offer and wants half the commission.',
    },
    lesson: {
      ru: 'Переговорная сила на стороне того, кто приносит оборот. Концентрация оборота в одном клиенте — это его рычаг, а не ваш.',
      en: 'Bargaining power sits with whoever brings the turnover. Concentration in one client is their lever, not yours.',
    },
    options: [
      {
        label: { ru: 'Согласиться (уступка ~5% месячного оборота)', en: 'Agree (a concession of ~5% of monthly turnover)' },
        detail: { ru: 'Цена уступки растёт вместе с вашим оборотом: маленькому сервису она почти ничего не стоит, большому — очень дорога.', en: 'The concession grows with your turnover: nearly free for a small service, very expensive for a big one.' },
        effects: { gmvShareCost: 0.05, orgJoinMult: 1.1 },
      },
      {
        label: { ru: 'Отказать', en: 'Refuse' },
        detail: { ru: 'Он уходит и уводит часть коллег. Терпимо, пока организаторов мало; больно, когда их сотни.', en: 'He leaves and takes colleagues with him. Bearable while you have few organisers; painful once you have hundreds.' },
        effects: { orgAngerAdd: 0.035, demandMult: 0.96 },
      },
      {
        // Протокол «СКРЕПКА»: экономика — копия отказа
        secret: true,
        label: { ru: 'Пусть переговоры ведёт нейросеть «СКРЕПКА»', en: 'Let the PAPERCLIP neural network negotiate' },
        detail: {
          ru: 'СКРЕПКА торговалась девять часов и свела уступки к нулю. Промоутер ушёл, хлопнув дверью, — но с уважением.',
          en: 'PAPERCLIP bargained for nine hours and brought the concessions to zero. The promoter slammed the door on his way out — respectfully.',
        },
        effects: { orgAngerAdd: 0.035, demandMult: 0.96 },
      },
    ],
  },
  {
    id: 'venueIntegration', weight: 5, minMonth: 7,
    title: { ru: 'Площадка со своей системой', en: 'A venue with its own system' },
    text: {
      ru: 'Большой концертный зал готов работать с вами, но только через свою систему рассадки. Нужна интеграция.',
      en: 'A large concert hall is ready to work with you, but only through its own seating system. It needs an integration.',
    },
    lesson: {
      ru: 'Каждая интеграция — это выручка сегодня и обязательство навсегда. Их стоимость складывается, а отказаться от них потом нельзя.',
      en: 'Every integration is revenue today and an obligation forever. Their cost adds up, and you cannot walk away later.',
    },
    options: [
      {
        label: { ru: 'Сделать интеграцию', en: 'Build the integration' },
        detail: { ru: '75 млн ₽ разово, но площадка и её события ваши.', en: '$750K one-off, and the venue and its events are yours.' },
        effects: { oneOffCost: 55_000_000, orgJoinMult: 1.3 },
      },
      {
        label: { ru: 'Предложить билетный виджет', en: 'Offer a ticketing widget' },
        detail: { ru: 'Дешевле, но площадка согласится не сразу и не вся.', en: 'Cheaper, but the venue will only partly agree, and not at once.' },
        effects: { orgJoinMult: 1.05, orgAngerAdd: 0.01 },
      },
    ],
  },
  {
    id: 'pressFee', weight: 6, minMonth: 8,
    title: { ru: 'Публикация про сервисный сбор', en: 'A piece about the service fee' },
    text: {
      ru: 'Издание сравнило итоговые цены у всех операторов и вынесло ваш сбор в заголовок.',
      en: 'An outlet compared final prices across operators and put your fee in the headline.',
    },
    lesson: {
      ru: 'Сбор, который приходится объяснять, уже стоит дороже, чем приносит.',
      en: 'A fee you have to explain already costs more than it brings in.',
    },
    options: [
      {
        label: { ru: 'Показать сбор в афише', en: 'Show the fee in the listings' },
        detail: { ru: 'Конверсия просядет, доверие вырастет.', en: 'Conversion drops, trust rises.' },
        effects: { conversionMult: 0.80, trustAdd: 0.03 },
      },
      {
        label: { ru: 'Ответить, что так у всех', en: 'Reply that everyone does it' },
        detail: { ru: 'Бесплатно и почти правда. Доверие всё равно просядет.', en: 'Free and almost true. Trust falls anyway.' },
        effects: { trustAdd: -0.01 },
      },
      {
        // Протокол «СКРЕПКА»: экономика — точная копия «показать сбор в
        // афише», различие чисто сюжетное (сравнимость таблицы священна).
        secret: true,
        label: { ru: 'Доверить ответ нейросети «СКРЕПКА»', en: 'Let the PAPERCLIP neural network answer' },
        detail: {
          ru: 'СКРЕПКА опубликовала все сборы, себестоимость и зарплату директора. Прозрачность — так прозрачность: конверсия просядет, доверие вырастет.',
          en: 'PAPERCLIP published every fee, the unit costs and the CEO’s salary. Transparency means transparency: conversion drops, trust rises.',
        },
        effects: { conversionMult: 0.80, trustAdd: 0.03 },
      },
    ],
  },
  {
    id: 'sponsorship', weight: 4, minMonth: 9,
    title: { ru: 'Банк предлагает партнёрство', en: 'A bank offers a partnership' },
    text: {
      ru: 'Банк готов платить за то, чтобы его карта давала скидку на сбор у вас.',
      en: 'A bank will pay for its card to give a discount on your fee.',
    },
    lesson: {
      ru: 'Партнёрская выручка выглядит бесплатной ровно до тех пор, пока не начинает определять продукт.',
      en: 'Partner revenue looks free right up until it starts defining the product.',
    },
    options: [
      {
        label: { ru: 'Согласиться', en: 'Accept' },
        detail: { ru: 'Разово 200 млн ₽ и рост спроса. Но брендированные скидки раздражают зрителя и организаторов: доверие и афиша страдают. Дешёвая сделка при высоком доверии, дорогая — при низком.', en: '$2M up front and more demand. But branded discounts irritate buyers and organisers: trust and the listings both suffer. Cheap when trust is high, costly when it is low.' },
        effects: { oneOffGain: 200_000_000, demandMult: 1.08, trustAdd: -0.02, orgAngerAdd: 0.005 },
      },
      {
        label: { ru: 'Отказаться', en: 'Decline' },
        detail: { ru: 'Продукт остаётся вашим целиком.', en: 'The product stays entirely yours.' },
        effects: {},
      },
    ],
  },
  {
    id: 'goodPress', weight: 4, minMonth: 10,
    title: { ru: 'Вас похвалили за возвраты', en: 'Praised for your refunds' },
    text: {
      ru: 'После отмены чужого концерта журналисты сравнили, как операторы возвращают деньги. Вы выглядели лучше всех.',
      en: 'After someone else’s cancellation, journalists compared how operators refund. You came out best.',
    },
    lesson: {
      ru: 'Доверие — единственный актив билетного сервиса, который нельзя купить в тот месяц, когда он понадобился.',
      en: 'Trust is the one asset a ticketing service cannot buy in the month it turns out to be needed.',
    },
    effects: { trustAdd: 0.06, awarenessAdd: 0.01 },
  },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);

function pickWeighted(rng, pool) {
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

export function rollEvent(rng, month) {
  if (month < 3) return null;
  if (rng() > 0.30) return null;
  const pool = EVENTS.filter((e) => month >= (e.minMonth ?? 0));
  const picked = pickWeighted(rng, pool);
  return picked ? { ...picked } : null;
}

export function applyEvent(mods, event, optionIndex) {
  if (!event) return mods;
  const effects = { ...(event.effects ?? {}) };
  if (event.options && event.options[optionIndex]) {
    Object.assign(effects, event.options[optionIndex].effects);
  }
  for (const [key, value] of Object.entries(effects)) {
    if (key.endsWith('Mult')) {
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
