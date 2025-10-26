import { CommonModule } from '@angular/common';
import { Component, computed, inject, Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '@app/services/auth.service';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { calcDateWithUserTimeShift, dateToIsoNoTimeNoTZ, epochToIsoNoTimeNoTZ } from '@app/shared/utils';

@Component({
  selector: 'diary-nav-buttons',
  templateUrl: './diary-nav-buttons.html',
  styleUrl: './diary-nav-buttons.scss',
  imports: [CommonModule, MatDatepickerModule, ReactiveFormsModule, MatInputModule, VButton, VIcon],
})
export class DiaryNavButtons {
  protected initDateTodayWithUserHourShift: Date = calcDateWithUserTimeShift(new Date());

  protected formCalendarSelectedDay: FormControl<Date> = new FormControl<Date>(this.initDateTodayWithUserHourShift, {
    nonNullable: true,
  });

  protected selectedDateFormatted$$: Signal<string> = computed(() => this.formatDate(this.foodDiaryService.selectedDayIso$$())); // prettier-ignore

  protected readonly Icon = IconName;

  private selectedDateMsWithUserHourShift: number = this.initDateTodayWithUserHourShift.getTime();

  protected readonly deviceInfoService = inject(DeviceInfoService);
  protected readonly authService = inject(AuthService);
  private readonly foodDiaryService = inject(FoodDiaryService);

  protected get isAuthenticated(): boolean {
    return this.authService.isAuthenticated$$();
  }

  protected formatDate(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' });
    return result[0].toUpperCase() + result.slice(1);
  }

  protected onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    if (!event.value) return;

    this.selectedDateMsWithUserHourShift = event.value.getTime();
    const newDateIso = dateToIsoNoTimeNoTZ(event.value);
    this.foodDiaryService.selectedDayIso$$.set(newDateIso);
  }

  protected goToPreviousDay(): void {
    this.switchCurrentDay(-1);
  }

  protected goToNextDay(): void {
    this.switchCurrentDay(1);
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
