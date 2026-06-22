const METRIC_LABELS: Record<string, string> = {
  food_diary_entry_created: 'Создано записей',
  food_diary_entry_updated: 'Изменено записей',
  food_diary_entry_deleted: 'Удалено записей',
  food_diary_day_deleted: 'Удалено дней',
  food_diary_day_restored: 'Восстановлено дней',
  food_body_weight_updated: 'Изменения веса',
  food_catalogue_entry_created: 'Создано продуктов',
  food_catalogue_entry_updated: 'Изменено продуктов',
  food_catalogue_entry_deleted: 'Удалено продуктов',
  food_coefficients_job_ran: 'Прогонов коэффициентов',
  backup_job_ran: 'Прогонов бэкапа',
};

export function metricLabel(name: string): string {
  return METRIC_LABELS[name] ?? name;
}
