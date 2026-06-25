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
        label: 'Pulse',
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
        label: 'Markets and Candidates',
        metrics: ['catalog_candidates', 'catalog_markets_total', 'worklist_candidates', 'worklist_ex_candidates'],
      },
      {
        id: 'orders',
        label: 'Orders and Trades',
        metrics: ['orders_total', 'orders_buy', 'orders_sell', 'trade_post', 'trade_cancel'],
      },
      {
        id: 'buy',
        label: 'Buy Actions',
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
        label: 'Sell Actions',
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
        label: 'Performance',
        metrics: ['fetch_ms', 'books_ms', 'reconcile_ms', 'cycle_duration_ms', 'discovery_duration_ms'],
      },
      {
        id: 'discovery-filters',
        label: 'Discovery Drop Reasons',
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
        label: 'Activity',
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
    food_diary_entry_created: 'Food Entries Created',
    food_diary_entry_updated: 'Food Entries Updated',
    food_diary_entry_deleted: 'Food Entries Deleted',
    food_diary_day_deleted: 'Food Days Deleted',
    food_diary_day_restored: 'Food Days Restored',
    food_body_weight_updated: 'Body Weight Updates',
    food_catalogue_entry_created: 'Products Created',
    food_catalogue_entry_updated: 'Products Updated',
    food_catalogue_entry_deleted: 'Products Deleted',
    food_coefficients_job_ran: 'Coefficients Job Runs',
    backup_job_ran: 'Backup Job Runs',
  },
  'spread-capture-bot-v3': {
    free_cash: 'Free Cash',
    estimated_account_value: 'Estimated Account Value',
    catalog_candidates: 'Catalog Candidates',
    catalog_markets_total: 'Catalog Markets Total',
    worklist_candidates: 'Worklist Candidates',
    worklist_ex_candidates: 'Worklist Ex-Candidates',
    orders_total: 'Open Orders',
    orders_buy: 'Buy Orders',
    orders_sell: 'Sell Orders',
    books_missing: 'Missing Books',
    cycle_errors: 'Cycle Errors',
    reconcile_failures: 'Reconcile Failures',
    no_mutation_streak: 'No-Mutation Streak',
    blacklisted_entries: 'Blacklisted Entries',
    fetch_ms: 'Fetch Duration (ms)',
    books_ms: 'Books Duration (ms)',
    reconcile_ms: 'Reconcile Duration (ms)',
    cycle_duration_ms: 'Cycle Duration (ms)',
    sell_place: 'Sell Place',
    sell_keep: 'Sell Keep',
    sell_replace: 'Sell Replace',
    sell_blocked: 'Sell Blocked',
    sell_stop: 'Sell Stop',
    buy_place: 'Buy Place',
    buy_keep: 'Buy Keep',
    buy_replace: 'Buy Replace',
    buy_blocked: 'Buy Blocked',
    buy_stop: 'Buy Stop',
    trade_post: 'Post Actions',
    trade_cancel: 'Cancel Actions',
    sell_blocked_no_book: 'Sell Blocked: No Book',
    sell_blocked_below_min: 'Sell Blocked: Below Min',
    sell_blocked_queue_too_deep: 'Sell Blocked: Queue Too Deep',
    sell_replace_reprice: 'Sell Replace: Reprice',
    sell_replace_expand: 'Sell Replace: Expand',
    sell_replace_reduce: 'Sell Replace: Reduce',
    sell_stop_no_inventory: 'Sell Stop: No Inventory',
    buy_blocked_no_book: 'Buy Blocked: No Book',
    buy_blocked_below_min: 'Buy Blocked: Below Min',
    buy_replace_reprice: 'Buy Replace: Reprice',
    buy_replace_size_change: 'Buy Replace: Size Change',
    buy_stop_no_deficit: 'Buy Stop: No Deficit',
    buy_stop_market_dropped_out: 'Buy Stop: Market Dropped Out',
    buy_stop_no_candidate: 'Buy Stop: No Candidate',
    buy_stop_entry_blacklisted: 'Buy Stop: Entry Blacklisted',
    buy_stop_queue_too_deep: 'Buy Stop: Queue Too Deep',
    discovery_errors: 'Discovery Errors',
    discovery_dropped_date_like: 'Discovery Dropped: Date-Like',
    discovery_dropped_no_price: 'Discovery Dropped: No Price',
    discovery_dropped_bid_range: 'Discovery Dropped: Bid Range',
    discovery_dropped_spread: 'Discovery Dropped: Spread',
    discovery_dropped_volume: 'Discovery Dropped: Volume',
    discovery_dropped_days_to_end: 'Discovery Dropped: Days to End',
    discovery_dropped_market_age: 'Discovery Dropped: Market Age',
    discovery_duration_ms: 'Discovery Duration (ms)',
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
