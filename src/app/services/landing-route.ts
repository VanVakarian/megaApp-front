import { UserSettings } from '@app/shared/types';

export function computeLandingRoute(settings: UserSettings): string {
  if (settings.selectedChapterFood) return '/food';
  if (settings.selectedChapterMoney) return '/money';
  return '/settings';
}
