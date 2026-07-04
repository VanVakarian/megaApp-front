// avg - для непрерывных величин (ratio/durationMs/money/load average), где дробный
// результат осмыслен. avgRound - для метрик, чьи сырые значения всегда целые
// (счётчики событий), но которые всё равно хотим усреднять, а не суммировать при
// схлопывании 1m->5m - дробное среднее там выглядело бы как артефакт, а не факт.
export type MetricAggregation = 'avg' | 'avgRound' | 'max' | 'sum' | 'last';

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
    case 'avgRound': {
      let sum = 0;
      for (const value of values) {
        sum += value;
      }
      return Math.round(sum / values.length);
    }
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
