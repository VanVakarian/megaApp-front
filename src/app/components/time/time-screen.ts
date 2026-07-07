import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  MAX_LANE_HEIGHT_PX,
  MAX_PICKER_HEIGHT_PX,
  MIN_LANE_HEIGHT_PX,
  MIN_PICKER_HEIGHT_PX,
  TimeDisplayPrefsService,
} from '@app/services/time/time-display-prefs.service';
import { TimeScreenView } from '@app/shared/time-types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VSlider, VSliderConfig } from '@ui-kit/components/v-slider/v-slider';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import { ActivityKindsList } from './activity-kinds-list/activity-kinds-list';
import { CategoryGroupsList } from './category-groups-list/category-groups-list';
import { TimelineBoard } from './timeline-board/timeline-board';

@Component({
  selector: 'time-screen',
  templateUrl: './time-screen.html',
  styleUrl: './time-screen.scss',
  imports: [ActivityKindsList, CategoryGroupsList, TimelineBoard, VButton, VCard, VCheckbox, VIcon, VSlider, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeScreen {
  protected readonly TimeScreenView = TimeScreenView;
  protected readonly IconName = IconName;

  protected readonly timeDisplayPrefsService = inject(TimeDisplayPrefsService);

  protected readonly laneHeightSliderConfig: VSliderConfig = { min: MIN_LANE_HEIGHT_PX, max: MAX_LANE_HEIGHT_PX };
  protected readonly pickerHeightSliderConfig: VSliderConfig = { min: MIN_PICKER_HEIGHT_PX, max: MAX_PICKER_HEIGHT_PX };

  protected readonly activeView$$ = signal<TimeScreenView>(TimeScreenView.Entry);

  protected readonly snapToggleItems: VToggleItem[] = [
    { id: '1', label: '1' },
    { id: '15', label: '15' },
    { id: '30', label: '30' },
    { id: '60', label: '60' },
  ];

  protected readonly snapToggleValue$$ = computed(() => [String(this.timeDisplayPrefsService.snapMinutes$$())]);

  protected setView(view: TimeScreenView): void {
    this.activeView$$.set(view);
  }

  protected viewButtonClass(view: TimeScreenView): string {
    return this.activeView$$() === view ? 'v-primary' : 'v-flat';
  }

  protected toggleSettingsCollapsed(): void {
    this.timeDisplayPrefsService.setSettingsCollapsed(!this.timeDisplayPrefsService.settingsCollapsed$$());
  }

  protected onSnapChange(value: string[]): void {
    const raw = value[0];
    if (raw === undefined) return;
    this.timeDisplayPrefsService.setSnapMinutes(Number(raw));
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

  protected onPickerHeightChange(newValue: number): void {
    this.timeDisplayPrefsService.setPickerHeightPx(newValue);
  }
}
