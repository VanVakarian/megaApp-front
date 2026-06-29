export type MetricAggregation = 'avg' | 'max' | 'sum' | 'last';

const SUM_METRICS = new Set<string>([
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
  'food_personal_kcal_job_ran',
  'backup_job_ran',
  'reconcile_cycles',
  'filtered_out',
  'sell_place',
  'sell_keep',
  'sell_replace',
  'sell_blocked',
  'sell_stop',
  'buy_place',
  'buy_keep',
  'buy_replace',
  'buy_blocked',
  'buy_stop',
  'trade_post',
  'trade_cancel',
  'cycle_errors',
  'sell_blocked_no_book',
  'sell_blocked_below_min',
  'sell_blocked_queue_too_deep',
  'sell_replace_reprice',
  'sell_replace_expand',
  'sell_replace_reduce',
  'sell_stop_no_inventory',
  'buy_blocked_no_book',
  'buy_blocked_below_min',
  'buy_replace_reprice',
  'buy_replace_size_change',
  'buy_stop_no_deficit',
  'buy_stop_market_dropped_out',
  'buy_stop_no_candidate',
  'buy_stop_entry_blacklisted',
  'buy_stop_queue_too_deep',
  'discovery_errors',
  'reconcile_failures',
  'reconcile_failures_fetch_account',
  'reconcile_failures_fetch_books',
  'recognition_success',
  'recognition_failed',
  'recognition_cost_usd',
  'application_errors',
]);

const LAST_METRICS = new Set<string>([
  'free_cash',
  'estimated_account_value',
  'uptime_seconds',
  'heartbeat',
  'worklist_candidates',
  'worklist_ex_candidates',
  'orders_total',
  'orders_buy',
  'orders_sell',
  'books_missing',
  'no_mutation_streak',
  'blacklisted_entries',
  'catalog_candidates',
  'catalog_markets_total',
  'discovery_dropped_date_like',
  'discovery_dropped_no_price',
  'discovery_dropped_bid_range',
  'discovery_dropped_spread',
  'discovery_dropped_volume',
  'discovery_dropped_days_to_end',
  'discovery_dropped_market_age',
  'export_pending_snapshots',
]);

const AVG_SUFFIX = /_avg$/; // *_avg minute averages
const MAX_SUFFIX = /_max$/; // *_max minute peaks
const DURATION_SUFFIX = /_ms$/; // *_ms durations
const GAUGE_SUFFIX = /_(ratio|bytes)$/; // *_ratio and *_bytes gauges

export function metricAggregation(name: string): MetricAggregation {
  if (SUM_METRICS.has(name)) {
    return 'sum';
  }
  if (LAST_METRICS.has(name)) {
    return 'last';
  }
  if (AVG_SUFFIX.test(name)) {
    return 'avg';
  }
  if (MAX_SUFFIX.test(name)) {
    return 'max';
  }
  if (DURATION_SUFFIX.test(name)) {
    return 'avg';
  }
  if (GAUGE_SUFFIX.test(name)) {
    return 'avg';
  }
  return 'avg';
}

export function aggregateMetricValues(aggregation: MetricAggregation, values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  switch (aggregation) {
    case 'max': {
      let max = values[0];
      for (const value of values.slice(1)) {
        if (value > max) {
          max = value;
        }
      }
      return max;
    }
    case 'sum': {
      let sum = 0;
      for (const value of values) {
        sum += value;
      }
      return sum;
    }
    case 'last':
      return values[values.length - 1];
    case 'avg':
    default: {
      let sum = 0;
      for (const value of values) {
        sum += value;
      }
      return sum / values.length;
    }
  }
}
