import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, Signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FitTextOnOverflowDirective } from '@app/shared/directives/fit-text-on-overflow.directive';
import { calcDateWithUserTimeShift, calculateTodayIsoWithUserTimeShift, dateToIsoNoTimeNoTZ } from '@app/shared/utils';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ButtonStyle } from '@ui-kit/types';

@Component({
  selector: 'diary-nav-buttons',
  templateUrl: './diary-nav-buttons.html',
  styleUrl: './diary-nav-buttons.scss',
  imports: [CommonModule, ReactiveFormsModule, FitTextOnOverflowDirective, VButton, VIcon],
})
export class DiaryNavButtons {
  protected readonly dateInputElem = viewChild<ElementRef<HTMLInputElement>>('dateInputElem');

  protected initDateTodayWithUserHourShift: Date = calcDateWithUserTimeShift(new Date());

  protected maxDateIso: string = dateToIsoNoTimeNoTZ(this.initDateTodayWithUserHourShift);

  protected readonly formCalendarSelectedDay: FormControl<string> = new FormControl<string>(this.maxDateIso, {
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

  protected onDatePicked(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const dateIso = input?.value;
    if (!dateIso) return;

    const date = this.isoToDate(dateIso);
    this.selectedDateMsWithUserHourShift = date.getTime();
    this.foodDiaryService.selectedDayIso$$.set(dateIso);
  }

  protected onDateControlClick(): void {
    if (this.isTodaySelected$$()) {
      this.refreshTodayReference();
      this.openNativeDatePicker(this.dateInputElem()?.nativeElement);
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
    const todayIso = dateToIsoNoTimeNoTZ(todayDate);
    this.formCalendarSelectedDay.setValue(todayIso);

    this.selectedDateMsWithUserHourShift = todayDate.getTime();
    this.foodDiaryService.selectedDayIso$$.set(todayIso);
  }

  private refreshTodayReference(): Date {
    const todayDate = calcDateWithUserTimeShift(new Date());
    this.initDateTodayWithUserHourShift = todayDate;
    this.maxDateIso = dateToIsoNoTimeNoTZ(todayDate);
    return todayDate;
  }

  private switchCurrentDay(dayShift: number): void {
    const oldDate = new Date(this.selectedDateMsWithUserHourShift);
    const newDate = new Date(oldDate);
    newDate.setDate(newDate.getDate() + dayShift);
    this.selectedDateMsWithUserHourShift = newDate.getTime();
    const newDateIso = dateToIsoNoTimeNoTZ(newDate);
    this.formCalendarSelectedDay.setValue(newDateIso);
    this.foodDiaryService.selectedDayIso$$.set(newDateIso);
  }

  private openNativeDatePicker(input: HTMLInputElement | null | undefined): void {
    if (!input) return;

    const inputWithPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof inputWithPicker.showPicker === 'function') {
      inputWithPicker.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  private isoToDate(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  protected openAddFoodModal(): void {
    this.foodAddModalService.openModal();
  }
}
