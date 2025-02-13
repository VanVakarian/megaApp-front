import { NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '@app/services/auth.service';
import { FoodService } from '@app/services/food.service';
import { dateToIsoNoTimeNoTZ, epochToIsoNoTimeNoTZ, getAdjustedDate } from '@app/shared/utils';

@Component({
  selector: 'app-diary-nav-buttons',
  standalone: true,
  imports: [
    NgIf,
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
  public today: Date = getAdjustedDate(new Date());
  private todayDate: number = this.today.getTime();
  private selectedDateMs: number = this.todayDate;
  public calendarSelectedDay: FormControl = new FormControl(this.today);
  // private keyboardSubscription!: Subscription;

  constructor(
    // private keyboardService: KeyboardService,
    private authService: AuthService,
    public foodService: FoodService,
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

  public get isAuthenticated() {
    return this.authService.isAuthenticated;
  }

  public get selectedDateIso() {
    return this.foodService.selectedDayIso$$();
  }

  public formatDate(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' });
    return result[0].toUpperCase() + result.slice(1);
  }

  public previousDay() {
    this.switchCurrentDay(-1);
  }

  public nextDay() {
    this.switchCurrentDay(1);
  }

  private switchCurrentDay(shift: number) {
    const newDate = new Date(this.selectedDateMs);
    newDate.setDate(newDate.getDate() + shift);
    this.selectedDateMs = newDate.getTime();
    const newDateIso = epochToIsoNoTimeNoTZ(this.selectedDateMs);
    this.foodService.selectedDayIso$$.set(newDateIso);
    this.calendarSelectedDay.setValue(getAdjustedDate(newDate));
  }

  public onDatePicked(event: MatDatepickerInputEvent<Date>) {
    if (!event.value) return;

    this.selectedDateMs = event.value.getTime();
    const newDateIso = dateToIsoNoTimeNoTZ(event.value);
    this.foodService.selectedDayIso$$.set(newDateIso);
  }
}
