import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '@app/services/auth.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { calcDateWithUserTimeShift, dateToIsoNoTimeNoTZ, epochToIsoNoTimeNoTZ } from '@app/shared/utils';

@Component({
  selector: 'app-diary-nav-buttons',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './diary-nav-buttons.component.html',
  styleUrl: './diary-nav-buttons.component.scss',
})
export class DiaryNavButtonsComponent implements OnInit, OnDestroy {
  public initDateTodayWithUserHourShift: Date = calcDateWithUserTimeShift(new Date());

  public formCalendarSelectedDay: FormControl<Date> = new FormControl<Date>(this.initDateTodayWithUserHourShift, {
    nonNullable: true,
  });

  public selectedDateFormatted$$: Signal<string> = computed(() => this.formatDate(this.foodDiaryService.selectedDayIso$$())); // prettier-ignore

  private selectedDateMsWithUserHourShift: number = this.initDateTodayWithUserHourShift.getTime();

  // private keyboardSubscription!: Subscription;

  constructor(
    // private keyboardService: KeyboardService,
    private authService: AuthService,
    public foodDiaryService: FoodDiaryService,
  ) {
    // this.keyboardSubscription = this.keyboardService.getKeyboardEvents$().subscribe((event) => {
    //   if (event.key === 'ArrowRight') {
    //     this.nextDay();
    //   } else if (event.key === 'ArrowLeft') {
    //     this.previousDay();
    //   }
    // });
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    // this.keyboardSubscription.unsubscribe();
  }

  public get isAuthenticated(): boolean {
    return this.authService.isAuthenticated;
  }

  public formatDate(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' });
    return result[0].toUpperCase() + result.slice(1);
  }

  public previousDay(): void {
    this.switchCurrentDay(-1);
  }

  public nextDay(): void {
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

  public onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    if (!event.value) return;

    this.selectedDateMsWithUserHourShift = event.value.getTime();
    const newDateIso = dateToIsoNoTimeNoTZ(event.value);
    this.foodDiaryService.selectedDayIso$$.set(newDateIso);
  }
}
