import { metric, MetricsServiceDefinition } from '@app/shared/metrics-catalog-metric';

export const HARDWARE_METRICS_DEFINITION: MetricsServiceDefinition = {
  service: 'hardware:',
  label: 'Hardware Server',
  groups: [
    {
      id: 'cpu',
      label: 'CPU and Load',
      metrics: [
        metric('cpu_busy_ratio_avg', {
          label: 'CPU Busy Avg',
          color: '#dc2626',
          aggregation: 'avg',
          description:
            'Средняя доля CPU, реально занятая полезной работой за эту минуту. 0% означает почти полный простой, 100% — все ядра были забиты работой почти без пауз.',
        }),
        metric('cpu_busy_ratio_max', {
          label: 'CPU Busy Peak',
          color: '#ef4444',
          aggregation: 'max',
          description:
            'Пиковая доля занятого CPU среди 5-секундных замеров внутри минуты. Показывает короткие всплески, которые могли сгладиться в среднем значении.',
        }),
        metric('cpu_iowait_ratio_avg', {
          label: 'CPU IOwait Avg',
          color: '#2563eb',
          aggregation: 'avg',
          description:
            'Средняя доля времени, когда CPU ждал завершения дискового ввода-вывода. Рост обычно означает, что упираемся не в вычисления, а в диск или сеть хранения.',
        }),
        metric('cpu_iowait_ratio_max', {
          label: 'CPU IOwait Peak',
          color: '#60a5fa',
          aggregation: 'max',
          description: 'Пиковая доля ожидания диска внутри минуты. Полезно для коротких, но заметных IO-всплесков.',
        }),
        metric('cpu_steal_ratio_avg', {
          label: 'CPU Steal Avg',
          color: '#7c3aed',
          aggregation: 'avg',
          description:
            'Средняя доля времени, которую гипервизор забрал у этой VM в пользу других соседей по физическому хосту. Важная метрика именно для VPS.',
        }),
        metric('cpu_steal_ratio_max', {
          label: 'CPU Steal Peak',
          color: '#a78bfa',
          aggregation: 'max',
          description:
            'Пиковое значение steal внутри минуты. Если скачет, проблема может быть в соседях по хосту, а не в самом приложении.',
        }),
        metric('load1', {
          label: 'Load 1m',
          color: '#0891b2',
          unit: 'count',
          aggregation: 'avg',
          description: 'Системный load average за 1 минуту. Это уже сглаженное ядром значение, не моментный пик.',
        }),
        metric('load5', {
          label: 'Load 5m',
          color: '#0f766e',
          unit: 'count',
          aggregation: 'avg',
          description: 'Системный load average за 5 минут. Хорошо показывает устойчивую тенденцию, а не короткий всплеск.',
        }),
        metric('load15', {
          label: 'Load 15m',
          color: '#14b8a6',
          unit: 'count',
          aggregation: 'avg',
          description: 'Системный load average за 15 минут. Самая инертная линия, полезна для общего фона нагрузки.',
        }),
      ],
    },
    {
      id: 'memory',
      label: 'Memory',
      metrics: [
        metric('memory_used_ratio', {
          label: 'Memory Used Ratio',
          color: '#ea580c',
          aggregation: 'avg',
          description:
            'Доля реально занятой памяти, посчитанная через MemAvailable, а не через MemFree. То есть без ложной паники из-за page cache Linux.',
        }),
        metric('memory_available_bytes', {
          label: 'Memory Available',
          color: '#16a34a',
          aggregation: 'avg',
          description:
            'Сколько памяти система ещё может отдать приложениям без серьёзного давления. Это полезнее, чем просто free memory.',
        }),
        metric('memory_total_bytes', {
          label: 'Memory Total',
          color: '#65a30d',
          aggregation: 'avg',
          description: 'Общий объём RAM, который видит система.',
        }),
        metric('process_rss_bytes', {
          label: 'Flatline RSS',
          color: '#84cc16',
          aggregation: 'avg',
          description: 'Текущий RSS процесса Flatline: сколько физической памяти реально держит сам сервис прямо сейчас.',
        }),
      ],
    },
    {
      id: 'disk',
      label: 'Disk',
      metrics: [
        metric('disk_free_bytes', {
          label: 'Disk Free',
          color: '#f59e0b',
          aggregation: 'avg',
          description: 'Сколько свободного места осталось на корневом диске сервера, в байтах.',
        }),
        metric('disk_used_bytes', {
          label: 'Disk Used',
          color: '#b45309',
          aggregation: 'avg',
          description: 'Сколько места занято на корневом диске сервера, в байтах.',
        }),
        metric('disk_free_ratio', {
          label: 'Disk Free Ratio',
          color: '#fbbf24',
          aggregation: 'avg',
          description: 'Доля свободного места на корневом диске сервера.',
        }),
        metric('disk_used_ratio', {
          label: 'Disk Used Ratio',
          color: '#d97706',
          aggregation: 'avg',
          description:
            'Доля занятого места на корневом диске сервера. Если растёт к 100%, скоро начнутся реальные сбои записи и обновлений.',
        }),
        metric('uptime_seconds', {
          label: 'Uptime',
          color: '#64748b',
          unit: 'humanDuration',
          aggregation: 'last',
          description:
            'Сколько секунд сервер не перезагружался. Сброс вниз почти всегда означает reboot, redeploy VM или аварийный restart узла.',
        }),
      ],
    },
    {
      id: 'process',
      label: 'Flatline Process',
      metrics: [
        metric('process_cpu_ratio_avg', {
          label: 'Flatline CPU Avg',
          color: '#db2777',
          aggregation: 'avg',
          description: 'Средняя доля общей CPU-мощности сервера, которую за минуту съел сам процесс Flatline.',
        }),
        metric('process_cpu_ratio_max', {
          label: 'Flatline CPU Peak',
          color: '#ec4899',
          aggregation: 'max',
          description:
            'Пиковая доля CPU сервера, которую занимал процесс Flatline в одном из 5-секундных замеров этой минуты.',
        }),
      ],
    },
  ],
};
