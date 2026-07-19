import { metric, MetricsServiceDefinition } from '@app/shared/metrics-catalog-metric';

export const MEGAAPP_METRICS_DEFINITION: MetricsServiceDefinition = {
  service: 'megaapp',
  groups: [
    {
      id: 'activity',
      label: 'Activity',
      metrics: [
        metric('food_diary_entry_created', {
          label: 'Food Entries Created',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Сколько новых записей о приёме еды было добавлено в дневник питания за эту минуту. Каждая такая запись — это одно сохранённое блюдо или продукт за конкретный день.',
        }),
        metric('food_diary_entry_updated', {
          label: 'Food Entries Updated',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Сколько уже существующих записей о приёме еды было изменено за эту минуту — например, поменяли вес продукта или сам продукт в уже сохранённой записи.',
        }),
        metric('food_diary_entry_deleted', {
          label: 'Food Entries Deleted',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description: 'Сколько записей о приёме еды было удалено из дневника питания за эту минуту.',
        }),
        metric('food_diary_day_deleted', {
          label: 'Food Days Deleted',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Сколько раз за эту минуту был полностью удалён целый день дневника питания — все записи о еде за конкретную дату сразу.',
        }),
        metric('food_diary_day_restored', {
          label: 'Food Days Restored',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Сколько раз за эту минуту был восстановлен ранее удалённый день дневника питания (отмена удаления всего дня).',
        }),
        metric('food_body_weight_updated', {
          label: 'Body Weight Updates',
          color: '#16a34a',
          aggregation: 'sum',
          chartMode: 'bar',
          description: 'Сколько раз за эту минуту было сохранено новое значение веса тела пользователя.',
        }),
        metric('food_catalogue_entry_created', {
          label: 'Products Created',
          color: '#0891b2',
          aggregation: 'sum',
          chartMode: 'bar',
          description: 'Сколько новых продуктов было добавлено в каталог продуктов за эту минуту.',
        }),
        metric('food_catalogue_entry_updated', {
          label: 'Products Updated',
          color: '#0891b2',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Сколько существующих продуктов в каталоге было изменено за эту минуту — например, обновили калорийность или состав КБЖУ.',
        }),
        metric('food_catalogue_entry_deleted', {
          label: 'Products Deleted',
          color: '#0891b2',
          aggregation: 'sum',
          chartMode: 'bar',
          description: 'Сколько продуктов было удалено из каталога продуктов за эту минуту.',
        }),
        metric('food_personal_kcal_job_ran', {
          label: 'Personal Kcal Job Runs',
          color: '#64748b',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Показывает, что в эту минуту отработала фоновая ежемесячная задача пересчёта личной калорийности продуктов и нормы для пользователей — она запускается по расписанию один раз в месяц, 1-го числа. Значение 1 означает, что задача запустилась; в остальные минуты месяца эта метрика просто не приходит, и это нормально.',
        }),
        metric('backup_job_ran', {
          label: 'Backup Job Runs',
          color: '#64748b',
          aggregation: 'sum',
          chartMode: 'bar',
          description:
            'Показывает, что в эту минуту отработала фоновая ежедневная задача резервного копирования базы данных — она запускается по расписанию один раз в сутки. Значение 1 означает, что задача запустилась; в остальное время суток эта метрика не приходит, и это нормально.',
        }),
      ],
    },
  ],
};
