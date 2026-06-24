export interface MetricsGroupDefinition {
  id: string;
  label: string;
  metrics: string[];
}

export interface MetricsServiceDefinition {
  service: string;
  label: string;
  groups: MetricsGroupDefinition[];
  metricColors: Record<string, string>;
}

const METRICS_SERVICE_DEFINITIONS: MetricsServiceDefinition[] = [
  {
    service: 'spread-capture-bot-v3',
    label: 'Spread Capture Bot V3',
    groups: [
      {
        id: 'pulse',
        label: 'Пульс',
        metrics: [
          'free_cash',
          'estimated_account_value',
          'cycle_errors',
          'reconcile_failures',
          'discovery_errors',
          'books_missing',
          'blacklisted_entries',
          'no_mutation_streak',
        ],
      },
      {
        id: 'market',
        label: 'Рынки и кандидаты',
        metrics: ['catalog_candidates', 'catalog_markets_total', 'worklist_candidates', 'worklist_ex_candidates'],
      },
      {
        id: 'orders',
        label: 'Ордера и сделки',
        metrics: ['orders_total', 'orders_buy', 'orders_sell', 'trade_post', 'trade_cancel'],
      },
      {
        id: 'buy',
        label: 'Действия: покупка',
        metrics: [
          'buy_place',
          'buy_keep',
          'buy_replace',
          'buy_blocked',
          'buy_stop',
          'buy_blocked_no_book',
          'buy_blocked_below_min',
          'buy_replace_reprice',
          'buy_replace_size_change',
          'buy_stop_no_deficit',
          'buy_stop_market_dropped_out',
          'buy_stop_no_candidate',
          'buy_stop_entry_blacklisted',
          'buy_stop_queue_too_deep',
        ],
      },
      {
        id: 'sell',
        label: 'Действия: продажа',
        metrics: [
          'sell_place',
          'sell_keep',
          'sell_replace',
          'sell_blocked',
          'sell_stop',
          'sell_blocked_no_book',
          'sell_blocked_below_min',
          'sell_blocked_queue_too_deep',
          'sell_replace_reprice',
          'sell_replace_expand',
          'sell_replace_reduce',
          'sell_stop_no_inventory',
        ],
      },
      {
        id: 'performance',
        label: 'Производительность',
        metrics: ['fetch_ms', 'books_ms', 'reconcile_ms', 'cycle_duration_ms', 'discovery_duration_ms'],
      },
      {
        id: 'discovery-filters',
        label: 'Причины отсева рынков',
        metrics: [
          'discovery_dropped_date_like',
          'discovery_dropped_no_price',
          'discovery_dropped_bid_range',
          'discovery_dropped_spread',
          'discovery_dropped_volume',
          'discovery_dropped_days_to_end',
          'discovery_dropped_market_age',
        ],
      },
    ],
    metricColors: {
      free_cash: '#16a34a',
      estimated_account_value: '#16a34a',
      cycle_errors: '#dc2626',
      reconcile_failures: '#dc2626',
      discovery_errors: '#dc2626',
      books_missing: '#d97706',
      blacklisted_entries: '#d97706',
      no_mutation_streak: '#d97706',
      catalog_candidates: '#0891b2',
      catalog_markets_total: '#0891b2',
      worklist_candidates: '#0891b2',
      worklist_ex_candidates: '#0891b2',
      orders_total: '#2563eb',
      orders_buy: '#2563eb',
      orders_sell: '#2563eb',
      trade_post: '#2563eb',
      trade_cancel: '#2563eb',
      buy_place: '#ea580c',
      buy_keep: '#ea580c',
      buy_replace: '#ea580c',
      buy_blocked: '#ea580c',
      buy_stop: '#ea580c',
      buy_blocked_no_book: '#ea580c',
      buy_blocked_below_min: '#ea580c',
      buy_replace_reprice: '#ea580c',
      buy_replace_size_change: '#ea580c',
      buy_stop_no_deficit: '#ea580c',
      buy_stop_market_dropped_out: '#ea580c',
      buy_stop_no_candidate: '#ea580c',
      buy_stop_entry_blacklisted: '#ea580c',
      buy_stop_queue_too_deep: '#ea580c',
      sell_place: '#db2777',
      sell_keep: '#db2777',
      sell_replace: '#db2777',
      sell_blocked: '#db2777',
      sell_stop: '#db2777',
      sell_blocked_no_book: '#db2777',
      sell_blocked_below_min: '#db2777',
      sell_blocked_queue_too_deep: '#db2777',
      sell_replace_reprice: '#db2777',
      sell_replace_expand: '#db2777',
      sell_replace_reduce: '#db2777',
      sell_stop_no_inventory: '#db2777',
      fetch_ms: '#7c3aed',
      books_ms: '#7c3aed',
      reconcile_ms: '#7c3aed',
      cycle_duration_ms: '#7c3aed',
      discovery_duration_ms: '#7c3aed',
      discovery_dropped_date_like: '#64748b',
      discovery_dropped_no_price: '#64748b',
      discovery_dropped_bid_range: '#64748b',
      discovery_dropped_spread: '#64748b',
      discovery_dropped_volume: '#64748b',
      discovery_dropped_days_to_end: '#64748b',
      discovery_dropped_market_age: '#64748b',
    },
  },
  {
    service: 'megaapp',
    label: 'MegaApp',
    groups: [
      {
        id: 'activity',
        label: 'Активность',
        metrics: [
          'food_diary_entry_created',
          'food_diary_entry_updated',
          'food_diary_entry_deleted',
          'food_diary_day_deleted',
          'food_diary_day_restored',
          'food_body_weight_updated',
          'food_catalogue_entry_created',
          'food_catalogue_entry_updated',
          'food_catalogue_entry_deleted',
          'food_coefficients_job_ran',
          'backup_job_ran',
        ],
      },
    ],
    metricColors: {
      food_diary_entry_created: '#16a34a',
      food_diary_entry_updated: '#16a34a',
      food_diary_entry_deleted: '#16a34a',
      food_diary_day_deleted: '#16a34a',
      food_diary_day_restored: '#16a34a',
      food_body_weight_updated: '#16a34a',
      food_catalogue_entry_created: '#0891b2',
      food_catalogue_entry_updated: '#0891b2',
      food_catalogue_entry_deleted: '#0891b2',
      food_coefficients_job_ran: '#64748b',
      backup_job_ran: '#64748b',
    },
  },
];

const METRIC_LABELS: Record<string, Record<string, string>> = {
  megaapp: {
    food_diary_entry_created: 'Создано записей',
    food_diary_entry_updated: 'Изменено записей',
    food_diary_entry_deleted: 'Удалено записей',
    food_diary_day_deleted: 'Удалено дней',
    food_diary_day_restored: 'Восстановлено дней',
    food_body_weight_updated: 'Изменения веса',
    food_catalogue_entry_created: 'Создано продуктов',
    food_catalogue_entry_updated: 'Изменено продуктов',
    food_catalogue_entry_deleted: 'Удалено продуктов',
    food_coefficients_job_ran: 'Прогоны коэффициентов',
    backup_job_ran: 'Прогоны бэкапа',
  },
  'spread-capture-bot-v3': {
    free_cash: 'Свободный кэш',
    estimated_account_value: 'Текущая стоимость портфеля',
    catalog_candidates: 'Кандидаты в каталоге',
    catalog_markets_total: 'Рынки в каталоге',
    worklist_candidates: 'Worklist кандидаты',
    worklist_ex_candidates: 'Worklist ex-candidates',
    orders_total: 'Открытые ордера',
    orders_buy: 'Ордера BUY',
    orders_sell: 'Ордера SELL',
    books_missing: 'Отсутствующие книги',
    cycle_errors: 'Ошибки цикла',
    reconcile_failures: 'Срывы цикла',
    no_mutation_streak: 'Streak без мутаций',
    blacklisted_entries: 'Blacklist entries',
    fetch_ms: 'Fetch ms',
    books_ms: 'Books ms',
    reconcile_ms: 'Reconcile ms',
    cycle_duration_ms: 'Cycle duration ms',
    sell_place: 'SELL place',
    sell_keep: 'SELL keep',
    sell_replace: 'SELL replace',
    sell_blocked: 'SELL blocked',
    sell_stop: 'SELL stop',
    buy_place: 'BUY place',
    buy_keep: 'BUY keep',
    buy_replace: 'BUY replace',
    buy_blocked: 'BUY blocked',
    buy_stop: 'BUY stop',
    trade_post: 'Post actions',
    trade_cancel: 'Cancel actions',
    sell_blocked_no_book: 'SELL blocked: no book',
    sell_blocked_below_min: 'SELL blocked: below min',
    sell_blocked_queue_too_deep: 'SELL blocked: queue deep',
    sell_replace_reprice: 'SELL replace: reprice',
    sell_replace_expand: 'SELL replace: expand',
    sell_replace_reduce: 'SELL replace: reduce',
    sell_stop_no_inventory: 'SELL stop: no inventory',
    buy_blocked_no_book: 'BUY blocked: no book',
    buy_blocked_below_min: 'BUY blocked: below min',
    buy_replace_reprice: 'BUY replace: reprice',
    buy_replace_size_change: 'BUY replace: size change',
    buy_stop_no_deficit: 'BUY stop: no deficit',
    buy_stop_market_dropped_out: 'BUY stop: market out',
    buy_stop_no_candidate: 'BUY stop: no candidate',
    buy_stop_entry_blacklisted: 'BUY stop: blacklisted',
    buy_stop_queue_too_deep: 'BUY stop: queue deep',
    discovery_errors: 'Discovery errors',
    discovery_dropped_date_like: 'Dropped date-like',
    discovery_dropped_no_price: 'Dropped no price',
    discovery_dropped_bid_range: 'Dropped bid range',
    discovery_dropped_spread: 'Dropped spread',
    discovery_dropped_volume: 'Dropped volume',
    discovery_dropped_days_to_end: 'Dropped near end',
    discovery_dropped_market_age: 'Dropped young market',
    discovery_duration_ms: 'Discovery duration ms',
  },
};

export function metricsServiceDefinition(service: string | null | undefined): MetricsServiceDefinition | null {
  if (!service) return null;
  return METRICS_SERVICE_DEFINITIONS.find((definition) => definition.service === service) ?? null;
}

export function metricsServiceDefinitions(): MetricsServiceDefinition[] {
  return METRICS_SERVICE_DEFINITIONS;
}

export function metricsServiceLabel(service: string): string {
  return metricsServiceDefinition(service)?.label ?? service;
}

export function metricLabel(service: string, name: string): string {
  return METRIC_LABELS[service]?.[name] ?? name;
}
