import {
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  viewChild,
  WritableSignal,
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
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodPersonalKcalsService } from '@app/services/food/food-personal-kcals.service';
import { DiaryEntry, HistoryEntry, HistoryEntryAction } from '@app/shared/types';
import { projectDaysConsumedPercent } from '@app/shared/utils';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VModal } from '@ui-kit/components/v-modal/v-modal';
import { UiProgressIcon } from '@ui-kit/progress-icon/progress-icon.component';
import { DiaryEntryProductInfo } from '../diary-entry-product-info/diary-entry-product-info';
import { NutritionSummary } from '../nutrition-summary/nutrition-summary';

interface DiaryEntryFormModel {
  id: FormControl<number>;
  foodWeightNew: FormControl<string | null>;
  foodWeightChange: FormControl<string | null>;
}

@Component({
  selector: 'diary-entry-edit-form',
  templateUrl: './diary-entry-edit-form.html',
  host: {
    style: 'display: flex; flex-direction: column;',
  },
  imports: [
    ReactiveFormsModule,
    UiProgressIcon,
    VButton,
    VIcon,
    VExpand,
    VInput,
    VModal,
    DiaryEntryProductInfo,
    NutritionSummary,
  ],
})
export class DiaryEntryEditForm implements OnChanges {
  @Input()
  public diaryEntry!: DiaryEntry;

  @Output()
  public onServerSuccessfullEditResponse = new EventEmitter<void>();

  protected readonly foodWeightNewElem = viewChild.required<VInput>('foodWeightNewElem');
  protected readonly foodWeightChangeElem = viewChild.required<VInput>('foodWeightChangeElem');
  protected readonly infoPanelElem = viewChild.required<VExpand>('infoPanelElem');
  protected readonly chartsPanelElem = viewChild.required<VExpand>('chartsPanelElem');
  protected readonly historyPanelElem = viewChild.required<VExpand>('historyPanelElem');

  protected isDeleteConfirmOpen = false;
  protected disablePanelsAnimationTemporarily = false;
  private historyAction: HistoryEntryAction = HistoryEntryAction.SET;

  // Base data from the server — legitimately refreshed by any background reload, in-progress
  // draft below is never touched by it, only by the user's own input/reset/submit.
  private readonly foodWeightInitial$$: WritableSignal<number> = signal(0);
  private readonly selectedDaysTargetKcals$$: WritableSignal<number> = signal(0);
  private readonly selectedDaysConsumedPercent$$: WritableSignal<number> = signal(0);
  private readonly selectedFoodPersonalKcalsPer100g$$: WritableSignal<number> = signal(0);

  // The user's in-progress, unsubmitted draft — set only from onNewWeightInput/onChangeWeightInput
  // and the reset handlers below, mutually exclusive (setting one clears the other).
  private readonly foodWeightDraftNew$$: WritableSignal<number | null> = signal(null);
  private readonly foodWeightDraftChangeRaw$$: WritableSignal<string | null> = signal(null);

  protected readonly foodWeightFinal$$ = computed(() => this.computeFoodWeightFinal());

  protected readonly projectedSelectedDaysConsumedPercentNum$$ = computed(() =>
    projectDaysConsumedPercent(
      this.foodWeightFinal$$() - this.foodWeightInitial$$(),
      this.selectedFoodPersonalKcalsPer100g$$(),
      this.selectedDaysTargetKcals$$(),
      this.selectedDaysConsumedPercent$$(),
    ),
  );
  protected readonly projectedSelectedDaysConsumedPercentPadded$$ = computed(() =>
    this.projectedSelectedDaysConsumedPercentNum$$().toFixed(1),
  );

  protected readonly Icon = IconName;

  protected readonly hasOpenPanel$$ = computed(() => {
    return (
      this.infoPanelElem().isPanelExpanded() ||
      this.chartsPanelElem().isPanelExpanded() ||
      this.historyPanelElem().isPanelExpanded()
    );
  });

  private newWeightPattern = /^(?!0+$)\d+$/; // Digits only, but not zero
  private editWeightPattern = /^[-+]?\d*$/; // Digits only with or without a plus or a minus

  private positiveResultValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const rawValue = String(control.value);
      if (rawValue === '-' || rawValue === '+') return null;

      const changeValue = parseInt(rawValue);
      if (!Number.isFinite(changeValue)) return null;

      const newWeight = this.foodWeightInitial$$() + changeValue;
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
        this.closePanels();
      }
    }, 50); // Waiting for the panel to close, otherwise the reset is visually janky
  });

  private totalsUpdateEffect$$ = effect(() => {
    const totals = this.foodDiaryService.selectedDayTotals$$();
    this.selectedDaysConsumedPercent$$.set(totals.kcalsPercent);
    this.selectedDaysTargetKcals$$.set(totals.targetKcals);
    this.selectedFoodPersonalKcalsPer100g$$.set(
      this.foodPersonalKcalsService.personalKcals$$()?.[this.diaryEntry.foodCatalogueId] ??
        this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.kcals ??
        0,
    );
  });

  protected get selectedFoodName() {
    return this.foodCatalogueService.catalogue$$()?.[this.diaryEntry.foodCatalogueId]?.name;
  }

  protected readonly deviceInfoService = inject(DeviceInfoService);
  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);
  private readonly foodPersonalKcalsService = inject(FoodPersonalKcalsService);

  public ngOnChanges(): void {
    if (this.diaryEntry) {
      this.diaryEntryForm.patchValue({
        id: this.diaryEntry.id,
      });
      this.foodWeightInitial$$.set(this.diaryEntry.foodWeight);
    }
  }

  protected isFormValid(): boolean {
    if (!this.diaryEntryForm.valid) return false;
    if (this.foodWeightNewControl.value === '') return false;
    if (this.foodWeightChangeControl.value === '') return false;

    const weightIfNew = this.foodWeightNewControl.value;
    const weightIfChange = this.foodWeightChangeControl.value;

    const nextWeightIfNew = weightIfNew !== null ? parseInt(weightIfNew) : null;
    const nextWeightIfChange = weightIfChange !== null ? parseInt(weightIfChange) : null;

    const hasValidChange =
      (nextWeightIfNew !== null &&
        Number.isFinite(nextWeightIfNew) &&
        this.foodWeightInitial$$() !== nextWeightIfNew) ||
      (nextWeightIfChange !== null && Number.isFinite(nextWeightIfChange) && nextWeightIfChange !== 0);

    return hasValidChange && this.foodWeightFinal$$() > 0;
  }

  protected onNewWeightInput() {
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightDraftChangeRaw$$.set(null);

    const newWeight = this.diaryEntryForm.controls.foodWeightNew.value;
    this.foodWeightDraftNew$$.set(this.newWeightPattern.test(String(newWeight)) ? parseInt(String(newWeight)) : null);
  }

  protected onWeightNewResetClick(): void {
    this.foodWeightNewControl.setValue(null);
    this.foodWeightDraftNew$$.set(null);
  }

  protected onChangeWeightInput() {
    this.diaryEntryForm.controls.foodWeightNew.setValue(null);
    this.foodWeightDraftNew$$.set(null);
    this.foodWeightDraftChangeRaw$$.set(this.foodWeightChangeControl.value);
  }

  protected onWeightChangeResetClick(): void {
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightDraftChangeRaw$$.set(null);
  }

  public async onSubmit(): Promise<void> {
    const weightIfChangeRaw = this.foodWeightChangeControl.value;
    const weightIfSetRaw = this.diaryEntryForm.controls.foodWeightNew.value;

    const weightIfChangeParsed = weightIfChangeRaw !== null ? parseInt(weightIfChangeRaw) : null;
    const weightIfSetParsed = weightIfSetRaw !== null ? parseInt(weightIfSetRaw) : null;

    const weightIfChange =
      weightIfChangeParsed !== null && Number.isFinite(weightIfChangeParsed) ? weightIfChangeParsed : null;
    const weightIfSet = weightIfSetParsed !== null && Number.isFinite(weightIfSetParsed) ? weightIfSetParsed : null;

    const foodWeight = weightIfChange ?? (weightIfSet !== null ? weightIfSet - this.foodWeightInitial$$() : 0);

    const historyValue = weightIfChange !== null ? Math.abs(foodWeight) : (weightIfSet ?? 0);

    if (weightIfChange === null) {
      this.historyAction = HistoryEntryAction.SET;
    } else {
      this.historyAction = weightIfChangeRaw!.includes('-') ? HistoryEntryAction.SUBTRACT : HistoryEntryAction.ADD;
    }

    const history: HistoryEntry = { action: this.historyAction, value: historyValue };
    this.diaryEntryForm.disable();
    this.foodWeightNewElem().blur();
    this.foodWeightChangeElem().blur();

    const preppedFormValues: DiaryEntry = {
      id: this.diaryEntryForm.getRawValue().id,
      dateISO: this.foodDiaryService.selectedDayIso$$(),
      foodCatalogueId: this.diaryEntry.foodCatalogueId,
      foodWeight: this.foodWeightFinal$$(),
      kcals: 0,
      history: [history],
    };

    await this.foodDiaryService.editDiaryEntry(preppedFormValues);
    this.diaryEntryForm.enable();
    this.diaryEntryForm.reset();
    this.onServerSuccessfullEditResponse.emit();
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

  protected toggleInfoPanel(): void {
    const isExpanded = this.infoPanelElem().isPanelExpanded();

    if (!isExpanded) {
      this.chartsPanelElem().setExpanded(false);
      this.historyPanelElem().setExpanded(false);
    }

    this.infoPanelElem().setExpanded(!isExpanded);
  }

  protected toggleChartsPanel(): void {
    const isExpanded = this.chartsPanelElem().isPanelExpanded();

    if (!isExpanded) {
      this.infoPanelElem().setExpanded(false);
      this.historyPanelElem().setExpanded(false);
    }

    this.chartsPanelElem().setExpanded(!isExpanded);
  }

  protected toggleHistoryPanel(): void {
    const isExpanded = this.historyPanelElem().isPanelExpanded();

    if (!isExpanded) {
      this.infoPanelElem().setExpanded(false);
      this.chartsPanelElem().setExpanded(false);
    }

    this.historyPanelElem().setExpanded(!isExpanded);
  }

  private async deleteDiaryEntry(): Promise<void> {
    this.diaryEntryForm.disable();
    await this.foodDiaryService.deleteDiaryEntry(this.diaryEntryForm.getRawValue().id);
    this.diaryEntryForm.enable();
    this.diaryEntryForm.reset();
    this.onServerSuccessfullEditResponse.emit();
  }

  private computeFoodWeightFinal(): number {
    const draftNew = this.foodWeightDraftNew$$();
    if (draftNew !== null) return draftNew;

    const base = this.foodWeightInitial$$();
    const draftChangeRaw = this.foodWeightDraftChangeRaw$$();

    if (draftChangeRaw === null || draftChangeRaw === '' || draftChangeRaw === '-' || draftChangeRaw === '+') {
      // Intermediate input state: fall back to the base weight to keep UI consistent.
      return base;
    }

    const changeValue = parseInt(draftChangeRaw);
    if (!Number.isFinite(changeValue) || !this.editWeightPattern.test(draftChangeRaw)) {
      // Invalid or pattern-mismatched input: fall back to the base weight.
      return base;
    }

    const newWeight = base + changeValue;
    return newWeight > 0 ? newWeight : 0; // Prevent non-positive result.
  }

  private resetForm(): void {
    this.foodWeightNewControl.setValue(null);
    this.foodWeightChangeControl.setValue(null);
    this.foodWeightDraftNew$$.set(null);
    this.foodWeightDraftChangeRaw$$.set(null);
  }

  private closePanels(): void {
    this.disablePanelsAnimationTemporarily = true;
    this.infoPanelElem().setExpanded(false);
    this.chartsPanelElem().setExpanded(false);
    this.historyPanelElem().setExpanded(false);
    setTimeout(() => {
      this.disablePanelsAnimationTemporarily = false;
    }, 100);
  }
}
