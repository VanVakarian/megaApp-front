import {
  Component,
  effect,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodCoefficientsService } from '@app/services/food/food-coefficients.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { ConfirmationDialogModalService } from '@app/shared/components/dialog-modal/mat-dialog-modal.service';
import { DiaryEntry, HistoryEntry, HistoryEntryAction } from '@app/shared/interfaces';
import { UiProgressIcon } from '@app/shared/ui-kit/progress-icon/progress-icon.component';
import { delay, filter, Subscription, take } from 'rxjs';

interface DiaryEntryFormModel {
  id: FormControl<number>;
  foodWeightNew: FormControl<number | null>;
  foodWeightChange: FormControl<number | null>;
}

@Component({
  selector: 'app-diary-entry-edit-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    UiProgressIcon,
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

  public showHistory: boolean = false;
  private historyAction: HistoryEntryAction = HistoryEntryAction.SET;

  private selectedDaysTargerKcals = 0;
  private selectedDaysEatenPercent = 0;
  private selectedFoodKcals = 0;
  private diaryEntriesCoefficient = 0;
  public projectedSelectedDaysEatenPercentNum = 0;
  public projectedSelectedDaysEatenPercentPadded = '0';

  public foodWeightInitial: number = 0;
  public foodWeightFinal: number = 0;

  private newWeightPattern = /^(?!0+$)\d+$/; // Digits only, but not zero
  private editWeightPattern = /^[-+]?\d+$/; // Digits only with or without a plus or a minus

  private positiveResultValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const changeValue = parseInt(String(control.value));
      const newWeight = this.foodWeightInitial + changeValue;
      return newWeight > 0 ? null : { negativeResult: true };
    };
  }

  public diaryEntryForm = new FormGroup<DiaryEntryFormModel>({
    id: new FormControl(0, { nonNullable: true }),
    foodWeightNew: new FormControl<number | null>(null, [Validators.pattern(this.newWeightPattern)]),
    foodWeightChange: new FormControl<number | null>(null, [
      Validators.pattern(this.editWeightPattern),
      this.positiveResultValidator(),
    ]),
  });

  public get foodWeightNewControl() {
    return this.diaryEntryForm.controls.foodWeightNew;
  }
  public get foodWeightChangeControl() {
    return this.diaryEntryForm.controls.foodWeightChange;
  }

  private subs = new Subscription();

  public get selectedFoodName() {
    return this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.name;
  }

  constructor(
    private foodDiaryService: FoodDiaryService,
    private foodCatalogueService: FoodCatalogueService,
    private foodCoefficientsService: FoodCoefficientsService,
    private foodStatsService: FoodStatsService,
    private confirmModal: ConfirmationDialogModalService,
    private screenSizeWatcherService: ScreenSizeWatcherService,
  ) {
    effect(() => {
      const totals = this.foodDiaryService.selectedDayTotals$$();
      this.selectedDaysEatenPercent = totals.kcalsPercent;
      this.selectedDaysTargerKcals = totals.targetKcals;
      this.selectedFoodKcals = this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.kcals ?? 0;
      this.diaryEntriesCoefficient =
        this.foodCoefficientsService.coefficients$$()?.[this.diaryEntry.foodCatalogueId] ?? 1;
    });
  }

  public ngOnInit(): void {
    this.subscribe();
  }

  public ngOnChanges(): void {
    if (this.diaryEntry) {
      this.diaryEntryForm.patchValue({
        id: this.diaryEntry.id,
      });
      this.foodWeightInitial = this.diaryEntry.foodWeight;
      this.foodWeightFinal = this.diaryEntry.foodWeight;

      setTimeout(() => {
        this.updateProjectedDaysEatenPercent();
      }, 0);
    }
  }

  public ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  public isFormValid(): boolean {
    if (!this.diaryEntryForm.valid) return false;

    const weightIfNew = this.foodWeightNewControl.value;
    const weightIfChange = this.foodWeightChangeControl.value;

    const hasValidChange =
      (weightIfNew !== null && this.foodWeightInitial !== weightIfNew) ||
      (weightIfChange !== null && weightIfChange !== 0);

    return hasValidChange && this.foodWeightFinal > 0;
  }

  public onNewWeightInput() {
    this.foodWeightChangeControl.setValue(null);
    const newWeight = this.diaryEntryForm.controls.foodWeightNew.value;

    if (this.newWeightPattern.test(String(newWeight))) {
      this.foodWeightFinal = parseInt(String(newWeight));
    } else {
      this.foodWeightFinal = this.foodWeightInitial;
    }

    this.updateProjectedDaysEatenPercent();
  }

  public onWeightNewResetClick(): void {
    this.foodWeightNewControl.setValue(null);
    this.foodWeightFinal = this.foodWeightInitial;
    this.updateProjectedDaysEatenPercent();
  }

  public onChangeWeightInput() {
    this.diaryEntryForm.controls.foodWeightNew.setValue(null);
    const foodWeightChangeStr = String(this.foodWeightChangeControl.value);
    const foodWeightChangeInt = parseInt(foodWeightChangeStr);

    if (this.editWeightPattern.test(foodWeightChangeStr)) {
      const newWeight = this.foodWeightInitial + foodWeightChangeInt;
      if (newWeight > 0) {
        this.foodWeightFinal = newWeight;
      } else {
        this.foodWeightFinal = 0;
      }
    } else {
      this.foodWeightFinal = this.foodWeightInitial;
    }

    this.updateProjectedDaysEatenPercent();
  }

  public onWeightChangeResetClick(): void {
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightFinal = this.foodWeightInitial;
    this.updateProjectedDaysEatenPercent();
  }

  public async onSubmit(): Promise<void> {
    const weightIfChange = this.foodWeightChangeControl.value;
    const weightIfSet = this.diaryEntryForm.controls.foodWeightNew.value;
    const foodWeight = weightIfChange ?? (weightIfSet ? weightIfSet - this.foodWeightInitial : 0);
    const historyValue = weightIfChange ? Math.abs(foodWeight) : (weightIfSet ?? 0);

    if (weightIfChange === null) {
      this.historyAction = HistoryEntryAction.SET;
    } else {
      this.historyAction = String(weightIfChange).includes('-') ? HistoryEntryAction.SUBTRACT : HistoryEntryAction.ADD;
    }

    const history: HistoryEntry = { action: this.historyAction, value: historyValue };
    this.diaryEntryForm.disable();

    const preppedFormValues: DiaryEntry = {
      id: this.diaryEntryForm.getRawValue().id,
      dateISO: this.foodDiaryService.selectedDayIso$$(),
      foodCatalogueId: this.diaryEntry.foodCatalogueId,
      foodWeight: this.foodWeightFinal,
      history: [history],
    };

    const kcalsDelta = this.calculateKcalsDelta(foodWeight);

    try {
      const res = await this.foodDiaryService.editDiaryEntry(preppedFormValues);
      this.diaryEntryForm.enable();
      this.diaryEntryForm.reset();
      this.onServerSuccessfullEditResponse.emit();
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
      case HistoryEntryAction.INIT:
        return `Запись создана с весом ${historyEntry.value} г.`;
      case HistoryEntryAction.SET:
        return `Задан новый вес: ${historyEntry.value} г.`;
      case HistoryEntryAction.ADD:
        return `Добавлено ${historyEntry.value} г.`;
      case HistoryEntryAction.SUBTRACT:
        return `Убрано ${historyEntry.value} г.`;
    }
  }

  public chooseIconForHistoryEntry(historyEntry: HistoryEntry) {
    switch (historyEntry.action) {
      case HistoryEntryAction.INIT:
        return 'grade';
      case HistoryEntryAction.SET:
        return 'create';
      case HistoryEntryAction.ADD:
        return 'add';
      case HistoryEntryAction.SUBTRACT:
        return 'remove';
    }
  }

  private subscribe(): void {
    this.subs.add(
      this.foodDiaryService.diaryEntryClickedFocus$
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
    const kcalsDelta = this.calculateKcalsDelta(-this.diaryEntry.foodWeight);

    this.diaryEntryForm.disable();
    try {
      const res = await this.foodDiaryService.deleteDiaryEntry(this.diaryEntryForm.getRawValue().id);
      this.diaryEntryForm.enable();
      this.diaryEntryForm.reset();
      this.onServerSuccessfullEditResponse.emit();
    } catch {
      this.diaryEntryForm.enable();
    }
  }

  private calculateKcalsDelta(weightValue: number): number {
    const tempEntry: DiaryEntry = {
      ...this.diaryEntry,
      foodWeight: weightValue,
    };
    return this.foodDiaryService.calculateEntryKcals(tempEntry);
  }

  private updateProjectedDaysEatenPercent(): void {
    const weightDelta = this.foodWeightFinal - this.foodWeightInitial;

    if (this.selectedFoodKcals && this.diaryEntriesCoefficient && this.selectedDaysTargerKcals) {
      const weightKcalsPerHundredGrams = this.selectedFoodKcals;
      const weightKcalsTotal = (weightDelta / 100) * weightKcalsPerHundredGrams;

      const weightKcalsWithCoefficient = weightKcalsTotal * this.diaryEntriesCoefficient;

      const deltaInPercent = (weightKcalsWithCoefficient / this.selectedDaysTargerKcals) * 100;
      const totalPercent = this.selectedDaysEatenPercent + deltaInPercent;

      this.projectedSelectedDaysEatenPercentNum = totalPercent;
      this.projectedSelectedDaysEatenPercentPadded = totalPercent.toFixed(1);
    }
  }
}
