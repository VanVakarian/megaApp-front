import { NgFor, NgIf } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { delay, filter, firstValueFrom, Subscription, take } from 'rxjs';

import { FoodStatsService } from '@app/services/food-stats.service';
import { FoodService } from '@app/services/food.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { ConfirmationDialogModalService } from '@app/shared/components/dialog-modal/mat-dialog-modal.service';
import { DiaryEntry, HistoryEntry } from '@app/shared/interfaces';

@Component({
  selector: 'app-diary-entry-edit-form',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './diary-entry-edit-form.component.html',
})
export class DiaryEntryEditFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  public diaryEntry!: DiaryEntry;

  @Output()
  public onServerSuccessfullEditResponse = new EventEmitter<void>();

  @ViewChild('foodWeightChangeElem')
  public foodWeightChangeElem!: ElementRef;

  public previousWeightDisplay: string = '';
  public errorMessageText: string = '';
  public errorMessageShow: boolean = false;

  public showHistory: boolean = false;
  private historyAction: 'set' | 'add' | 'subtract' = 'set';

  private newWeightPattern = /^(?!0+$)\d+$/; // Digits only, but not zero
  private editWeightPattern = /^[-+]?\d+$/; // Digits only with or without a plus or a minus

  public diaryEntryForm: FormGroup = new FormGroup({
    id: new FormControl(0),
    foodWeight: new FormControl(null),
    foodWeightInitial: new FormControl(0),
    foodWeightNew: new FormControl(null, [Validators.pattern(this.newWeightPattern)]),
    foodWeightChange: new FormControl(null, [Validators.pattern(this.editWeightPattern)]),
  });
  public foodWeightFinal: number = 0;

  private subs = new Subscription();

  public get selectedFoodName() {
    return this.foodService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.name;
  }

  constructor(
    private foodService: FoodService,
    private foodStatsService: FoodStatsService,
    private confirmModal: ConfirmationDialogModalService,
    private screenSizeWatcherService: ScreenSizeWatcherService,
  ) {}

  public ngOnInit(): void {
    this.subscribe();
  }

  public ngOnChanges(): void {
    if (this.diaryEntry) {
      this.diaryEntryForm.patchValue(this.diaryEntry);
      this.diaryEntryForm.get('foodWeightInitial')?.setValue(this.diaryEntry.foodWeight);
      this.previousWeightDisplay = `${this.diaryEntry.foodWeight} г.`;
    }
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  public isFormValid(): boolean {
    return (
      this.diaryEntryForm.valid &&
      this.diaryEntryForm.value.foodWeightInitial !== this.diaryEntryForm.value.foodWeightNew &&
      (this.diaryEntryForm.value.foodWeightNew || this.diaryEntryForm.value.foodWeightChange)
    );
  }

  public onNewWeightInput() {
    this.diaryEntryForm.get('foodWeightChange')?.setValue(null);
    const newWeight = this.diaryEntryForm.value.foodWeightNew;
    if (this.newWeightPattern.test(newWeight)) {
      this.foodWeightFinal = parseInt(newWeight);
      this.previousWeightDisplay = `${this.diaryEntryForm.value.foodWeightInitial} г.`;
      this.errorMessageShow = false;
    } else {
      this.foodWeightFinal = this.diaryEntryForm.value.foodWeightInitial;
      this.errorMessageText = 'Число должно быть целое, положительное.';
      this.errorMessageShow = true;
    }
  }

  public onChangeWeightInput() {
    this.diaryEntryForm.get('foodWeightNew')?.setValue(null);
    const foorWeightChangeStr = this.diaryEntryForm.value.foodWeightChange;
    const foodWeightChangeInt = parseInt(foorWeightChangeStr);
    if (
      this.editWeightPattern.test(foorWeightChangeStr) &&
      this.diaryEntryForm.value.foodWeightInitial + foodWeightChangeInt > 0
    ) {
      const sign = foodWeightChangeInt < 0 ? '-' : '+';
      this.foodWeightFinal = this.diaryEntryForm.value.foodWeightInitial + foodWeightChangeInt;
      this.previousWeightDisplay = `${this.diaryEntryForm.value.foodWeightInitial} г. ${sign} ${Math.abs(
        foodWeightChangeInt,
      )} г.`;
      this.errorMessageShow = false;
    } else if (
      this.editWeightPattern.test(foorWeightChangeStr) &&
      this.diaryEntryForm.value.foodWeightInitial + foodWeightChangeInt <= 0
    ) {
      this.foodWeightFinal = this.diaryEntryForm.value.foodWeightInitial;
      this.errorMessageText = 'Итоговый результат должен быть положительным.';
      this.errorMessageShow = true;
    } else {
      this.foodWeightFinal = this.diaryEntryForm.value.foodWeightInitial;
      this.errorMessageText = 'Число должно быть целое. Либо отрицательное, либо положительное.';
      this.errorMessageShow = true;
    }
  }

  public async onSubmit(): Promise<void> {
    const weightIfChange = this.diaryEntryForm.value.foodWeightChange;
    this.historyAction = weightIfChange ? (String(weightIfChange).includes('-') ? 'subtract' : 'add') : 'set';
    const history = { action: this.historyAction, value: Math.abs(weightIfChange) };
    this.diaryEntryForm.disable();

    const preppedFormValues: DiaryEntry = {
      id: this.diaryEntryForm.value.id,
      dateISO: this.foodService.selectedDayIso$$(),
      foodCatalogueId: this.diaryEntry.foodCatalogueId,
      foodWeight: this.foodWeightFinal,
      history: [history],
    };

    const weightIfSet = this.diaryEntryForm.value.foodWeightNew - this.diaryEntryForm.value.foodWeightInitial;
    const foodWeight = weightIfChange ?? weightIfSet;
    const foodId = this.diaryEntry.foodCatalogueId;
    const foodKcals = this.foodService.catalogue$$()?.[foodId].kcals;
    const foodCoefficient = this.foodService.coefficients$$()?.[foodId] ?? 1;
    const kcalsDelta = (foodWeight / 100) * foodKcals * foodCoefficient;

    try {
      const res = await firstValueFrom(this.foodService.editDiaryEntry(preppedFormValues));
      this.diaryEntryForm.enable();
      this.diaryEntryForm.reset();
      this.onServerSuccessfullEditResponse.emit();

      if (res.result && kcalsDelta) {
        this.foodStatsService.updateStats(this.foodService.selectedDayIso$$(), 0, kcalsDelta);
      }
    } catch {
      this.diaryEntryForm.enable();
    }
  }

  public openConfirmationModal(actionQuestion: string): void {
    this.confirmModal
      .openModal(actionQuestion)
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.deleteDiaryEntry();
        }
      });
  }

  public toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  public formHistoryEntry(historyEntry: HistoryEntry) {
    switch (historyEntry.action) {
      case 'init':
        return `Запись создана с весом ${historyEntry.value} г.`;
      case 'set':
        return `Задан новый вес: ${historyEntry.value} г.`;
      case 'add':
        return `Добавлено ${historyEntry.value} г.`;
      case 'subtract':
        return `Убрано ${historyEntry.value} г.`;
    }
  }

  public chooseIconForHistoryEntry(historyEntry: HistoryEntry) {
    switch (historyEntry.action) {
      case 'init':
        return 'grade';
      case 'set':
        return 'create';
      case 'add':
        return 'add';
      case 'subtract':
        return 'remove';
    }
  }

  public onFocus() {}

  public onBlur() {}

  private subscribe(): void {
    this.subs.add(
      this.foodService.diaryEntryClickedFocus$
        .pipe(
          filter((diaryEntryId) => this.diaryEntryForm.value.id === diaryEntryId),
          delay(100), // delay is the duration of the panel expansion animation, otherwise focus messes with it.
        )
        .subscribe(() => {
          // if (this.screenSizeWatcherService.currentScreenType === ScreenType.MOBILE) return;
          this.foodWeightChangeElem.nativeElement.focus();
        }),
    );
  }

  private async deleteDiaryEntry(): Promise<void> {
    const foodId = this.diaryEntry.foodCatalogueId;
    const foodKcals = this.foodService.catalogue$$()?.[foodId].kcals;
    const foodCoefficient = this.foodService.coefficients$$()?.[foodId] ?? 1;
    const kcalsDelta = -(this.diaryEntry.foodWeight / 100) * foodKcals * foodCoefficient;

    this.diaryEntryForm.disable();
    try {
      const res = await firstValueFrom(this.foodService.deleteDiaryEntry(this.diaryEntryForm.value.id));
      this.diaryEntryForm.enable();
      this.diaryEntryForm.reset();
      this.onServerSuccessfullEditResponse.emit();

      if (res.result && kcalsDelta) {
        this.foodStatsService.updateStats(this.foodService.selectedDayIso$$(), 0, kcalsDelta);
      }
    } catch {
      this.diaryEntryForm.enable();
    }
  }
}
