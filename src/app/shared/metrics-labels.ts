const METRIC_LABELS: Record<string, string> = {
  food_diary_entry_created: 'Создано записей',
  food_diary_entry_updated: 'Изменено записей',
  food_diary_entry_deleted: 'Удалено записей',
  food_diary_day_deleted: 'Удалено дней',
  food_body_weight_updated: 'Изменения веса',
};

export function metricLabel(name: string): string {
  return METRIC_LABELS[name] ?? name;
}
