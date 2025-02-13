import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatAccordion, MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

import { combineLatest } from 'rxjs';

import { BMIComponent } from '@app/components/food/diary/bmi/bmi.component';
import { BodyWeightComponent } from '@app/components/food/diary/body-weight/body-weight.component';
import { DiaryEntryEditFormComponent } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form.component';
import { DiaryEntryNewFormComponent } from '@app/components/food/diary/diary-entry-new-form/diary-entry-new-form.component';
import { DiaryNavButtonsComponent } from '@app/components/food/diary/diary-nav/diary-nav-buttons.component';
import { FoodService } from '@app/services/food.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { ScreenType } from '@app/shared/interfaces';

@Component({
  selector: 'app-food-diary',
  templateUrl: './food-diary.component.html',
  styleUrl: './food-diary.component.scss',
  standalone: true,
  imports: [
    NgStyle,
    MatExpansionModule,
    MatCardModule,
    MatIconModule,
    DiaryNavButtonsComponent,
    DiaryEntryEditFormComponent,
    DiaryEntryNewFormComponent,
    BodyWeightComponent,
    BMIComponent,
  ],
})
export class FoodDiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatAccordion)
  public foodAccordion!: MatAccordion;

  @ViewChild('newDiaryEntryPanel')
  public newDiaryEntryPanel!: MatExpansionPanel;

  @ViewChild('foodCont')
  public contDiv!: ElementRef;

  @ViewChildren('foodName')
  public nameDivs!: QueryList<ElementRef>;

  @ViewChildren('foodWeight')
  public weightsDivs!: QueryList<ElementRef>;

  @ViewChildren('foodKcals')
  public kcalsDivs!: QueryList<ElementRef>;

  @ViewChildren('foodPercent')
  public percentsDivs!: QueryList<ElementRef>;

  public get todaysKcalsPercent() {
    return this.foodService.diaryFormatted$$()?.[this.selectedDateIso]?.['kcalsPercent'] ?? 0;
  }

  public get selectedDayFood() {
    const selectedDay = this.foodService.selectedDayIso$$();
    const selectedDayFood = this.foodService.diaryFormatted$$()?.[selectedDay]?.food;

    if (selectedDayFood) return Object.values(selectedDayFood);
    return [];
  }

  public get todaysKcalsEaten() {
    return this.foodService.diaryFormatted$$()?.[this.selectedDateIso]?.['kcalsEaten'];
  }

  public get todaysTargetKcals() {
    return this.foodService.diary$$()?.[this.selectedDateIso]?.['targetKcals'];
  }

  public get formatSelectedDaysEatenPercent(): number {
    return Math.round(this.foodService.diaryFormatted$$()?.[this.selectedDateIso]?.['kcalsPercent'] * 10) / 10;
  }

  private get selectedDateIso() {
    return this.foodService.selectedDayIso$$();
  }

  constructor(
    public foodService: FoodService,
    private ngZone: NgZone,
    private screenSizeWatcherService: ScreenSizeWatcherService,
  ) {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    // setting columns width
    combineLatest([this.weightsDivs.changes, this.kcalsDivs.changes, this.percentsDivs.changes]).subscribe(() =>
      this.adjustWidths(),
    );
    setTimeout(() => this.adjustWidths(), 100);
  }

  public ngOnDestroy(): void {}

  public setBackgroundStyle(percent: number) {
    const percentCapped = percent <= 100 ? percent : 100;
    return {
      background: `linear-gradient(to right, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
    };
  }

  public diaryEntryExpanded(diaryEntry: MatExpansionPanel, diaryEntryId: number) {
    this.foodService.diaryEntryClickedFocus$.next(diaryEntryId);

    if (this.screenSizeWatcherService.currentScreenType === ScreenType.DESKTOP) return;

    setTimeout(() => {
      window.scrollTo({
        top: diaryEntry._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'smooth',
      });
    }, 170);
  }

  public newDiaryEntryExpanded() {
    if (this.screenSizeWatcherService.currentScreenType === ScreenType.DESKTOP) return;

    setTimeout(() => {
      window.scrollTo({
        top: this.newDiaryEntryPanel._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'smooth',
      });
    }, 170);
  }

  public accordionCollapse() {
    this.foodAccordion.closeAll();
  }
  private adjustWidths(): void {
    this.ngZone.run(() => {
      this.setWidth(this.weightsDivs);
      this.setWidth(this.kcalsDivs);
      this.setWidth(this.percentsDivs);

      const weightsWidth = this.getMaxWidth(this.weightsDivs);
      const kcalsWidth = this.getMaxWidth(this.kcalsDivs);
      const percentsWidth = this.getMaxWidth(this.percentsDivs);

      this.setWidth(this.weightsDivs, weightsWidth + 3);
      this.setWidth(this.kcalsDivs, kcalsWidth + 10);
      this.setWidth(this.percentsDivs, percentsWidth + 12);

      if (this.contDiv && this.contDiv.nativeElement) {
        const remainingWidth = this.contDiv.nativeElement.offsetWidth - weightsWidth - kcalsWidth - percentsWidth;
        this.setWidth(this.nameDivs, remainingWidth);
      }
    });
  }

  private getMaxWidth(elems: QueryList<ElementRef>): number {
    const widths = elems.map((elem) => elem.nativeElement.offsetWidth);
    return Math.max(...widths);
  }

  private setWidth(elems: QueryList<ElementRef>, width?: number): void {
    elems.forEach((elem) => {
      elem.nativeElement.style.width = width === undefined ? 'auto' : `${width}px`;
    });
  }
}
