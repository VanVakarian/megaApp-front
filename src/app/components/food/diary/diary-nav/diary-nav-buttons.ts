import { CommonModule } from '@angular/common';
import { Component, computed, inject, Signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepicker, MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FitTextOnOverflowDirective } from '@app/shared/directives/fit-text-on-overflow.directive';
import { VButton } from '@app/shared/ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/components/v-icon/v-icon';
import {
  calcDateWithUserTimeShift,
  calculateTodayIsoWithUserTimeShift,
  dateToIsoNoTimeNoTZ,
  epochToIsoNoTimeNoTZ,
} from '@app/shared/utils';

@Component({
  selector: 'diary-nav-buttons',
  templateUrl: './diary-nav-buttons.html',
  imports: [
    CommonModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatInputModule,
    FitTextOnOverflowDirective,
    VButton,
    VIcon,
  ],
})
export class DiaryNavButtons {
  protected readonly picker = viewChild.required<MatDatepicker<Date>>('picker');

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

  private selectedDateMsWithUserHourShift: number = this.initDateTodayWithUserHourShift.getTime();

  private readonly foodDiaryService = inject(FoodDiaryService);

  protected formatWeekday(dateIso: string, weekdayStyle: 'long' | 'short'): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: weekdayStyle });
    return result[0].toUpperCase() + result.slice(1);
  }

  protected formatDayMonth(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
      this.picker().open();
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
}
