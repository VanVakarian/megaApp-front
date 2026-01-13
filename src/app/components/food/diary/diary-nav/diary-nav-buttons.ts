import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, Signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepicker, MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { ANIMATION_DURATION_MS_STRING } from '@app/shared/animations';
import { FitTextOnOverflowDirective } from '@app/shared/directives/fit-text-on-overflow.directive';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ButtonStyle } from '@ui-kit/types';
import {
  calcDateWithUserTimeShift,
  calculateTodayIsoWithUserTimeShift,
  dateToIsoNoTimeNoTZ,
  epochToIsoNoTimeNoTZ,
} from '@app/shared/utils';

@Component({
  selector: 'diary-nav-buttons',
  templateUrl: './diary-nav-buttons.html',
  styleUrl: './diary-nav-buttons.scss',
  imports: [
    CommonModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatInputModule,
    FitTextOnOverflowDirective,
    VButton,
    VIcon,
  ],
  animations: [
    trigger('fabHideSlideDown', [
      state('visible', style({ transform: 'translateY(0)' })),
      state('hidden', style({ transform: 'translateY(200%)' })),
      transition('visible <=> hidden', [animate(`${ANIMATION_DURATION_MS_STRING.MEDIUM} ease-in-out`)]),
    ]),
    trigger('fabHideSlideRight', [
      state('visible', style({ transform: 'translateX(0)' })),
      state('hidden', style({ transform: 'translateX(200%)' })),
      transition('visible <=> hidden', [animate(`${ANIMATION_DURATION_MS_STRING.MEDIUM} ease-in-out`)]),
    ]),
  ],
})
export class DiaryNavButtons {
  protected readonly pickerDesktop = viewChild<MatDatepicker<Date>>('pickerDesktop');
  protected readonly pickerTouch = viewChild<MatDatepicker<Date>>('pickerTouch');

  protected initDateTodayWithUserHourShift: Date = calcDateWithUserTimeShift(new Date());

  protected formCalendarSelectedDay: FormControl<Date> = new FormControl<Date>(this.initDateTodayWithUserHourShift, {
    nonNullable: true,
  });

  protected readonly weekdayFull$$: Signal<string> = computed(() =>
    this.formatWeekday(this.foodDiaryService.selectedDayIso$$(), 'long'),
  );

  protected readonly weekdayShort$$: Signal<string> = computed(() =>
    this.formatWeekday(this.foodDiaryService.selectedDayIso$$(), 'short'),
  );

  protected readonly dateFormatted$$: Signal<string> = computed(() =>
    this.formatDayMonth(this.foodDiaryService.selectedDayIso$$()),
  );

  protected readonly isTodaySelected$$: Signal<boolean> = computed(() => {
    return this.foodDiaryService.selectedDayIso$$() === calculateTodayIsoWithUserTimeShift();
  });

  protected readonly primaryActionIcon$$: Signal<IconName> = computed(() => {
    return this.isTodaySelected$$() ? IconName.CalendarMonth : IconName.Undo;
  });

  protected readonly Icon = IconName;
  protected readonly ButtonStyle = ButtonStyle;

  private selectedDateMsWithUserHourShift: number = this.initDateTodayWithUserHourShift.getTime();

  protected readonly authService = inject(AuthService);
  protected readonly deviceInfoService = inject(DeviceInfoService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodAddModalService = inject(FoodAddModalService);

  protected readonly shouldHideFabButtons$$ = computed(
    () => !this.deviceInfoService.isDesktopScreen$$() && this.deviceInfoService.isKeyboardOpen$$(),
  );

  protected formatWeekday(dateIso: string, weekdayStyle: 'long' | 'short'): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: weekdayStyle });
    return result[0].toUpperCase() + result.slice(1);
  }

  protected formatDayMonth(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return result;
  }

  protected onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    if (!event.value) return;

    this.selectedDateMsWithUserHourShift = event.value.getTime();
    const newDateIso = dateToIsoNoTimeNoTZ(event.value);
    this.foodDiaryService.selectedDayIso$$.set(newDateIso);
  }

  protected onDateControlClick(): void {
    if (this.isTodaySelected$$()) {
      this.refreshTodayReference();
      if (this.deviceInfoService.isDesktopScreen$$()) {
        this.pickerDesktop()?.open();
      } else {
        this.pickerTouch()?.open();
      }
      return;
    }

    this.goToToday();
  }

  protected goToPreviousDay(): void {
    this.switchCurrentDay(-1);
  }

  protected goToNextDay(): void {
    this.switchCurrentDay(1);
  }

  protected goToToday(): void {
    const todayDate = this.refreshTodayReference();
    this.formCalendarSelectedDay.setValue(todayDate);

    this.selectedDateMsWithUserHourShift = todayDate.getTime();
    this.foodDiaryService.selectedDayIso$$.set(calculateTodayIsoWithUserTimeShift());
  }

  private refreshTodayReference(): Date {
    const todayDate = calcDateWithUserTimeShift(new Date());
    this.initDateTodayWithUserHourShift = todayDate;
    return todayDate;
  }

  private switchCurrentDay(dayShift: number): void {
    const oldDate = new Date(this.selectedDateMsWithUserHourShift);
    const newDate = new Date(oldDate);
    newDate.setDate(newDate.getDate() + dayShift);
    this.formCalendarSelectedDay.setValue(newDate);

    this.selectedDateMsWithUserHourShift = newDate.getTime();
    const newDateIso = epochToIsoNoTimeNoTZ(this.selectedDateMsWithUserHourShift);
    this.foodDiaryService.selectedDayIso$$.set(newDateIso);
  }

  protected openAddFoodModal(): void {
    this.foodAddModalService.openModal();
  }
}
