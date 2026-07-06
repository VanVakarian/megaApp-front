import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAX_LANE_HEIGHT_PX, MIN_LANE_HEIGHT_PX, TimeDisplayPrefsService } from '@app/services/time/time-display-prefs.service';
import { TimeScreenView } from '@app/shared/time-types';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VSlider, VSliderConfig } from '@ui-kit/components/v-slider/v-slider';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import { ActivitiesList } from './activities-list/activities-list';
import { CategoriesList } from './categories-list/categories-list';
import { TimelineBoard } from './timeline-board/timeline-board';

@Component({
  selector: 'time-screen',
  templateUrl: './time-screen.html',
  styleUrl: './time-screen.scss',
  imports: [ActivitiesList, CategoriesList, TimelineBoard, VCard, VCheckbox, VSlider, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeScreen {
  protected readonly TimeScreenView = TimeScreenView;

  protected readonly timeDisplayPrefsService = inject(TimeDisplayPrefsService);

  protected readonly laneHeightSliderConfig: VSliderConfig = { min: MIN_LANE_HEIGHT_PX, max: MAX_LANE_HEIGHT_PX };

  protected readonly activeView$$ = signal<TimeScreenView>(TimeScreenView.Entry);
  protected readonly snapMinutes$$ = signal<number>(15);

  protected readonly viewToggleItems: VToggleItem[] = [
    { id: TimeScreenView.Entry, label: 'Input' },
    { id: TimeScreenView.Stats, label: 'Statistics' },
  ];

  protected readonly viewToggleValue$$ = computed(() => [this.activeView$$()]);

  protected readonly snapToggleItems: VToggleItem[] = [
    { id: '1', label: '1' },
    { id: '15', label: '15' },
    { id: '30', label: '30' },
    { id: '60', label: '60' },
  ];

  protected readonly snapToggleValue$$ = computed(() => [String(this.snapMinutes$$())]);

  protected onViewChange(value: string[]): void {
    const raw = value[0];
    if (raw === undefined) return;
    this.activeView$$.set(raw as TimeScreenView);
  }

  protected onSnapChange(value: string[]): void {
    const raw = value[0];
    if (raw === undefined) return;
    this.snapMinutes$$.set(Number(raw));
  }

  protected onCompactModeChange(newValue: boolean): void {
    this.timeDisplayPrefsService.setCompactMode(newValue);
  }

  protected onPrimaryHeightChange(newValue: number): void {
    this.timeDisplayPrefsService.setPrimaryHeightPx(newValue);
  }

  protected onSecondaryHeightChange(newValue: number): void {
    this.timeDisplayPrefsService.setSecondaryHeightPx(newValue);
  }
}
