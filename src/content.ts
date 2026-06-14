export const APP_VERSION = "1.0.4";

export const links = {
  github: "https://github.com/48rn2krftk-dev/fuel-rate-calc",
  email:
    "mailto:comrade.stalin@icloud.com?subject=Горячий%20простой%20—%20обратная%20связь",
  telegram: "https://t.me/drunken43spark",
  express:
    "https://xlnk.ms/open/profile/31871131-d6cb-581e-ba0b-35815e3e06e2",
  support: "https://tips.yandex.ru/guest/payment/3746623",
} as const;

export const uiText = {
  app: {
    eyebrow: "Калькулятор ведомостей ф. ТХУ-3",
    title: "Горячий простой",
    version: `Горячий простой · версия ${APP_VERSION}`,
    connection: {
      checking: "Проверка",
      online: "Онлайн",
      offline: "Офлайн",
    },
    navigation: {
      byTime: "ТХУ-3",
      quick: "Быстрый расчёт",
      summary: "Сумма",
      settings: "Ещё",
    },
  },
  common: {
    clear: "Очистить",
    clearAll: "Очистить всё",
    emptyValue: "—",
    save: "Сохранить",
    units: {
      hoursShort: "ч",
      kilograms: "кг",
      kilogramsPerHour: "кг/ч",
      minutesShort: "м",
    },
    result: {
      heatingTime: "Время прогрева",
      fuelUsed: "Израсходовано",
      fuelPerHour: "Расход в час",
    },
  },
  normComparison: {
    percentOfNorm: "% от нормы",
    matchesNorm: "Расход соответствует норме",
    reserve: "Резерв до нормы",
    overrun: "Перерасход относительно нормы",
    normativeFuelEnd: "Расчётный остаток при сдаче по нормативу",
  },
  saveResult: {
    dialogLabel: "Сохранение результата",
    title: "Сохранить результат",
    firstSlotDescription: "Задай название и сохрани первый слот.",
    existingSlotsDescription:
      "Можно перезаписать существующий слот или сохранить в новый.",
    close: "Закрыть",
    nameLabel: "Название сохранения",
    namePlaceholder: "Например 3ТЭ25К2М-697 секция 1",
    saveToSlot: (slot: number) => `Сохранить в слот ${slot}`,
    slotOverwritten: (slot: number) => `Слот ${slot} перезаписан`,
    savedToSlot: (slot: number) => `Сохранено в слот ${slot}`,
    overwriteSlot: (slot: number) => `Слот ${slot} — перезаписать`,
    saveToNewSlot: (slot: number) => `Слот ${slot} — сохранить в новый`,
    current: "Сейчас",
    emptySlot: "Новый свободный слот",
  },
  byTime: {
    title: "Расчёт по ведомости ф. ТХУ-3",
    description: "Введи время и данные о топливе из ведомости ТХУ-3.",
    startTime: "Начало прогрева",
    startTimePlaceholder: "0735 или 0101260735",
    endTime: "Окончание прогрева",
    endTimePlaceholder: "0910 или 0201260910",
    fuelStart: "Топливо при приёмке, кг",
    fuelEnd: "Топливо при сдаче, кг",
    fuelPlaceholder: "411,000",
    fuelEndPlaceholder: "371,000",
    ocr: "📷 Сканировать ТХУ-3",
    soon: "Скоро",
    nextDayQuestion:
      "Окончание не позже начала. Считать его временем следующих суток?",
    nextDayConfirm: "Да, следующие сутки",
    mixedDateError:
      "Если дата указана только в одном поле, она должна быть в поле начала.",
    fuelError:
      "Топливо при сдаче не может превышать топливо при приёмке.",
  },
  quick: {
    title: "Быстрый расчёт",
    description:
      "Введи продолжительность прогрева и расход топлива.",
    duration: "Время прогрева",
    durationPlaceholder: "2214 или 163559",
    fuelUsed: "Расход топлива, кг",
    fuelPlaceholder: "40,000",
    durationError:
      "Введи время в формате 22:14, 2214 или 1635:59.",
    fuelError:
      "Введи топливо от 0 до 9999,999 кг (не более трёх знаков после запятой).",
  },
  summary: {
    title: "Сложение прогревов",
    description:
      "Сложи несколько прогревов из сохранённых слотов или введи их вручную.",
    fuelStart: "Топливо в начале цепочки, кг (необязательно)",
    fuelStartPlaceholder: "411,000",
    fuelStartError: "Введи начальное топливо от 0 до 9999,999 кг.",
    fuelChainError:
      "Общий расход не может превышать топливо в начале цепочки.",
    heating: (index: number) => `Прогрев ${index}`,
    deleteHeating: (index: number) => `Удалить прогрев ${index}`,
    manual: "Вручную",
    fromSlot: "Из слота",
    savedCalculation: "Сохранённый расчёт",
    slotOption: (slot: number, title: string) => `Слот ${slot}: ${title}`,
    duration: "Время прогрева",
    durationPlaceholder: "2214 или 1635:59",
    fuelUsed: "Расход топлива, кг",
    fuelUsedPlaceholder: "40,000",
    durationError:
      "Введи время в формате 22:14, 2214 или 1635:59.",
    fuelError: "Введи топливо от 0 до 9999,999 кг.",
    addMore: "Добавить ещё",
    totalTime: "Общее время",
    totalFuel: "Общий расход",
    averageFuelPerHour: "Средний расход в час",
    actualFuelEnd: "Остаток по фактическому расходу",
  },
  settings: {
    title: "Настройки",
    description:
      "Норматив нужен для сравнения фактического расхода с плановым.",
    normLabel: "Норматив удельного расхода, кг/ч",
    normPlaceholder: "Например 45,0",
    normError: "Введи норматив от 0 до 9999,999 кг/ч.",
    saveNorm: "Сохранить норматив",
    normSaved: "Норматив сохранён",
    normCleared: "Норматив очищен",
    appearanceTitle: "Оформление",
    appearanceDescription:
      "Выбери тему приложения или доверь выбор настройкам устройства.",
    themeSelectorLabel: "Тема приложения",
    theme: {
      system: "Системная",
      light: "Светлая",
      dark: "Тёмная",
    },
    slotsTitle: "Слоты сохранения",
    slotsDescription:
      "Здесь хранятся временные сохранения для экрана сложения.",
    slot: (index: number) => `Слот ${index}`,
    emptySlot: "Пустой",
    historyTitle: "История расчётов",
    historyDescription:
      "Постоянный журнал сохранённых результатов и исходных данных.",
    emptyHistory: "Сохранённых расчётов пока нет.",
    historyType: {
      byTime: "Расчёт по ТХУ-3",
      quick: "Быстрый расчёт",
      summary: "Сложение прогревов",
    },
    balances: "Остатки",
    time: "Время",
    fuel: "Топливо",
    chainStart: "Начало цепочки",
    deleteHistoryEntry: (title: string) => `Удалить запись ${title}`,
    calculationNorm: "Норма на момент расчёта",
    forPeriod: "за период",
    aboutTitle: "О приложении",
    githubTitle: "GitHub разработчика",
    developer: "Drunken Spark Dev",
    feedbackTitle: "Связаться с разработчиком",
    feedbackDescription:
      "Сообщи об ошибке, предложи улучшение или задай вопрос удобным способом.",
    emailTitle: "E-mail",
    emailDescription: "Написать на почту",
    telegramTitle: "Telegram",
    telegramDescription: "Написать в Telegram",
    expressTitle: "eXpress",
    expressDescription: "Написать в eXpress",
    supportTitle: "Поддержать разработчика",
    supportDescription:
      "Разработка - вещь доступная, но не бесплатная. Если приложение оказалось полезным, поддержи его автора копеечкой <3",
    supportButton: "Перейти к Яндекс Чаевым",
    installHint:
      "Установка на iPhone: открой приложение в Safari, нажми «Поделиться» и выбери «На экран Домой».",
  },
} as const;
