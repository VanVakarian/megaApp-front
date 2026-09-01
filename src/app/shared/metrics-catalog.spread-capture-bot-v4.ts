import { MetricColor } from '@app/shared/metric-colors';
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
          color: MetricColor.Green600,
          unit: 'money',
          aggregation: 'last',
          description:
            'Сколько живых денег (USD) свободно на торговом счету бота прямо сейчас — то, что не потрачено на открытые позиции и не нужно под уже выставленные ордера. Это не вся ценность счёта, а только «живые» деньги, готовые к новым покупкам. Число растёт, когда бот продаёт позиции, и падает, когда покупает новые.',
        }),
      ],
    },
    {
      id: 'pulse',
      label: 'Pulse',
      metrics: [
        metric('cycle_errors', {
          label: 'Cycle Errors',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту попытка отправить, переставить или отменить ордер на бирже закончилась ошибкой (биржа отказала). Ноль — это хорошо, значит все попытки прошли успешно. Название осталось с cycle-эпохи бота (см. plans/32) — по смыслу метрика не изменилась, просто больше не привязана к фиксированному 60-секундному циклу, а считается по мере событийной активности бота.',
        }),
        metric('reconcile_failures', {
          label: 'Reconcile Failures',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту попытка обработать hot-batch, dust-sweep или обновить account-state полностью не смогла начаться — потому что не получилось загрузить базовые данные со счёта (открытые ордера, позиции) или книги заявок. Если это не ноль, в соответствующей попытке бот вообще не принимал никаких торговых решений — не «решил ничего не делать», а технически не смог даже попытаться. Разбивка по тому, какая именно попытка сорвалась — в reconcile_failures_hot_batch_reconcile, reconcile_failures_dust_sweep_reconcile и reconcile_failures_account_state_refresh. Этим отличается от cycle_errors, где попытки были, но часть из них не получилась.',
        }),
        metric('reconcile_failures_hot_batch_reconcile', {
          label: 'Reconcile Failures: Hot Batch',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Из reconcile_failures — сколько раз сорвалась попытка обработать событийный hot-batch (загрузка стаканов по набранному dirty-set и последующий reconcile).',
        }),
        metric('reconcile_failures_dust_sweep_reconcile', {
          label: 'Reconcile Failures: Dust Sweep',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description: 'Из reconcile_failures — сколько раз сорвалась часовая попытка часового прохода dust-sweep (ликвидация мусорных остатков позиций).',
        }),
        metric('reconcile_failures_account_state_refresh', {
          label: 'Reconcile Failures: Account State',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Из reconcile_failures — сколько раз сорвалось событийное обновление account-state (заявки/баланс/позиции) — после исчерпания встроенных ретраев. Кэш в этом случае остаётся устаревшим до следующего успешного обновления.',
        }),
        metric('export_pending_snapshots', {
          label: 'Export Pending Snapshots',
          color: MetricColor.Amber600,
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
        metric('hot_batch_ms', {
          label: 'Hot Batch Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд занял один событийный hot-batch — от загрузки стаканов по набранному dirty-set до исполнения всех торговых решений по нему. Это прямой аналог cycle_duration_ms из cycle-эпохи бота, но теперь на масштабе одного батча, а не фиксированного 60-секундного цикла (см. plans/32). Растущее значение указывает на замедление либо биржи, либо самого шага принятия решений.',
        }),
        metric('account_state_refresh_ms', {
          label: 'Account State Refresh Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняло одно событийное обновление account-state (заявки, баланс, позиции) с биржи. Срабатывает по сделке, реконнекту приватного WS-канала, при старте или раз в час по потолку — не по фиксированному таймеру.',
        }),
        metric('dust_sweep_ms', {
          label: 'Dust Sweep Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          description: 'Сколько миллисекунд занял один часовой проход dust-sweep (ликвидация мусорных остатков позиций).',
        }),
      ],
    },
    {
      id: 'event-layer',
      label: 'Event Layer Health',
      metrics: [
        metric('hot_batches_total', {
          label: 'Hot Batches',
          color: MetricColor.Blue600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту событийный market-триггер набрал полный dirty-set токенов (обычно 500, см. hot_batch_size) и запустил их reconcile. Это прямой аналог reconcile_cycles из cycle-эпохи бота, но по факту рыночной активности, а не по фиксированному таймеру: тихий рынок вообще не порождает батчей.',
        }),
        metric('hot_batch_size', {
          label: 'Hot Batch Size',
          color: MetricColor.Blue600,
          aggregation: 'last',
          integerValued: true,
          description: 'Сколько токенов было в последнем обработанном hot-batch. Обычно равно BOOKS_CHUNK_SIZE (500); меньше — если сработал предохранитель HOT_BATCH_MAX_WAIT на неполном наборе.',
        }),
        metric('hot_batch_max_wait_fired_total', {
          label: 'Hot Batch Max-Wait Fired',
          color: MetricColor.Amber600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту сработал предохранитель HOT_BATCH_MAX_WAIT — dirty-set не набрал полный размер батча вовремя, и накопленное отправили на reconcile неполным. На активном боевом аккаунте практически не должно срабатывать вообще (см. plans/31 component 2); частое ненулевое значение — сигнал, что universe заметно поредел.',
        }),
        metric('hot_batch_queue_depth', {
          label: 'Hot Batch Queue Depth',
          color: MetricColor.Amber600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько уже готовых, но ещё не взятых в обработку hot-batch\'ей стояло в очереди перед тем, как консьюмер забрал очередной (потолок — HOT_BATCH_QUEUE_CAP). Консьюмер строго однопоточный (см. plans/31 component 4) — устойчиво растущее значение означает, что WS-поток набирает батчи быстрее, чем бот успевает их отторговывать, и это уже реальный бэкпрешер на приём новых сообщений.',
        }),
        metric('account_state_refresh_total', {
          label: 'Account State Refreshes',
          color: MetricColor.Blue600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту account-state (заявки, баланс, позиции) был успешно обновлён с биржи — по сделке, реконнекту приватного WS-канала, при старте процесса или по часовому потолку.',
        }),
        metric('account_state_pending_confirmation_total', {
          label: 'Account State Pending Confirmation',
          color: MetricColor.Amber600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту токен был поставлен на паузу из-за неподтверждённого исхода отмены/замены ордера (биржа не подтвердила отмену, транспортная ошибка) — реальное состояние заявки неизвестно, и бот временно перестаёт трогать этот токен в hot-batch до следующего полного обновления account-state. Раньше (до plans/31) этот случай не был виден вообще никак.',
        }),
        metric('ws_market_connected_total', {
          label: 'Market WS Connected',
          color: MetricColor.Cyan700,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту одно из WS-соединений market-канала (книги заявок, до 500 токенов на соединение) успешно подключилось — включая самый первый коннект и все последующие переподключения после разрыва.',
        }),
        metric('ws_market_dropped_total', {
          label: 'Market WS Dropped',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту одно из WS-соединений market-канала оборвалось. Бот переподключается сам с экспоненциальным backoff — единичные обрывы это нормально (сетевые сбои у самого Polymarket), устойчивый рост — повод посмотреть логи.',
        }),
        metric('ws_market_universe_rebuilds_total', {
          label: 'Market WS Universe Rebuilds',
          color: MetricColor.Cyan700,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту весь пул market WS-соединений был полностью пересобран из-за изменения желаемого множества токенов (кандидаты ∪ свои открытые ордера ∪ инвентарь). Текущая реализация всегда пересобирает пул целиком, а не точечно (см. plans/32 component 2, отложено) — устойчиво частые пересборки при активной торговле являются прямым обоснованием этой будущей доработки.',
        }),
        metric('ws_user_connected_total', {
          label: 'User WS Connected',
          color: MetricColor.Cyan700,
          aggregation: 'sum',
          integerValued: true,
          description: 'Сколько раз за эту минуту приватный user-канал (свои сделки/ордера) успешно подключился — включая первый коннект и переподключения после разрыва.',
        }),
        metric('ws_user_dropped_total', {
          label: 'User WS Dropped',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту приватный user-канал оборвался. Каждый разрыв сам по себе форсирует обновление account-state при переподключении (пропущенная во время разрыва сделка не реплеится) — см. account_state_refresh_total.',
        }),
        metric('ws_user_terminal_trades_total', {
          label: 'User WS Terminal Trades',
          color: MetricColor.Blue600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз за эту минуту приватный user-канал прислал терминальное событие сделки (CONFIRMED/FAILED) — именно эти события (и только они) триггерят обновление account-state. Постоянный ноль при активной торговле — повод проверить сам WS-канал, а не только логи ошибок.',
        }),
        metric('dust_sweep_batches_total', {
          label: 'Dust Sweep Batches',
          color: MetricColor.Blue600,
          aggregation: 'sum',
          integerValued: true,
          description: 'Сколько раз за эту минуту прошёл часовой dust-sweep проход, у которого нашлись реальные кандидаты на ликвидацию (не срабатывает вообще, если мусорных остатков нет).',
        }),
        metric('dust_sweep_size', {
          label: 'Dust Sweep Size',
          color: MetricColor.Blue600,
          aggregation: 'last',
          integerValued: true,
          description: 'Сколько токенов было в последнем обработанном dust-sweep проходе — реальных кандидатов на ликвидацию мусорного остатка, не весь инвентарь.',
        }),
      ],
    },
    {
      id: 'discovery',
      label: 'Discovery',
      metrics: [
        metric('catalog_markets_total', {
          label: 'Catalog Markets Total',
          color: MetricColor.Cyan700,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько всего рынков попало в последний успешно опубликованный локальный каталог V4 — уже после отсева «похоже на спорт/дату» рынков (discovery_dropped_date_like), но ещё до фильтров кандидатов (спред, объём, диапазон бида и т.д. — см. группу Candidates and Worklist). Обновляется только раз в ~30 минут, вместе с остальным discovery-циклом внешнего Live Books Fetcher-сервиса.',
        }),
        metric('discovery_dropped_date_like', {
          label: 'Discovery Dropped: Date-Like',
          color: MetricColor.Cyan700,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков в этом discovery-цикле выброшено эвристикой «похоже на ежедневный спортивный/датированный рынок» (по слагу события/рынка и тексту вопроса) — такие рынки вообще не попадают в локальный каталог V4 (catalog_markets_total), ещё до применения ценовых фильтров кандидатов.',
        }),
        metric('discovery_duration_ms', {
          label: 'Discovery Duration (ms)',
          color: MetricColor.Cyan700,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд занял весь discovery-цикл целиком — от запроса Gamma-событий до публикации нового снепшота каталога. Выполняется раз в ~30 минут, независимо от reconcile-цикла. Если растёт, смотри discovery_gamma_ms/discovery_collect_ms/discovery_prices_ms/discovery_merge_ms по отдельности, чтобы понять, какой шаг замедлился.',
        }),
        metric('discovery_gamma_ms', {
          label: 'Discovery Gamma Duration (ms)',
          color: MetricColor.Cyan700,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняла загрузка всех активных событий с Gamma API в этом discovery-цикле — обычно самый тяжёлый шаг, чаще всего доминирует в discovery_duration_ms.',
        }),
        metric('discovery_collect_ms', {
          label: 'Discovery Collect Duration (ms)',
          color: MetricColor.Cyan700,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняли разбор полученных Gamma-событий и построение списка рынков (включая отсев date-like спортивных рынков) в этом discovery-цикле.',
        }),
        metric('discovery_prices_ms', {
          label: 'Discovery Prices Duration (ms)',
          color: MetricColor.Cyan700,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняли параллельные price-batch запросы (батчами по 200 токенов, 20 воркеров одновременно) ко всем токенам собранных рынков в этом discovery-цикле.',
        }),
        metric('discovery_merge_ms', {
          label: 'Discovery Merge Duration (ms)',
          color: MetricColor.Cyan700,
          aggregation: 'avg',
          description:
            'Сколько миллисекунд заняло слияние полученных цен bid/ask с рядами рынков перед публикацией нового снепшота каталога — последний шаг discovery-цикла.',
        }),
        metric('discovery_errors', {
          label: 'Discovery Errors',
          color: MetricColor.Red600,
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
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько пар «рынок+сторона» (Yes и No считаются отдельно) из текущего каталога (catalog_markets_total) проходят грубый фильтр уровня 1 — диапазон бида, наивный спред топ-бид/топ-аск, объём, сроки до резолва и возраст рынка. Считается внешним Live Books Fetcher-сервисом на его собственном ~30-минутном цикле отбора, бот только публикует присланное значение. Разбивка по причинам отсева — в группе Drop Reasons.',
        }),
        metric('candidates_stage2_total', {
          label: 'Candidates: Stage 2 Total',
          color: MetricColor.Cyan600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько кандидатов уровня 1 в последнем обработанном hot-batch прошли живую проверку эффективного спреда — реальную разницу между ценой продажи и ценой покупки на том же стакане, что бот использует для размещения ордеров, а не наивный топ-бид/топ-аск. Событийная метрика: считается по токенам, которые реально попали в очередной hot-batch (см. plans/32), а не по всему пулу кандидатов разом — крупные пулы видны по накоплению значений за несколько батчей подряд.',
        }),
        metric('candidates_stage2_effective_spread_avg_pts', {
          label: 'Effective Spread: Avg (pts)',
          color: MetricColor.Cyan600,
          aggregation: 'avg',
          description:
            'Средний реальный (эффективный) спред в пунктах среди кандидатов уровня 1 в последнем обработанном hot-batch — диагностика, не влияет на торговые решения. Публикуется только когда есть хотя бы один кандидат с посчитанным спредом в этом батче. Помогает видеть, насколько в среднем рынки не дотягивают до порога входа.',
        }),
        metric('candidates_stage2_effective_spread_min_pts', {
          label: 'Effective Spread: Min (pts)',
          color: MetricColor.Cyan600,
          aggregation: 'avg',
          description:
            'Минимальный реальный (эффективный) спред в пунктах среди кандидатов уровня 1 в последнем обработанном hot-batch — худший случай в этом батче, публикуется только когда есть хотя бы один кандидат с посчитанным спредом. Полезно, чтобы понять, насколько близко к порогу входа находятся самые слабые кандидаты.',
        }),
        metric('legacy_positions', {
          label: 'Legacy Positions',
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков в последнем обработанном hot-batch больше НЕ входят в кандидаты уровня 1 (не проходят фильтры на новый вход), но у бота там либо открытая позиция, либо открытый ордер — и поэтому их всё равно нужно сопровождать, например выставить продажу, чтобы выйти из позиции. Это нормально и ожидаемо: бот не бросает уже купленное только потому, что рынок перестал быть «привлекательным» для новых покупок.',
        }),
        metric('books_missing', {
          label: 'Missing Books',
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько рынков из последнего обработанного hot-batch не удалось получить «стакан» (книгу заявок — текущие цены покупки/продажи других участников). Без стакана бот физически не может принять решение по такому рынку — он просто пропускается в этом батче. Большое, но СТАБИЛЬНОЕ значение — это не авария (часть рынков в рабочем списке уже неактивна или малоликвидна); внимания заслуживает только резкий внезапный рост.',
        }),
        metric('filtered_out', {
          label: 'Filtered Out',
          color: MetricColor.Slate500,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько рынков за последнюю минуту бот пропустил из-за отладочной настройки — она включается вручную, чтобы временно погонять бота только на нескольких выбранных рынках, а не на всём списке кандидатов. Ноль означает, что настройка выключена и бот работает как обычно, по всему списку.',
        }),
        metric('sell_coverage_covered_shares', {
          label: 'Sell Coverage: Covered (shares)',
          color: MetricColor.Cyan600,
          aggregation: 'last',
          description:
            'Из последнего обработанного hot-batch: сколько купленных контрактов сейчас реально защищено живой заявкой на продажу (полностью или частично покрывает объём позиции). Не требует стакана и не стоит дополнительных REST-запросов — считается по уже загруженным данным об ордерах и позициях.',
        }),
        metric('sell_coverage_uncovered_shares', {
          label: 'Sell Coverage: Uncovered (shares)',
          color: MetricColor.Amber600,
          aggregation: 'last',
          description:
            'Из последнего обработанного hot-batch: сколько купленных контрактов сейчас НЕ покрыто живой заявкой на продажу — либо заявки нет вообще, либо её размер меньше объёма позиции. Устойчиво ненулевое значение стоит проверить — обычно это временное состояние сразу после покупки, до того как sell-заявка выставлена.',
        }),
      ],
    },
    {
      id: 'drop-reasons',
      label: 'Drop Reasons',
      metrics: [
        metric('candidates_stage1_dropped_no_price', {
          label: 'Dropped: No Price',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что по ним нет валидной цены — цена покупки или продажи отсутствует, либо цена покупки оказалась выше цены продажи. Без корректной цены оценить рынок невозможно.',
        }),
        metric('candidates_stage1_dropped_bid_range', {
          label: 'Dropped: Bid Range',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что текущая цена покупки находится за пределами разрешённого диапазона входа V4 — рынок либо слишком дорогой, либо слишком дешёвый по текущим настройкам стратегии.',
        }),
        metric('candidates_stage1_dropped_spread', {
          label: 'Dropped: Spread',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что наивный спред (разница между топ-ценой покупки и топ-ценой продажи) меньше минимального порога. Это только грубая предварительная отсечка — окончательное решение по факту принимает живая проверка эффективного спреда уровня 2 (candidates_stage2_total).',
        }),
        metric('candidates_stage1_dropped_volume', {
          label: 'Dropped: Volume',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что объём торгов по ним меньше минимально допустимого — слишком тихий рынок, чтобы безопасно входить и выходить из позиции.',
        }),
        metric('candidates_stage1_dropped_days_to_end', {
          label: 'Dropped: Days to End',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что до завершения события осталось меньше минимально нужного количества дней. Рынки без даты завершения вообще сюда не попадают — для них отдельная причина, candidates_stage1_dropped_missing_dates.',
        }),
        metric('candidates_stage1_dropped_missing_dates', {
          label: 'Dropped: Missing Dates',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько сторон рынка было отброшено уровнем 1 в этом цикле, потому что у рынка вообще нет даты начала или даты завершения. Раньше такие рынки тихо смешивались с «резолвится слишком скоро» под одной меткой — теперь видно отдельно.',
        }),
        metric('candidates_stage1_dropped_market_age', {
          label: 'Dropped: Market Age',
          color: MetricColor.Slate500,
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
          color: MetricColor.Blue600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько ордеров (заявок на покупку или продажу) сейчас реально стоит у бота на бирже Polymarket, по данным самой биржи. Это общее число открытых заявок прямо сейчас; разбивка на покупку и продажу — в orders_buy и orders_sell.',
        }),
        metric('orders_buy', {
          label: 'Buy Orders',
          color: MetricColor.Blue600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько именно заявок на покупку сейчас стоит открытыми на бирже. Каждая такая заявка — это попытка бота купить контракты на каком-то рынке по конкретной цене, которая ещё не исполнилась.',
        }),
        metric('orders_sell', {
          label: 'Sell Orders',
          color: MetricColor.Blue600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько именно заявок на продажу сейчас стоит открытыми на бирже. Каждая такая заявка защищает уже купленную ботом позицию — она выставлена, чтобы при подходящей цене продать то, что уже куплено.',
        }),
        metric('trade_post', {
          label: 'Post Actions',
          color: MetricColor.Blue600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на покупку или продажу бот реально успешно выставил на биржу в этом цикле — то есть запрос принят биржей. Считает и совсем новые заявки, и те, что появились после переустановки уже стоящей заявки.',
        }),
        metric('trade_cancel', {
          label: 'Cancel Actions',
          color: MetricColor.Blue600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок бот реально успешно отменил на бирже в этом цикле. Считает и самостоятельные отмены, и отмены, которые были частью переустановки заявки.',
        }),
        metric('duplicate_orders_canceled', {
          label: 'Duplicate Orders Canceled',
          color: MetricColor.Amber600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько дублирующих ордеров (несколько живых заявок на одну и ту же сторону одного рынка) бот сам обнаружил и успешно отменил за эту минуту. Ноль — дублей не было. Само наличие дублей — признак гонки между параллельными обработками или сбоя API биржи, а не штатное поведение.',
        }),
        metric('duplicate_orders_not_confirmed', {
          label: 'Duplicate Orders Cancel Not Confirmed',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько попыток отменить обнаруженный дублирующий ордер биржа не подтвердила (запрос прошёл, но статус остался неясен). Токен в этом случае временно приостанавливается для hot-batch до следующего полного обновления account-state (см. account_state_pending_confirmation_total) — реальное состояние неизвестно, полагаться на локальный кэш нельзя.',
        }),
        metric('duplicate_orders_cancel_failed', {
          label: 'Duplicate Orders Cancel Failed',
          color: MetricColor.Red600,
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
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот впервые поставил новую заявку на покупку на рынке, где раньше открытой заявки на покупку не было. Ноль — нормально, если все целевые позиции уже набраны или подходящих новых рынков сейчас нет.',
        }),
        metric('buy_keep', {
          label: 'Buy Keep',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на покупку бот в этом цикле оставил без изменений, потому что цена и размер всё ещё подходящие. Как и с продажей, большое число тут — признак стабильности рынка, а не проблема.',
        }),
        metric('buy_replace', {
          label: 'Buy Replace',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на покупку бот в этом цикле отменил и переставил заново — по новой цене или с новым размером (подробности — в группе Buy: Reasons).',
        }),
        metric('buy_blocked', {
          label: 'Buy Blocked',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот хотел поставить или поддержать заявку на покупку, но не смог — конкретная причина в группе Buy: Reasons.',
        }),
        metric('buy_stop', {
          label: 'Buy Stop',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот в этом цикле отменил полностью, потому что покупать дальше уже не нужно или нельзя — например, нужный размер позиции уже набран, рынок выпал из списка кандидатов или попал в чёрный список. Точная причина — в группе Buy: Reasons.',
        }),
        metric('buy_backoff_active', {
          label: 'Buy Backoff Active',
          color: MetricColor.Orange600,
          aggregation: 'last',
          integerValued: true,
          description:
            'Сколько разных рынков прямо сейчас находятся под активным backoff на стороне покупки — бот временно ничего там не размещает после недавней серии ошибок подряд. Снимается само по себе по истечении таймера backoff.',
        }),
        metric('blacklisted_entries', {
          label: 'Blacklisted Entries',
          color: MetricColor.Orange600,
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
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не смог поставить или обновить заявку на покупку, потому что не было доступного стакана продавцов по этому рынку — без него непонятно, по какой цене безопасно покупать.',
        }),
        metric('buy_blocked_below_min', {
          label: 'Buy Blocked: Below Min',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на покупку, потому что нужный объём докупки оказался меньше минимального размера заявки, разрешённого биржей.',
        }),
        metric('buy_blocked_backoff', {
          label: 'Buy Blocked: Backoff',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле заявка на покупку не была поставлена или обновлена, потому что рынок сейчас под активным backoff (buy_backoff_active) — недавно уже была серия ошибок на этой стороне, и бот временно выжидает вместо того, чтобы сразу пробовать снова.',
        }),
        metric('buy_blocked_trading_halted', {
          label: 'Buy Blocked: Trading Halted',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить или поддерживать заявку на покупку, потому что глобальный стоп-гейт торговли сейчас активен (биржа недавно отвечала 503 или похожей ошибкой достаточно часто, чтобы приостановить новые ордера).',
        }),
        metric('buy_exchange_rejected_insufficient_balance', {
          label: 'Buy Rejected: Insufficient Balance',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько buy-ордеров биржа отклонила именно с кодом insufficient_balance — бот пытался купить, но на балансе не хватило свободных денег на момент размещения. Частые значения здесь — сигнал, что бот претендует на больший объём, чем реально может себе позволить прямо сейчас.',
        }),
        metric('buy_replace_reprice', {
          label: 'Buy Replace: Reprice',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот переставил в этом цикле только из-за изменения цены — желаемый размер позиции не менялся, просто появилась более выгодная цена для входа.',
        }),
        metric('buy_replace_size_change', {
          label: 'Buy Replace: Size Change',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот переставил в этом цикле из-за изменения нужного объёма докупки — например, часть заявки уже исполнилась, или целевой размер позиции изменился, а цена осталась прежней.',
        }),
        metric('buy_stop_no_deficit', {
          label: 'Buy Stop: No Deficit',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что нужный размер позиции уже набран целиком — докупать больше не требуется. Это хороший, ожидаемый исход.',
        }),
        metric('buy_stop_market_dropped_out', {
          label: 'Buy Stop: Market Dropped Out',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что рынок, где уже стояла заявка, перестал проходить фильтры на новый вход — например, спред сузился, объём упал или рынок больше не кандидат уровня 1. Продолжать наращивать позицию там больше нельзя, хотя уже купленное при этом не трогается.',
        }),
        metric('buy_stop_no_candidate', {
          label: 'Buy Stop: No Candidate',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Похоже на buy_stop_market_dropped_out, но для случая, когда заявки на покупку ещё не было: рынок к началу цикла уже не входил в список кандидатов, поэтому новую заявку на покупку по нему даже не стали выставлять.',
        }),
        metric('buy_stop_entry_blacklisted', {
          label: 'Buy Stop: Entry Blacklisted',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил или не стал выставлять в этом цикле из-за того, что рынок попал в чёрный список на покупку (blacklisted_entries) — биржа несколько раз подряд отказала там в покупке из-за нехватки баланса, и бот временно перестал туда заходить.',
        }),
        metric('buy_stop_queue_too_deep', {
          label: 'Buy Stop: Queue Too Deep',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что перед выгодной ценой уже стоит слишком большой объём чужих заявок на покупку (больше разрешённого лимита в USD) — войти по разумной цене сейчас не получится.',
        }),
        metric('buy_stop_effective_spread_too_tight', {
          label: 'Buy Stop: Effective Spread Too Tight',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот отменил в этом цикле, потому что живая проверка эффективного спреда (candidates_stage2_total) прямо сейчас не проходит порог — реальный спред между ценой покупки и продажи на актуальном стакане схлопнулся. Сторону SELL это не касается: уже купленную позицию бот продолжает закрывать независимо от текущего спреда.',
        }),
        metric('buy_stop_capital_preservation', {
          label: 'Buy Stop: Capital Preservation',
          color: MetricColor.Orange600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на покупку бот массово отменил из-за срабатывания cash-floor guard — свободного баланса стало настолько мало, что бот аварийно снимает вообще все BUY-ордера, чтобы не уйти в отрицательный кэш. Это событийная, не по одному токену реакция: срабатывает целиком при каждом обновлении account-state, пока guard активен.',
        }),
      ],
    },
    {
      id: 'sell',
      label: 'Sell Actions',
      metrics: [
        metric('sell_place', {
          label: 'Sell Place',
          color: MetricColor.Pink600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот впервые поставил заявку на продажу по какой-то купленной позиции, у которой раньше не было ни одной заявки на продажу. Ноль — нормально, если все уже купленные позиции и так уже сопровождаются продающими заявками.',
        }),
        metric('sell_dust_liquidation_attempted_shares', {
          label: 'Sell Dust Liquidation Attempted (shares)',
          color: MetricColor.Pink600,
          aggregation: 'sum',
          description:
            'Суммарный объём в контрактах, который бот в этом цикле пытался продать как «пыль» — остаток позиции настолько маленький, что обычная логика продажи его не покрывает. Раз в несколько минут бот отдельно пытается закрыть такие мелкие хвосты позиций (если размещение удалось — попадает также в sell_place).',
        }),
        metric('sell_keep', {
          label: 'Sell Keep',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на продажу бот в этом цикле оставил без изменений, потому что их цена и размер всё ещё оптимальны. Большое число — хороший знак стабильности: бот не дёргает заявки без нужды.',
        }),
        metric('sell_replace', {
          label: 'Sell Replace',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько уже стоящих заявок на продажу бот в этом цикле отменил и переставил заново — по новой цене или с другим размером (подробная причина — в группе Sell: Reasons). Сама переустановка — это нормальная рабочая активность, а не ошибка.',
        }),
        metric('sell_blocked', {
          label: 'Sell Blocked',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот хотел поставить или поддержать заявку на продажу, но не смог — конкретная причина в группе Sell: Reasons.',
        }),
        metric('sell_stop', {
          label: 'Sell Stop',
          color: MetricColor.Pink600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот в этом цикле отменил полностью, без переустановки, потому что продавать больше нечего — позиция уже распродана. Это ожидаемое завершение жизненного цикла позиции, а не сбой.',
        }),
        metric('sell_backoff_active', {
          label: 'Sell Backoff Active',
          color: MetricColor.Pink600,
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
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле бот не смог поставить или обновить заявку на продажу, потому что не было доступного стакана покупателей по этому рынку — без него непонятно, по какой цене продавать безопасно. Ноль — значит со стаканами для продажи всё было в порядке.',
        }),
        metric('sell_blocked_below_min', {
          label: 'Sell Blocked: Below Min',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на продажу, потому что объём, который нужно продать, оказался меньше минимального размера заявки, разрешённого биржей. Обычно касается совсем небольших остатков позиции — это нормальная защита от заявки, которую биржа просто не примет.',
        }),
        metric('sell_blocked_queue_too_deep', {
          label: 'Sell Blocked: Queue Too Deep',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить заявку на продажу, потому что перед выгодной ценой уже стоит слишком большой объём чужих заявок (больше разрешённого лимита в USD) — то есть очередь на продажу слишком глубокая, и заявка бота простояла бы там почти без шансов исполниться по адекватной цене.',
        }),
        metric('sell_blocked_backoff', {
          label: 'Sell Blocked: Backoff',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз в этом цикле заявка на продажу не была поставлена или обновлена, потому что рынок сейчас под активным backoff (sell_backoff_active) на этой стороне — недавно уже была серия ошибок, бот временно выжидает.',
        }),
        metric('sell_blocked_trading_halted', {
          label: 'Sell Blocked: Trading Halted',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько раз бот не стал ставить или поддерживать заявку на продажу, потому что глобальный стоп-гейт торговли сейчас активен (биржа недавно отвечала 503 или похожей ошибкой достаточно часто, чтобы приостановить новые ордера).',
        }),
        metric('sell_replace_reprice', {
          label: 'Sell Replace: Reprice',
          color: MetricColor.Pink600,
          aggregation: 'avg',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле только из-за изменения цены — размер заявки остался тот же, просто рынок изменился и появилась более выгодная или более безопасная цена для продажи. У V4 нет нижней границы цены выхода, поэтому репрайс может уводить цену продажи вниз вслед за рынком без ограничения снизу.',
        }),
        metric('sell_replace_expand', {
          label: 'Sell Replace: Expand',
          color: MetricColor.Pink600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле, увеличив размер. Это происходит, когда позиция выросла — например, докупили ещё контрактов — и старая заявка на продажу покрывала только часть позиции, а новая покрывает больше.',
        }),
        metric('sell_replace_reduce', {
          label: 'Sell Replace: Reduce',
          color: MetricColor.Pink600,
          aggregation: 'sum',
          integerValued: true,
          description:
            'Сколько заявок на продажу бот переставил в этом цикле, уменьшив размер. Обычно это значит, что часть позиции уже была продана ранее, и заявку нужно скорректировать под то, что осталось.',
        }),
        metric('sell_stop_no_inventory', {
          label: 'Sell Stop: No Inventory',
          color: MetricColor.Pink600,
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
          color: MetricColor.Violet600,
          aggregation: 'avg',
          removed: true,
          removedNote: 'Замены нет — шаг убран вместе с V3 `/export`, время discovery теперь в discovery_duration_ms',
          description:
            'Сколько миллисекунд заняли запрос и разбор ответа роута /export у V3 в начале цикла — оттуда V4 получал список рынков с ценами и множество занятых V3 маркет-сайдов. Убрано вместе с переходом V4 на собственный локальный discovery.',
        }),
        metric('v3_occupied_total', {
          label: 'V3 Occupied Total',
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет — понятие «занято V3» ушло вместе с V3-зависимостью',
          description:
            'Сколько маркет-сайдов числились занятыми V3 (по данным снепшота /export) — туда V4 не заходил новыми покупками, чтобы не конкурировать с V3 на своей же стратегии.',
        }),
        metric('dropped_v3_occupied', {
          label: 'Dropped: V3 Occupied',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет, то же',
          description:
            'Сколько сторон рынка было отброшено из кандидатов, потому что маркет-сайд был занят V3 (входил в v3_occupied_total).',
        }),
        metric('catalog_candidates', {
          label: 'Catalog Candidates',
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_total',
          description:
            'Сколько рынков (сторон рынка) из снэпшота в этом цикле проходят все фильтры уровня 1 и считаются подходящими для новой покупки.',
        }),
        metric('dropped_no_price', {
          label: 'Dropped: No Price',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_no_price',
          description:
            'Сколько сторон рынка было отброшено, потому что по ним не пришли нормальные цены покупки/продажи.',
        }),
        metric('dropped_bid_range', {
          label: 'Dropped: Bid Range',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_bid_range',
          description:
            'Сколько сторон рынка было отброшено, потому что текущая цена покупки вне разрешённого диапазона входа.',
        }),
        metric('dropped_spread', {
          label: 'Dropped: Spread',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_spread',
          description:
            'Сколько сторон рынка было отброшено, потому что спред покупки/продажи слишком маленький по порогу V4.',
        }),
        metric('dropped_volume', {
          label: 'Dropped: Volume',
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_volume',
          description:
            'Сколько сторон рынка было отброшено, потому что объём торгов по ним меньше минимально допустимого для V4.',
        }),
        metric('dropped_days_to_end', {
          label: 'Dropped: Days to End',
          color: MetricColor.Slate500,
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
          color: MetricColor.Slate500,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь candidates_stage1_dropped_market_age',
          description:
            'Сколько сторон рынка было отброшено, потому что сам рынок слишком молодой, создан совсем недавно.',
        }),
        metric('worklist_candidates', {
          label: 'Worklist Candidates',
          color: MetricColor.Cyan600,
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
          color: MetricColor.Cyan600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь legacy_positions',
          description:
            'Сколько рынков в текущем рабочем списке бота больше не входят в список кандидатов, но у бота там либо открытая позиция, либо открытый ордер.',
        }),
        metric('estimated_account_value', {
          label: 'Estimated Account Value',
          color: MetricColor.Green600,
          unit: 'money',
          aggregation: 'last',
          removed: true,
          removedNote:
            'Замены нет (см. plans/32) — считалась поверх стакана по всему инвентарю на каждом проходе; event-driven архитектура нарочно не тянет книги по тихим токенам, оживление метрики означало бы вернуть тот самый REST-трафик, от которого ушли. Осталась только free_cash (бесплатная часть — из уже читаемого баланса).',
          description:
            'Оценочная полная стоимость торгового счёта в USD: свободные деньги (free_cash) плюс то, сколько реально можно было бы получить, если бы бот сейчас продал все купленные позиции по текущим ценам в стакане (estimated_open_positions_value).',
        }),
        metric('estimated_open_positions_value', {
          label: 'Estimated Open Positions Value',
          color: MetricColor.Green600,
          unit: 'money',
          aggregation: 'last',
          removed: true,
          removedNote: 'Замены нет — см. estimated_account_value',
          description: 'Сколько реально можно было бы получить прямо сейчас, если бы бот продал все открытые позиции по текущим ценам в стакане.',
        }),
        metric('open_positions_no_book_count', {
          label: 'Open Positions: No Book',
          color: MetricColor.Amber600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет — см. estimated_account_value',
          description: 'Сколько позиций остались без стакана заявок на покупку, необходимого для оценки estimated_open_positions_value.',
        }),
        metric('open_positions_empty_bid_count', {
          label: 'Open Positions: Empty Bid',
          color: MetricColor.Amber600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет — см. estimated_account_value',
          description: 'Стакан по рынку есть, но заявок на покупку в нём нет ни одной.',
        }),
        metric('open_positions_partial_depth_count', {
          label: 'Open Positions: Partial Depth',
          color: MetricColor.Amber600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote: 'Замены нет — см. estimated_account_value',
          description: 'Заявок на покупку хватило только на часть позиции.',
        }),
        metric('open_positions_uncovered_shares', {
          label: 'Open Positions: Uncovered Shares',
          color: MetricColor.Amber600,
          aggregation: 'last',
          removed: true,
          removedNote: 'Замены нет — см. estimated_account_value',
          description: 'Сколько контрактов из купленных позиций не оценены в деньгах из-за нехватки стакана.',
        }),
        metric('reconcile_cycles', {
          label: 'Reconcile Cycles',
          aggregation: 'avg',
          integerValued: true,
          removed: true,
          removedNote: 'Понятия «цикл» больше нет (см. plans/32) — ближайший аналог hot_batches_total (Event Layer Health)',
          description: 'Сколько reconcile-циклов бот успел завершить за эту минуту.',
        }),
        metric('no_mutation_streak', {
          label: 'No-Mutation Streak',
          color: MetricColor.Amber600,
          aggregation: 'last',
          integerValued: true,
          removed: true,
          removedNote:
            'Замены нет (см. plans/32) — событийная архитектура не порождает батчей по тихим токенам вообще, поэтому «цикл без изменений» больше не имеет прежнего смысла',
          description: 'Сколько торговых циклов подряд бот не сделал ни одного реального изменения ордеров.',
        }),
        metric('reconcile_failures_fetch_account', {
          label: 'Reconcile Failures: Fetch Account',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь reconcile_failures_account_state_refresh',
          description: 'Сколько раз цикл сорвался именно на шаге получения базового состояния счёта с биржи.',
        }),
        metric('reconcile_failures_fetch_books', {
          label: 'Reconcile Failures: Fetch Books',
          color: MetricColor.Red600,
          aggregation: 'sum',
          integerValued: true,
          removed: true,
          removedNote: 'Теперь reconcile_failures_hot_batch_reconcile (и reconcile_failures_dust_sweep_reconcile для dust-sweep)',
          description: 'Сколько раз цикл сорвался именно на шаге загрузки стаканов по рабочему списку.',
        }),
        metric('fetch_ms', {
          label: 'Fetch Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          removed: true,
          removedNote: 'Теперь account_state_refresh_ms (Performance)',
          description: 'Сколько миллисекунд заняло получение базового состояния счёта с биржи в начале цикла.',
        }),
        metric('books_ms', {
          label: 'Books Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          removed: true,
          removedNote: 'Теперь входит в hot_batch_ms (Performance) — событийная архитектура больше не разделяет books-фетч и reconcile на отдельные измеримые фазы одного цикла',
          description: 'Сколько миллисекунд заняла загрузка стаканов по всем рынкам из рабочего списка.',
        }),
        metric('reconcile_ms', {
          label: 'Reconcile Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          removed: true,
          removedNote: 'Теперь входит в hot_batch_ms (Performance)',
          description: 'Сколько миллисекунд заняло принятие и исполнение всех торговых решений в цикле.',
        }),
        metric('cycle_duration_ms', {
          label: 'Cycle Duration (ms)',
          color: MetricColor.Violet600,
          aggregation: 'avg',
          removed: true,
          removedNote: 'Теперь hot_batch_ms (Performance) — на масштабе одного hot-batch, а не фиксированного 60-секундного цикла',
          description: 'Сколько миллисекунд занял весь торговый цикл целиком.',
        }),
      ],
    },
    {
      id: 'process',
      label: 'Bot Process',
      metrics: [
        metric('process_cpu_ratio_avg', {
          label: 'Bot CPU Avg',
          color: MetricColor.Red600,
          aggregation: 'avg',
          description: 'Средняя доля общей CPU-мощности сервера, которую за минуту съел сам процесс бота.',
        }),
        metric('process_cpu_ratio_max', {
          label: 'Bot CPU Peak',
          color: MetricColor.Red500,
          aggregation: 'max',
          description: 'Пиковая доля CPU сервера, которую занимал процесс бота в одном из 5-секундных замеров этой минуты.',
        }),
        metric('process_rss_bytes', {
          label: 'Bot RSS',
          color: MetricColor.Orange600,
          aggregation: 'avg',
          description: 'Текущий RSS процесса бота: сколько физической памяти реально держит сам сервис прямо сейчас.',
        }),
      ],
    },
  ],
};
