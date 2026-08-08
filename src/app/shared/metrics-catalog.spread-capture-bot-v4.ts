import { metric, MetricsServiceDefinition } from '@app/shared/metrics-catalog-metric';

export const SPREAD_CAPTURE_BOT_V4_METRICS_DEFINITION: MetricsServiceDefinition = {
  service: 'spread-capture-bot-v4',
  groups: [
    {
      id: 'account-value',
      label: 'Account Value',
      metrics: [
        metric('free_cash', {
          label: 'Free Cash',
          color: '#16a34a',
          unit: 'money',
          aggregation: 'last',
          description:
            'Сколько живых денег (USD) свободно на торговом счету бота прямо сейчас — то, что не потрачено на открытые позиции и не нужно под уже выставленные ордера. Это не вся ценность счёта, а только «живые» деньги, готовые к новым покупкам. Число растёт, когда бот продаёт позиции, и падает, когда покупает новые.',
        }),
        metric('estimated_open_positions_value', {
          label: 'Estimated Open Positions Value',
          color: '#16a34a',
          unit: 'money',
          aggregation: 'last',
          description:
            'Сколько реально можно было бы получить прямо сейчас, если бы бот продал все открытые позиции по текущим ценам в стакане (та же оценка по реальному спросу, что участвует в estimated_account_value, но отдельно от свободных денег).',
        }),
        metric('open_positions_no_book_count', {
          label: 'Open Positions: No Book',
          color: '#d97706',
          aggregation: 'last',
          integerValued: true,
          description:
            'estimated_open_positions_value — это оценка «сколько денег можно выручить, если продать всё прямо сейчас». Чтобы её посчитать, по каждой купленной позиции нужен стакан заявок на покупку (кто готов её у бота выкупить). Эта метрика — сколько позиций в этом цикле остались вообще без такого стакана: по рынку нет ни одной заявки на покупку. Такие позиции временно считаются стоящими $0, поэтому оценка счёта в этом случае занижена.',
        }),
        metric('open_positions_empty_bid_count', {
          label: 'Open Positions: Empty Bid',
          color: '#d97706',
          aggregation: 'last',
          integerValued: true,
          description:
            'То же самое, что Open Positions: No Book, но чуть другой случай: по рынку в целом стакан есть, но именно заявок на покупку (по которым бота выкупили бы) в нём сейчас нет ни одной. Результат тот же — позиция временно считается $0, оценка счёта занижена.',
        }),
        metric('open_positions_partial_depth_count', {
          label: 'Open Positions: Partial Depth',
          color: '#d97706',
          aggregation: 'last',
          integerValued: true,
          description:
            'Заявок на покупку по рынку хватило, чтобы оценить в деньгах только часть позиции — на остальной объём желающих купить не нашлось. Эта часть позиции оценена нормально, а её непокрытый остаток (в контрактах, не в деньгах) — метрика ниже, Open Positions: Uncovered Shares.',
        }),
        metric('open_positions_uncovered_shares', {
          label: 'Open Positions: Uncovered Shares',
          color: '#d97706',
          aggregation: 'last',
          description:
            'То же самое «слепое пятно», что в трёх метриках выше (No Book, Empty Bid, Partial Depth), но не в штуках позиций, а в объёме: сколько контрактов из уже купленных позиций сейчас не оценены в деньгах, потому что не нашлось желающих их выкупить. Эти контракты у бота реально есть, просто estimated_open_positions_value их не учитывает — то есть настоящая стоимость счёта, скорее всего, чуть больше, чем показывает estimated_account_value. Чем больше число — тем больше эта неучтённая часть.',
        }),
        metric('estimated_account_value', {
          label: 'Estimated Account Value',
          color: '#16a34a',
          unit: 'money',
          aggregation: 'last',
          description:
            'Оценочная полная стоимость торгового счёта в USD: свободные деньги (free_cash) плюс то, сколько реально можно было бы получить, если бы бот сейчас продал все купленные позиции по текущим ценам в стакане (estimated_open_positions_value). Это не «бумажная» оценка по последней сделке, а консервативная оценка по реальному спросу в стакане — поэтому она честнее показывает, сколько денег можно реально достать.',
        }),
      ],
    },
    {
      id: 'pulse',
      label: 'Pulse',
      metrics: [
        metric('cycle_errors', {
          label: 'Cycle Errors',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за этот цикл попытка отправить, переставить или отменить ордер на бирже закончилась ошибкой (биржа отказала). Ноль — это хорошо, значит все попытки прошли успешно. Если число равно количеству всех попыток за цикл — значит вообще ничего не получилось отправить, и стоит посмотреть логи бота.',
        }),
        metric('reconcile_cycles', {
          label: 'Reconcile Cycles',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько reconcile-циклов бот успел завершить за эту минуту. Обычно 1 при стандартном RECONCILE_INTERVAL=60с; если минута прошла без единого значения — цикл завис или упал раньше, чем успел что-то записать (см. reconcile_failures).',
        }),
        metric('reconcile_failures', {
          label: 'Reconcile Failures',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту весь торговый цикл бота полностью не смог начаться — потому что не получилось загрузить базовые данные со счёта (открытые ордера, позиции) или книги заявок. Если это не ноль, в соответствующем цикле бот вообще не принимал никаких торговых решений — не «решил ничего не делать», а технически не смог даже попытаться. Разбивка по тому, на каком шаге сорвался цикл — в reconcile_failures_fetch_account и reconcile_failures_fetch_books. Этим отличается от cycle_errors, где попытки были, но часть из них не получилась.',
        }),
        metric('reconcile_failures_fetch_account', {
          label: 'Reconcile Failures: Fetch Account',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Из reconcile_failures — сколько раз цикл сорвался именно на шаге получения базового состояния счёта (открытые ордера, позиции, баланс) с биржи.',
        }),
        metric('reconcile_failures_fetch_books', {
          label: 'Reconcile Failures: Fetch Books',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Из reconcile_failures — сколько раз цикл сорвался именно на шаге загрузки стаканов по рабочему списку.',
        }),
        metric('no_mutation_streak', {
          label: 'No-Mutation Streak',
          color: '#d97706',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько торговых циклов подряд бот не сделал ни одного реального изменения ордеров — не выставил, не переставил и не отменил ни одной заявки. Ноль означает, что в последнем цикле что-то изменилось. Большое число само по себе не обязательно плохо — рынок может быть просто стабильным и не требовать действий. Но если оно растёт без остановки очень долго, а вы ожидали активность, — стоит проверить, не застрял ли бот.',
        }),
        metric('export_pending_snapshots', {
          label: 'Export Pending Snapshots',
          color: '#d97706',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько минутных снепшотов метрик на момент публикации ещё не подтверждены (не acked) сервером сбора метрик и лежат в локальном outbox на диске. Инфраструктурная метрика самого экспортёра, не про торговлю. Маленькое стабильное число (обычно 0–1) — норма: снепшот только что записан и вот-вот уйдёт. Растёт без остановки — пуш на бэкенд метрик не успевает или падает, снепшоты копятся на диске.',
        }),
        metric('heartbeat', {
          label: 'Heartbeat',
          aggregation: 'last',
          integerValued: true,
          description:
            'Техническая отметка живости процесса — экспортёр метрик проставляет 1 в каждый минутный снепшот автоматически, для любой метрики этого сервиса, независимо от того, была ли реальная торговая активность. Подтверждает, что процесс жив и успешно сформировал снепшот за минуту; ничего не говорит о состоянии самой торговли.',
        }),
      ],
    },
    {
      id: 'performance',
      label: 'Performance',
      metrics: [
        metric('fetch_ms', {
          label: 'Fetch Duration (ms)',
          color: '#7c3aed',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняло получение базового состояния счёта (открытые ордера, позиции, баланс) с биржи в начале этого торгового цикла. Чем меньше — тем быстрее бот видит актуальную картину. Большие скачки чаще говорят о медленном ответе биржи, а не о проблеме в самом боте.',
        }),
        metric('books_ms', {
          label: 'Books Duration (ms)',
          color: '#7c3aed',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняла загрузка стаканов (книг заявок) по всем рынкам из рабочего списка в этом цикле. Чем больше рынков нужно отследить, тем дольше может занимать этот шаг — само по себе это не ошибка.',
        }),
        metric('reconcile_ms', {
          label: 'Reconcile Duration (ms)',
          color: '#7c3aed',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняло принятие и исполнение всех торговых решений по покупке и продаже в этом цикле, уже после того как данные счёта и стаканы были получены. Это «расчётная» часть цикла без учёта сетевых задержек на загрузку данных.',
        }),
        metric('cycle_duration_ms', {
          label: 'Cycle Duration (ms)',
          color: '#7c3aed',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд занял весь торговый цикл целиком — от начала до конца, включая загрузку данных счёта, стаканов и принятие решений. Это самая верхнеуровневая метрика скорости работы reconcile-цикла: если она стабильно растёт, стоит посмотреть на fetch_ms/books_ms/reconcile_ms по отдельности, чтобы понять, какой именно шаг стал медленнее. Раз в ~30 минут к этому добавляется отдельный, независимый discovery-цикл — его длительность смотри в discovery_duration_ms.',
        }),
      ],
    },
    {
      id: 'discovery',
      label: 'Discovery',
      metrics: [
        metric('catalog_markets_total', {
          label: 'Catalog Markets Total',
          color: '#0e7490',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько всего рынков попало в последний успешно опубликованный локальный каталог V4 — уже после отсева «похоже на спорт/дату» рынков (discovery_dropped_date_like), но ещё до фильтров кандидатов (спред, объём, диапазон бида и т.д. — см. группу Candidates and Worklist). Обновляется только раз в ~30 минут, вместе с остальным discovery-циклом, в отличие от кандидатских метрик, которые пересчитываются каждый reconcile-цикл поверх одного и того же снепшота.',
        }),
        metric('discovery_dropped_date_like', {
          label: 'Discovery Dropped: Date-Like',
          color: '#0e7490',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков в этом discovery-цикле выброшено эвристикой «похоже на ежедневный спортивный/датированный рынок» (по слагу события/рынка и тексту вопроса) — такие рынки вообще не попадают в локальный каталог V4 (catalog_markets_total), ещё до применения ценовых фильтров кандидатов.',
        }),
        metric('discovery_duration_ms', {
          label: 'Discovery Duration (ms)',
          color: '#0e7490',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд занял весь discovery-цикл целиком — от запроса Gamma-событий до публикации нового снепшота каталога. Выполняется раз в ~30 минут, независимо от reconcile-цикла. Если растёт, смотри discovery_gamma_ms/discovery_collect_ms/discovery_prices_ms/discovery_merge_ms по отдельности, чтобы понять, какой шаг замедлился.',
        }),
        metric('discovery_gamma_ms', {
          label: 'Discovery Gamma Duration (ms)',
          color: '#0e7490',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняла загрузка всех активных событий с Gamma API в этом discovery-цикле — обычно самый тяжёлый шаг, чаще всего доминирует в discovery_duration_ms.',
        }),
        metric('discovery_collect_ms', {
          label: 'Discovery Collect Duration (ms)',
          color: '#0e7490',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняли разбор полученных Gamma-событий и построение списка рынков (включая отсев date-like спортивных рынков) в этом discovery-цикле.',
        }),
        metric('discovery_prices_ms', {
          label: 'Discovery Prices Duration (ms)',
          color: '#0e7490',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняли параллельные price-batch запросы (батчами по 200 токенов, 20 воркеров одновременно) ко всем токенам собранных рынков в этом discovery-цикле.',
        }),
        metric('discovery_merge_ms', {
          label: 'Discovery Merge Duration (ms)',
          color: '#0e7490',
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняло слияние полученных цен bid/ask с рядами рынков перед публикацией нового снепшота каталога — последний шаг discovery-цикла.',
        }),
        metric('discovery_errors', {
          label: 'Discovery Errors',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько discovery-циклов подряд завершились ошибкой (Gamma недоступна или не отдала цены). При ошибке V4 сохраняет последний успешный снепшот каталога и продолжает торговать по нему как есть — ноль здесь означает, что discovery работает исправно.',
        }),
      ],
    },
    {
      id: 'candidates',
      label: 'Candidates and Worklist',
      metrics: [
        metric('candidates_stage1_total', {
          label: 'Candidates: Stage 1 Total',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько пар «рынок+сторона» (Yes и No считаются отдельно) из текущего каталога (catalog_markets_total) проходят грубый фильтр уровня 1 — диапазон бида, наивный спред топ-бид/топ-аск, объём, сроки до резолва и возраст рынка. Пересчитывается каждый reconcile-цикл поверх одного и того же ~30-минутного снепшота каталога. Разбивка по причинам отсева — в группе Drop Reasons.',
        }),
        metric('candidates_stage2_total', {
          label: 'Candidates: Stage 2 Total',
          color: '#0891b2',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько кандидатов уровня 1 прямо сейчас проходят живую проверку эффективного спреда — реальную разницу между ценой продажи и ценой покупки на том же стакане, что бот использует для размещения ордеров, а не наивный топ-бид/топ-аск. Это и есть «сколько рынков бот реально готов покупать в эту минуту». Проверяется каждый reconcile-цикл, а не только на discovery.',
        }),
        metric('candidates_stage2_effective_spread_avg_pts', {
          label: 'Effective Spread: Avg (pts)',
          color: '#0891b2',
          aggregation: 'avg',
          description:
            'Средний реальный (эффективный) спред в пунктах среди кандидатов уровня 1 за этот цикл — диагностика, не влияет на торговые решения. Публикуется только когда есть хотя бы один кандидат с посчитанным спредом. Помогает видеть, насколько в среднем рынки не дотягивают до порога входа.',
        }),
        metric('candidates_stage2_effective_spread_min_pts', {
          label: 'Effective Spread: Min (pts)',
          color: '#0891b2',
          aggregation: 'avg',
          description:
            'Минимальный реальный (эффективный) спред в пунктах среди кандидатов уровня 1 за этот цикл — худший случай в текущем пуле, публикуется только когда есть хотя бы один кандидат с посчитанным спредом. Полезно, чтобы понять, насколько близко к порогу входа находятся самые слабые кандидаты.',
        }),
        metric('legacy_positions', {
          label: 'Legacy Positions',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков в текущем рабочем списке бота больше НЕ входят в кандидаты уровня 1 (не проходят фильтры на новый вход), но у бота там либо открытая позиция, либо открытый ордер — и поэтому их всё равно нужно сопровождать, например выставить продажу, чтобы выйти из позиции. Это нормально и ожидаемо: бот не бросает уже купленное только потому, что рынок перестал быть «привлекательным» для новых покупок.',
        }),
        metric('books_missing', {
          label: 'Missing Books',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков из текущего рабочего списка бота не удалось получить «стакан» (книгу заявок — текущие цены покупки/продажи других участников) в этом цикле. Без стакана бот физически не может принять решение по такому рынку — он просто пропускается в этом цикле. Это число может быть стабильно довольно большим само по себе: часть рынков в рабочем списке — это уже неактивные или малоликвидные рынки, у которых стакана на нужной стороне нет уже давно. Большое, но СТАБИЛЬНОЕ значение — это не авария; внимания заслуживает только резкий внезапный рост.',
        }),
        metric('filtered_out', {
          label: 'Filtered Out',
          color: '#64748b',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько рынков в этом цикле бот пропустил из-за отладочной настройки — она включается вручную, чтобы временно погонять бота только на нескольких выбранных рынках, а не на всём списке кандидатов. Ноль означает, что настройка выключена и бот работает как обычно, по всему списку.',
        }),
      ],
    },
    {
      id: 'drop-reasons',
      label: 'Drop Reasons',
      metrics: [
        metric('candidates_stage1_dropped_no_price', {
          label: 'Dropped: No Price',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что по ним нет валидной цены — цена покупки или продажи отсутствует, либо цена покупки оказалась выше цены продажи. Без корректной цены оценить рынок невозможно.',
        }),
        metric('candidates_stage1_dropped_bid_range', {
          label: 'Dropped: Bid Range',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что текущая цена покупки находится за пределами разрешённого диапазона входа V4 — рынок либо слишком дорогой, либо слишком дешёвый по текущим настройкам стратегии.',
        }),
        metric('candidates_stage1_dropped_spread', {
          label: 'Dropped: Spread',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что наивный спред (разница между топ-ценой покупки и топ-ценой продажи) меньше минимального порога. Это только грубая предварительная отсечка — окончательное решение по факту принимает живая проверка эффективного спреда уровня 2 (candidates_stage2_total).',
        }),
        metric('candidates_stage1_dropped_volume', {
          label: 'Dropped: Volume',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что объём торгов по ним меньше минимально допустимого — слишком тихий рынок, чтобы безопасно входить и выходить из позиции.',
        }),
        metric('candidates_stage1_dropped_days_to_end', {
          label: 'Dropped: Days to End',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что до завершения события осталось меньше минимально нужного количества дней. Рынки без даты завершения вообще сюда не попадают — для них отдельная причина, candidates_stage1_dropped_missing_dates.',
        }),
        metric('candidates_stage1_dropped_missing_dates', {
          label: 'Dropped: Missing Dates',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что у рынка вообще нет даты начала или даты завершения. Раньше такие рынки тихо смешивались с «резолвится слишком скоро» под одной меткой — теперь видно отдельно.',
        }),
        metric('candidates_stage1_dropped_market_age', {
          label: 'Dropped: Market Age',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что сам рынок слишком молодой, создан совсем недавно — у новых рынков обычно ещё нестабильные цены, и бот выжидает, пока рынок «устоится».',
        }),
      ],
    },
    {
      id: 'orders',
      label: 'Orders and Trades',
      metrics: [
        metric('orders_total', {
          label: 'Open Orders',
          color: '#2563eb',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько ордеров (заявок на покупку или продажу) сейчас реально стоит у бота на бирже Polymarket, по данным самой биржи. Это общее число открытых заявок прямо сейчас; разбивка на покупку и продажу — в orders_buy и orders_sell.',
        }),
        metric('orders_buy', {
          label: 'Buy Orders',
          color: '#2563eb',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько именно заявок на покупку сейчас стоит открытыми на бирже. Каждая такая заявка — это попытка бота купить контракты на каком-то рынке по конкретной цене, которая ещё не исполнилась.',
        }),
        metric('orders_sell', {
          label: 'Sell Orders',
          color: '#2563eb',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько именно заявок на продажу сейчас стоит открытыми на бирже. Каждая такая заявка защищает уже купленную ботом позицию — она выставлена, чтобы при подходящей цене продать то, что уже куплено.',
        }),
        metric('trade_post', {
          label: 'Post Actions',
          color: '#2563eb',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на покупку или продажу бот реально успешно выставил на биржу в этом цикле — то есть запрос принят биржей. Считает и совсем новые заявки, и те, что появились после переустановки уже стоящей заявки.',
        }),
        metric('trade_cancel', {
          label: 'Cancel Actions',
          color: '#2563eb',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок бот реально успешно отменил на бирже в этом цикле. Считает и самостоятельные отмены, и отмены, которые были частью переустановки заявки.',
        }),
        metric('duplicate_orders_canceled', {
          label: 'Duplicate Orders Canceled',
          color: '#d97706',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько дублирующих ордеров (несколько живых заявок на одну и ту же сторону одного рынка) бот сам обнаружил и успешно отменил за этот цикл. Ноль — дублей не было. Само наличие дублей — признак гонки между циклами или сбоя API биржи, а не штатное поведение.',
        }),
        metric('duplicate_orders_cancel_failed', {
          label: 'Duplicate Orders Cancel Failed',
          color: '#dc2626',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько попыток отменить обнаруженный дублирующий ордер закончились ошибкой биржи. Если не ноль — на рынке может временно остаться лишняя открытая заявка до следующей попытки в одном из следующих циклов.',
        }),
      ],
    },
    {
      id: 'buy',
      label: 'Buy Actions',
      metrics: [
        metric('buy_place', {
          label: 'Buy Place',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот впервые поставил новую заявку на покупку на рынке, где раньше открытой заявки на покупку не было. Ноль — нормально, если все целевые позиции уже набраны или подходящих новых рынков сейчас нет.',
        }),
        metric('buy_keep', {
          label: 'Buy Keep',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на покупку бот в этом цикле оставил без изменений, потому что цена и размер всё ещё подходящие. Как и с продажей, большое число тут — признак стабильности рынка, а не проблема.',
        }),
        metric('buy_replace', {
          label: 'Buy Replace',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на покупку бот в этом цикле отменил и переставил заново — по новой цене или с новым размером (подробности — в группе Buy: Reasons).',
        }),
        metric('buy_blocked', {
          label: 'Buy Blocked',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот хотел поставить или поддержать заявку на покупку, но не смог — конкретная причина в группе Buy: Reasons.',
        }),
        metric('buy_stop', {
          label: 'Buy Stop',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот в этом цикле отменил полностью, потому что покупать дальше уже не нужно или нельзя — например, нужный размер позиции уже набран, рынок выпал из списка кандидатов или попал в чёрный список. Точная причина — в группе Buy: Reasons.',
        }),
        metric('buy_backoff_active', {
          label: 'Buy Backoff Active',
          color: '#ea580c',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько разных рынков прямо сейчас находятся под активным backoff на стороне покупки — бот временно ничего там не размещает после недавней серии ошибок подряд. Снимается само по себе по истечении таймера backoff.',
        }),
        metric('blacklisted_entries', {
          label: 'Blacklisted Entries',
          color: '#ea580c',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько разных рынков сейчас находятся в «чёрном списке» на покупку — это рынки, где биржа несколько раз подряд отказала в покупке из-за нехватки баланса, и бот временно перестал туда заходить, чтобы не тратить попытки впустую. Рынок убирается из списка автоматически, когда перестаёт быть проблемным. Это защитный механизм, а не показатель размера потерь.',
        }),
      ],
    },
    {
      id: 'buy-reasons',
      label: 'Buy: Reasons',
      metrics: [
        metric('buy_blocked_no_book', {
          label: 'Buy Blocked: No Book',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не смог поставить или обновить заявку на покупку, потому что не было доступного стакана продавцов по этому рынку — без него непонятно, по какой цене безопасно покупать.',
        }),
        metric('buy_blocked_below_min', {
          label: 'Buy Blocked: Below Min',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на покупку, потому что нужный объём докупки оказался меньше минимального размера заявки, разрешённого биржей.',
        }),
        metric('buy_blocked_backoff', {
          label: 'Buy Blocked: Backoff',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле заявка на покупку не была поставлена или обновлена, потому что рынок сейчас под активным backoff (buy_backoff_active) — недавно уже была серия ошибок на этой стороне, и бот временно выжидает вместо того, чтобы сразу пробовать снова.',
        }),
        metric('buy_exchange_rejected_insufficient_balance', {
          label: 'Buy Rejected: Insufficient Balance',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько buy-ордеров биржа отклонила именно с кодом insufficient_balance — бот пытался купить, но на балансе не хватило свободных денег на момент размещения. Частые значения здесь — сигнал, что бот претендует на больший объём, чем реально может себе позволить прямо сейчас.',
        }),
        metric('buy_replace_reprice', {
          label: 'Buy Replace: Reprice',
          color: '#ea580c',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот переставил в этом цикле только из-за изменения цены — желаемый размер позиции не менялся, просто появилась более выгодная цена для входа.',
        }),
        metric('buy_replace_size_change', {
          label: 'Buy Replace: Size Change',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот переставил в этом цикле из-за изменения нужного объёма докупки — например, часть заявки уже исполнилась, или целевой размер позиции изменился, а цена осталась прежней.',
        }),
        metric('buy_stop_no_deficit', {
          label: 'Buy Stop: No Deficit',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что нужный размер позиции уже набран целиком — докупать больше не требуется. Это хороший, ожидаемый исход.',
        }),
        metric('buy_stop_market_dropped_out', {
          label: 'Buy Stop: Market Dropped Out',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что рынок, где уже стояла заявка, перестал проходить фильтры на новый вход — например, спред сузился, объём упал или рынок больше не кандидат уровня 1. Продолжать наращивать позицию там больше нельзя, хотя уже купленное при этом не трогается.',
        }),
        metric('buy_stop_no_candidate', {
          label: 'Buy Stop: No Candidate',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Похоже на buy_stop_market_dropped_out, но для случая, когда заявки на покупку ещё не было: рынок к началу цикла уже не входил в список кандидатов, поэтому новую заявку на покупку по нему даже не стали выставлять.',
        }),
        metric('buy_stop_entry_blacklisted', {
          label: 'Buy Stop: Entry Blacklisted',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил или не стал выставлять в этом цикле из-за того, что рынок попал в чёрный список на покупку (blacklisted_entries) — биржа несколько раз подряд отказала там в покупке из-за нехватки баланса, и бот временно перестал туда заходить.',
        }),
        metric('buy_stop_queue_too_deep', {
          label: 'Buy Stop: Queue Too Deep',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что перед выгодной ценой уже стоит слишком большой объём чужих заявок на покупку (больше разрешённого лимита в USD) — войти по разумной цене сейчас не получится.',
        }),
        metric('buy_stop_effective_spread_too_tight', {
          label: 'Buy Stop: Effective Spread Too Tight',
          color: '#ea580c',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что живая проверка эффективного спреда (candidates_stage2_total) прямо сейчас не проходит порог — реальный спред между ценой покупки и продажи на актуальном стакане схлопнулся. Сторону SELL это не касается: уже купленную позицию бот продолжает закрывать независимо от текущего спреда.',
        }),
      ],
    },
    {
      id: 'sell',
      label: 'Sell Actions',
      metrics: [
        metric('sell_place', {
          label: 'Sell Place',
          color: '#db2777',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот впервые поставил заявку на продажу по какой-то купленной позиции, у которой раньше не было ни одной заявки на продажу. Ноль — нормально, если все уже купленные позиции и так уже сопровождаются продающими заявками.',
        }),
        metric('sell_dust_liquidation_attempted_shares', {
          label: 'Sell Dust Liquidation Attempted (shares)',
          color: '#db2777',
          aggregation: 'sum',
          description:
            'Суммарный объём в контрактах, который бот в этом цикле пытался продать как «пыль» — остаток позиции настолько маленький, что обычная логика продажи его не покрывает. Раз в несколько минут бот отдельно пытается закрыть такие мелкие хвосты позиций (если размещение удалось — попадает также в sell_place).',
        }),
        metric('sell_keep', {
          label: 'Sell Keep',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на продажу бот в этом цикле оставил без изменений, потому что их цена и размер всё ещё оптимальны. Большое число — хороший знак стабильности: бот не дёргает заявки без нужды.',
        }),
        metric('sell_replace', {
          label: 'Sell Replace',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на продажу бот в этом цикле отменил и переставил заново — по новой цене или с другим размером (подробная причина — в группе Sell: Reasons). Сама переустановка — это нормальная рабочая активность, а не ошибка.',
        }),
        metric('sell_blocked', {
          label: 'Sell Blocked',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот хотел поставить или поддержать заявку на продажу, но не смог — конкретная причина в группе Sell: Reasons.',
        }),
        metric('sell_stop', {
          label: 'Sell Stop',
          color: '#db2777',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот в этом цикле отменил полностью, без переустановки, потому что продавать больше нечего — позиция уже распродана. Это ожидаемое завершение жизненного цикла позиции, а не сбой.',
        }),
        metric('sell_backoff_active', {
          label: 'Sell Backoff Active',
          color: '#db2777',
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько разных рынков прямо сейчас находятся под активным backoff на стороне продажи — бот временно ничего там не переставляет после недавней серии ошибок подряд. Снимается само по себе по истечении таймера backoff.',
        }),
      ],
    },
    {
      id: 'sell-reasons',
      label: 'Sell: Reasons',
      metrics: [
        metric('sell_blocked_no_book', {
          label: 'Sell Blocked: No Book',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот не смог поставить или обновить заявку на продажу, потому что не было доступного стакана покупателей по этому рынку — без него непонятно, по какой цене продавать безопасно. Ноль — значит со стаканами для продажи всё было в порядке.',
        }),
        metric('sell_blocked_below_min', {
          label: 'Sell Blocked: Below Min',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на продажу, потому что объём, который нужно продать, оказался меньше минимального размера заявки, разрешённого биржей. Обычно касается совсем небольших остатков позиции — это нормальная защита от заявки, которую биржа просто не примет.',
        }),
        metric('sell_blocked_queue_too_deep', {
          label: 'Sell Blocked: Queue Too Deep',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на продажу, потому что перед выгодной ценой уже стоит слишком большой объём чужих заявок (больше разрешённого лимита в USD) — то есть очередь на продажу слишком глубокая, и заявка бота простояла бы там почти без шансов исполниться по адекватной цене.',
        }),
        metric('sell_blocked_backoff', {
          label: 'Sell Blocked: Backoff',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле заявка на продажу не была поставлена или обновлена, потому что рынок сейчас под активным backoff (sell_backoff_active) на этой стороне — недавно уже была серия ошибок, бот временно выжидает.',
        }),
        metric('sell_replace_reprice', {
          label: 'Sell Replace: Reprice',
          color: '#db2777',
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле только из-за изменения цены — размер заявки остался тот же, просто рынок изменился и появилась более выгодная или более безопасная цена для продажи. У V4 нет нижней границы цены выхода, поэтому репрайс может уводить цену продажи вниз вслед за рынком без ограничения снизу.',
        }),
        metric('sell_replace_expand', {
          label: 'Sell Replace: Expand',
          color: '#db2777',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле, увеличив размер. Это происходит, когда позиция выросла — например, докупили ещё контрактов — и старая заявка на продажу покрывала только часть позиции, а новая покрывает больше.',
        }),
        metric('sell_replace_reduce', {
          label: 'Sell Replace: Reduce',
          color: '#db2777',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле, уменьшив размер. Обычно это значит, что часть позиции уже была продана ранее, и заявку нужно скорректировать под то, что осталось.',
        }),
        metric('sell_stop_no_inventory', {
          label: 'Sell Stop: No Inventory',
          color: '#db2777',
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот отменил в этом цикле, потому что продавать больше нечего — позиция по этому рынку уже полностью распродана. Сейчас это единственная причина, по которой продажа вообще останавливается.',
        }),
      ],
    },
    {
      id: 'removed',
      label: 'Removed',
      metrics: [
        metric('export_fetch_ms', {
          label: 'V3 Export Fetch Duration (ms)',
          color: '#7c3aed',
          aggregation: 'avg',
          removed: true,
          removedNote: 'Замены нет — шаг убран вместе с V3 `/export`, время discovery теперь в discovery_duration_ms',
          description:
            'Сколько миллисекунд заняли запрос и разбор ответа роута /export у V3 в начале цикла — оттуда V4 получал список рынков с ценами и множество занятых V3 маркет-сайдов. Убрано вместе с переходом V4 на собственный локальный discovery.',
        }),
        metric('v3_occupied_total', {
          label: 'V3 Occupied Total',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет — понятие «занято V3» ушло вместе с V3-зависимостью',
          description:
            'Сколько маркет-сайдов числились занятыми V3 (по данным снепшота /export) — туда V4 не заходил новыми покупками, чтобы не конкурировать с V3 на своей же стратегии.',
        }),
        metric('dropped_v3_occupied', {
          label: 'Dropped: V3 Occupied',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет, то же',
          description:
            'Сколько сторон рынка было отброшено из кандидатов, потому что маркет-сайд был занят V3 (входил в v3_occupied_total).',
        }),
        metric('catalog_candidates', {
          label: 'Catalog Candidates',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_total',
          description:
            'Сколько рынков (сторон рынка) из снэпшота в этом цикле проходят все фильтры уровня 1 и считаются подходящими для новой покупки.',
        }),
        metric('dropped_no_price', {
          label: 'Dropped: No Price',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_no_price',
          description:
            'Сколько сторон рынка было отброшено, потому что по ним не пришли нормальные цены покупки/продажи.',
        }),
        metric('dropped_bid_range', {
          label: 'Dropped: Bid Range',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_bid_range',
          description:
            'Сколько сторон рынка было отброшено, потому что текущая цена покупки вне разрешённого диапазона входа.',
        }),
        metric('dropped_spread', {
          label: 'Dropped: Spread',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_spread',
          description:
            'Сколько сторон рынка было отброшено, потому что спред покупки/продажи слишком маленький по порогу V4.',
        }),
        metric('dropped_volume', {
          label: 'Dropped: Volume',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_volume',
          description:
            'Сколько сторон рынка было отброшено, потому что объём торгов по ним меньше минимально допустимого для V4.',
        }),
        metric('dropped_days_to_end', {
          label: 'Dropped: Days to End',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote:
            'Теперь candidates_stage1_dropped_days_to_end — но уже: рынки без даты вообще выделены в отдельную candidates_stage1_dropped_missing_dates',
          description:
            'Сколько сторон рынка было отброшено, потому что до завершения события осталось меньше минимально нужного количества дней.',
        }),
        metric('dropped_market_age', {
          label: 'Dropped: Market Age',
          color: '#64748b',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_market_age',
          description:
            'Сколько сторон рынка было отброшено, потому что сам рынок слишком молодой, создан совсем недавно.',
        }),
        metric('worklist_candidates', {
          label: 'Worklist Candidates',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote:
            'Теперь candidates_stage2_total — смысл другой: раньше зеркалило catalog_candidates, теперь live-проверка эффективного спреда прямо сейчас',
          description:
            'Сколько рынков из текущего списка кандидатов бот реально обрабатывает в этом конкретном торговом цикле.',
        }),
        metric('worklist_ex_candidates', {
          label: 'Worklist Ex-Candidates',
          color: '#0891b2',
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь legacy_positions',
          description:
            'Сколько рынков в текущем рабочем списке бота больше не входят в список кандидатов, но у бота там либо открытая позиция, либо открытый ордер.',
        }),
      ],
    },
  ],
};
