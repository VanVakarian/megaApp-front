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

const METRICS_SERVICE_VARIANTS: Record<string, { baseService: string; label: string }> = {
  'megaapp-test': { baseService: 'megaapp', label: 'MegaApp Test' },
};

const HARDWARE_SERVICE_PREFIX = 'hardware:';

const HARDWARE_SERVICE_DEFINITION: MetricsServiceDefinition = {
  service: HARDWARE_SERVICE_PREFIX,
  label: 'Hardware Server',
  groups: [
    {
      id: 'cpu',
      label: 'CPU and Load',
      metrics: [
        'cpu_busy_ratio_avg',
        'cpu_busy_ratio_max',
        'cpu_iowait_ratio_avg',
        'cpu_iowait_ratio_max',
        'cpu_steal_ratio_avg',
        'cpu_steal_ratio_max',
        'load1',
        'load5',
        'load15',
      ],
    },
    {
      id: 'memory',
      label: 'Memory',
      metrics: ['memory_used_ratio', 'memory_available_bytes', 'memory_total_bytes', 'process_rss_bytes'],
    },
    {
      id: 'disk',
      label: 'Disk',
      metrics: ['disk_used_ratio', 'disk_free_bytes', 'uptime_seconds'],
    },
    {
      id: 'process',
      label: 'Flatline Process',
      metrics: ['process_cpu_ratio_avg', 'process_cpu_ratio_max'],
    },
  ],
  metricColors: {
    cpu_busy_ratio_avg: '#dc2626',
    cpu_busy_ratio_max: '#ef4444',
    cpu_iowait_ratio_avg: '#2563eb',
    cpu_iowait_ratio_max: '#60a5fa',
    cpu_steal_ratio_avg: '#7c3aed',
    cpu_steal_ratio_max: '#a78bfa',
    load1: '#0891b2',
    load5: '#0f766e',
    load15: '#14b8a6',
    memory_used_ratio: '#ea580c',
    memory_available_bytes: '#16a34a',
    memory_total_bytes: '#65a30d',
    process_rss_bytes: '#84cc16',
    disk_used_ratio: '#d97706',
    disk_free_bytes: '#f59e0b',
    uptime_seconds: '#64748b',
    process_cpu_ratio_avg: '#db2777',
    process_cpu_ratio_max: '#ec4899',
  },
};

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
        id: 'performance',
        label: 'Performance',
        metrics: ['fetch_ms', 'books_ms', 'reconcile_ms', 'cycle_duration_ms', 'discovery_duration_ms'],
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
          'food_personal_kcal_job_ran',
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
      food_personal_kcal_job_ran: '#64748b',
      backup_job_ran: '#64748b',
    },
  },
  {
    service: 'sozvon-konspekt',
    label: 'Sozvon Konspekt',
    groups: [
      {
        id: 'recognition',
        label: 'Recognition',
        metrics: ['recognition_success', 'recognition_failed', 'recognition_cost_usd'],
      },
      {
        id: 'performance',
        label: 'Performance',
        metrics: ['convert_time_ratio', 'recognition_time_ratio'],
      },
      {
        id: 'reliability',
        label: 'Reliability',
        metrics: ['application_errors'],
      },
    ],
    metricColors: {
      recognition_success: '#16a34a',
      recognition_failed: '#dc2626',
      recognition_cost_usd: '#2563eb',
      convert_time_ratio: '#7c3aed',
      recognition_time_ratio: '#a78bfa',
      application_errors: '#ea580c',
    },
  },
];

const METRIC_LABELS: Record<string, Record<string, string>> = {
  hardware: {
    cpu_busy_ratio_avg: 'CPU Busy Avg',
    cpu_busy_ratio_max: 'CPU Busy Peak',
    cpu_iowait_ratio_avg: 'CPU IOwait Avg',
    cpu_iowait_ratio_max: 'CPU IOwait Peak',
    cpu_steal_ratio_avg: 'CPU Steal Avg',
    cpu_steal_ratio_max: 'CPU Steal Peak',
    load1: 'Load 1m',
    load5: 'Load 5m',
    load15: 'Load 15m',
    memory_used_ratio: 'Memory Used Ratio',
    memory_available_bytes: 'Memory Available',
    memory_total_bytes: 'Memory Total',
    disk_used_ratio: 'Disk Used Ratio',
    disk_free_bytes: 'Disk Free',
    uptime_seconds: 'Uptime',
    process_rss_bytes: 'Flatline RSS',
    process_cpu_ratio_avg: 'Flatline CPU Avg',
    process_cpu_ratio_max: 'Flatline CPU Peak',
  },
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
    food_personal_kcal_job_ran: 'Personal Kcal Job Runs',
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
  'sozvon-konspekt': {
    recognition_success: 'Successful Recognitions',
    recognition_failed: 'Failed Recognitions',
    recognition_cost_usd: 'Recognition Cost',
    convert_time_ratio: 'Conversion Time Ratio',
    recognition_time_ratio: 'Recognition Time Ratio',
    application_errors: 'Application Errors',
  },
};

function isHardwareService(service: string): boolean {
  return service.startsWith(HARDWARE_SERVICE_PREFIX);
}

function hardwareServiceLabel(service: string): string {
  const suffix = service.slice(HARDWARE_SERVICE_PREFIX.length).trim();
  if (!suffix) {
    return HARDWARE_SERVICE_DEFINITION.label;
  }
  return `Hardware: ${suffix}`;
}

export function metricsServiceDefinition(service: string | null | undefined): MetricsServiceDefinition | null {
  if (!service) return null;

  const definition = METRICS_SERVICE_DEFINITIONS.find((item) => item.service === service);
  if (definition) {
    return definition;
  }
  if (isHardwareService(service)) {
    return { ...HARDWARE_SERVICE_DEFINITION, service, label: hardwareServiceLabel(service) };
  }

  const variant = METRICS_SERVICE_VARIANTS[service];
  if (!variant) {
    return null;
  }

  const baseDefinition = METRICS_SERVICE_DEFINITIONS.find((item) => item.service === variant.baseService);
  if (!baseDefinition) {
    return null;
  }

  return { ...baseDefinition, service, label: variant.label };
}

export function metricsServiceDefinitions(): MetricsServiceDefinition[] {
  return METRICS_SERVICE_DEFINITIONS;
}

export function metricsServiceLabel(service: string): string {
  if (isHardwareService(service)) {
    return hardwareServiceLabel(service);
  }
  return METRICS_SERVICE_VARIANTS[service]?.label ?? metricsServiceDefinition(service)?.label ?? service;
}

export function metricLabel(service: string, name: string): string {
  const catalogService = isHardwareService(service)
    ? 'hardware'
    : (METRICS_SERVICE_VARIANTS[service]?.baseService ?? service);
  return METRIC_LABELS[catalogService]?.[name] ?? name;
}
