import { Component, effect, EventEmitter, inject, Input, OnChanges, Output, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodCoefficientsService } from '@app/services/food/food-coefficients.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { DiaryEntry, HistoryEntry, HistoryEntryAction } from '@app/shared/interfaces';
import { UiProgressIcon } from '@app/shared/ui-kit/progress-icon/progress-icon.component';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';

interface DiaryEntryFormModel {
  id: FormControl<number>;
  foodWeightNew: FormControl<string | null>;
  foodWeightChange: FormControl<string | null>;
}

@Component({
  selector: 'diary-entry-edit-form',
  templateUrl: './diary-entry-edit-form.html',
  styleUrl: './diary-entry-edit-form.scss',
  imports: [ReactiveFormsModule, UiProgressIcon, VButton, VIcon, VExpand, VInput, VModal],
})
export class DiaryEntryEditForm implements OnChanges {
  @Input()
  public diaryEntry!: DiaryEntry;

  @Output()
  public onServerSuccessfullEditResponse = new EventEmitter<void>();

  protected readonly foodWeightChangeElem = viewChild.required<VInput>('foodWeightChangeElem');

  protected isDeleteConfirmOpen = false;
  protected isHistoryExpanded: boolean = false;
  protected disableHistoryAnimationTemporaroly: boolean = false;
  private historyAction: HistoryEntryAction = HistoryEntryAction.SET;

  private selectedDaysTargerKcals = 0;
  private selectedDaysConsumedPercent = 0;
  private selectedFoodKcals = 0;
  private diaryEntriesCoefficient = 0;
  protected projectedSelectedDaysConsumedPercentNum = 0;
  protected projectedSelectedDaysConsumedPercentPadded = '0';

  protected foodWeightInitial: number = 0;
  protected foodWeightFinal: number = 0;

  protected readonly Icon = IconName;

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

  protected diaryEntryForm = new FormGroup<DiaryEntryFormModel>({
    id: new FormControl(0, { nonNullable: true }),
    foodWeightNew: new FormControl<string | null>(null, [Validators.pattern(this.newWeightPattern)]),
    foodWeightChange: new FormControl<string | null>(null, [
      Validators.pattern(this.editWeightPattern),
      this.positiveResultValidator(),
    ]),
  });

  protected get foodWeightNewControl() {
    return this.diaryEntryForm.controls.foodWeightNew;
  }
  protected get foodWeightChangeControl() {
    return this.diaryEntryForm.controls.foodWeightChange;
  }

  private inputFocusEffect$$ = effect(() => {
    const focusId = this.foodDiaryService.diaryEntryFocusId$$();
    if (focusId === this.diaryEntryForm.value.id) {
      setTimeout(() => {
        this.foodWeightChangeElem().focus();
      }, 100); // Waiting for the panel animation to finish, otherwise there's a jitter
    }
  });

  private formResetEffect$$ = effect(() => {
    const resetId = this.foodDiaryService.diaryEntryResetId$$();
    setTimeout(() => {
      if (resetId === this.diaryEntryForm.value.id) {
        this.resetForm();
        this.collapseHistory();
      }
    }, 50); // Waiting for the panel to close, otherwise the reset is visually janky
  });

  private totalsUpdateEffect$$ = effect(() => {
    const totals = this.foodDiaryService.selectedDayTotals$$();
    this.selectedDaysConsumedPercent = totals.kcalsPercent;
    this.selectedDaysTargerKcals = totals.targetKcals;
    this.selectedFoodKcals = this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.kcals ?? 0;
    this.diaryEntriesCoefficient =
      this.foodCoefficientsService.coefficients$$()?.[this.diaryEntry.foodCatalogueId] ?? 1;
    this.updateProjectedDaysConsumedPercent();
  });

  protected get selectedFoodName() {
    return this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.name;
  }

  protected readonly deviceInfoService = inject(DeviceInfoService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);
  private readonly foodCoefficientsService = inject(FoodCoefficientsService);

  public ngOnChanges(): void {
    if (this.diaryEntry) {
      this.diaryEntryForm.patchValue({
        id: this.diaryEntry.id,
      });
      this.foodWeightInitial = this.diaryEntry.foodWeight;
      this.foodWeightFinal = this.diaryEntry.foodWeight;

      setTimeout(() => {
        this.updateProjectedDaysConsumedPercent();
      }, 0);
    }
  }

  protected isFormValid(): boolean {
    if (!this.diaryEntryForm.valid) return false;
    if (this.foodWeightNewControl.value === '') return false;
    if (this.foodWeightChangeControl.value === '') return false;

    const weightIfNew = this.foodWeightNewControl.value;
    const weightIfChange = this.foodWeightChangeControl.value;

    const hasValidChange =
      (weightIfNew !== null && this.foodWeightInitial !== parseInt(weightIfNew)) ||
      (weightIfChange !== null && parseInt(weightIfChange) !== 0);

    return hasValidChange && this.foodWeightFinal > 0;
  }

  protected onNewWeightInput() {
    this.foodWeightChangeControl.setValue(null);
    const newWeight = this.diaryEntryForm.controls.foodWeightNew.value;

    if (this.newWeightPattern.test(String(newWeight))) {
      this.foodWeightFinal = parseInt(String(newWeight));
    } else {
      this.foodWeightFinal = this.foodWeightInitial;
    }

    this.updateProjectedDaysConsumedPercent();
  }

  protected onWeightNewResetClick(): void {
    this.foodWeightNewControl.setValue(null);
    this.foodWeightFinal = this.foodWeightInitial;
    this.updateProjectedDaysConsumedPercent();
  }

  protected onChangeWeightInput() {
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

    this.updateProjectedDaysConsumedPercent();
  }

  protected onWeightChangeResetClick(): void {
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightFinal = this.foodWeightInitial;
    this.updateProjectedDaysConsumedPercent();
  }

  public async onSubmit(): Promise<void> {
    const weightIfChangeRaw = this.foodWeightChangeControl.value;
    const weightIfSetRaw = this.diaryEntryForm.controls.foodWeightNew.value;
    const weightIfChange = weightIfChangeRaw !== null ? parseInt(weightIfChangeRaw) : null;
    const weightIfSet = weightIfSetRaw !== null ? parseInt(weightIfSetRaw) : null;
    const foodWeight = weightIfChange ?? (weightIfSet !== null ? weightIfSet - this.foodWeightInitial : 0);
    const historyValue = weightIfChange !== null ? Math.abs(foodWeight) : (weightIfSet ?? 0);

    if (weightIfChange === null) {
      this.historyAction = HistoryEntryAction.SET;
    } else {
      this.historyAction = weightIfChangeRaw!.includes('-') ? HistoryEntryAction.SUBTRACT : HistoryEntryAction.ADD;
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

  protected openConfirmationModal(): void {
    this.isDeleteConfirmOpen = true;
  }

  protected closeConfirmationModal(): void {
    this.isDeleteConfirmOpen = false;
  }

  protected onDeleteConfirmed(): void {
    this.deleteDiaryEntry();
    this.isDeleteConfirmOpen = false;
  }

  protected toggleHistory() {
    this.isHistoryExpanded = !this.isHistoryExpanded;
  }

  protected formHistoryEntry(historyEntry: HistoryEntry) {
    switch (historyEntry.action) {
      case HistoryEntryAction.INIT:
        return `Создано: ${historyEntry.value} г.`;
      case HistoryEntryAction.SET:
        return `Задано: ${historyEntry.value} г.`;
      case HistoryEntryAction.ADD:
        return `Добавлено: ${historyEntry.value} г.`;
      case HistoryEntryAction.SUBTRACT:
        return `Убрано: ${historyEntry.value} г.`;
    }
  }

  protected chooseIconForHistoryEntry(historyEntry: HistoryEntry) {
    switch (historyEntry.action) {
      case HistoryEntryAction.INIT:
        return this.Icon.Star;
      case HistoryEntryAction.SET:
        return this.Icon.Edit;
      case HistoryEntryAction.ADD:
        return this.Icon.Add;
      case HistoryEntryAction.SUBTRACT:
        return this.Icon.Remove;
    }
  }

  private async deleteDiaryEntry(): Promise<void> {
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

  private updateProjectedDaysConsumedPercent(): void {
    const weightDelta = this.foodWeightFinal - this.foodWeightInitial;

    if (this.selectedFoodKcals && this.diaryEntriesCoefficient && this.selectedDaysTargerKcals) {
      const weightKcalsPerHundredGrams = this.selectedFoodKcals;
      const weightKcalsTotal = (weightDelta / 100) * weightKcalsPerHundredGrams;

      const weightKcalsWithCoefficient = weightKcalsTotal * this.diaryEntriesCoefficient;

      const deltaInPercent = (weightKcalsWithCoefficient / this.selectedDaysTargerKcals) * 100;
      const totalPercent = this.selectedDaysConsumedPercent + deltaInPercent;

      this.projectedSelectedDaysConsumedPercentNum = totalPercent;
      this.projectedSelectedDaysConsumedPercentPadded = totalPercent.toFixed(1);
    }
  }

  private resetForm(): void {
    this.foodWeightNewControl.setValue(null);
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightFinal = this.foodWeightInitial;
    this.updateProjectedDaysConsumedPercent();
  }

  private collapseHistory(): void {
    this.disableHistoryAnimationTemporaroly = true;
    this.isHistoryExpanded = false;
    setTimeout(() => {
      this.disableHistoryAnimationTemporaroly = false;
    }, 100); // Disabling history v-expand animation temporarily for the duration of collapse a parent v-expand animation, they otherwise conflict
  }
}
