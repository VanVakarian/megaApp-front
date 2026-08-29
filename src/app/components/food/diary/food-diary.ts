import { NgStyle } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BMI } from '@app/components/food/diary/bmi/bmi';
import { BodyWeight } from '@app/components/food/diary/body-weight/body-weight';
import { DiaryEntryEditForm } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form';
import { DiaryNavButtons } from '@app/components/food/diary/diary-nav/diary-nav-buttons';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodAddModalService, ModalState } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { KeyboardService } from '@app/services/keyboard.service';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VAccordion } from '@ui-kit/components/v-expand/v-accordion';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VModal } from '@ui-kit/components/v-modal/v-modal';
import { AccordionGroupService } from '@ui-kit/services/accordion-group.service';
import { NutritionSummary } from './nutrition-summary/nutrition-summary';

@Component({
  selector: 'food-diary',
  templateUrl: './food-diary.html',
  styleUrl: './food-diary.scss',
  imports: [
    NgStyle,
    DiaryNavButtons,
    DiaryEntryEditForm,
    BMI,
    BodyWeight,
    NutritionSummary,
    VButton,
    VModal,
    VAccordion,
    VExpand,
    VIcon,
  ],
})
export class FoodDiary {
  protected readonly bodyWeightComponent = viewChild.required<BodyWeight>('bodyWeight');
  protected readonly diaryEntryHeaders = viewChildren<ElementRef>('diaryEntryHeader');

  private readonly weightMeasureElems = viewChildren<ElementRef>('foodWeightMeasureElem');
  private readonly percentMeasureElems = viewChildren<ElementRef>('foodPercentMeasureElem');

  // null = no width constraint yet, each row sits at its own natural (auto) width.
  // Never reset on day change — new rows are born pinned to the last committed width
  // instead of jumping to auto, then animate (via CSS transition) to the freshly
  // measured target once the new day's content has painted.
  protected readonly columnWidths$$ = signal<{ weight: number | null; percent: number | null }>({
    weight: null,
    percent: null,
  });

  protected readonly selectedDayDiaryEntries$$ = computed(() => {
    const selectedDay = this.foodDiaryService.selectedDayIso$$();
    return this.foodDiaryService.diary$$()[selectedDay]?.food || [];
  });

  protected readonly selectedDaysKcalsPercent$$ = computed(() => {
    return this.foodDiaryService.selectedDayTotals$$().kcalsPercent;
  });

  protected readonly selectedDaysKcalsConsumed$$ = computed(() => {
    return this.foodDiaryService.selectedDayTotals$$().kcalsConsumed;
  });

  protected readonly selectedDaysTargetKcals$$ = computed(() => {
    return this.foodDiaryService.selectedDayTotals$$().targetKcals;
  });

  protected readonly selectedDaysFormattedConsumedPercent$$ = computed(() => {
    return Math.round(this.foodDiaryService.selectedDayTotals$$().kcalsPercent * 10) / 10;
  });

  protected readonly hasSelectedDayDiaryEntries$$ = computed(() => this.selectedDayDiaryEntries$$().length > 0);
  protected readonly canRestoreSelectedDay$$ = computed(
    () => this.foodDiaryService.selectedDayDeletedSnapshot$$() !== null,
  );

  protected readonly caloriesDisplayText$$ = computed(() => {
    const percent = this.selectedDaysFormattedConsumedPercent$$();
    if (Number.isNaN(percent)) return '';

    return `Съедено ${percent}% от дневной нормы`;
  });

  protected readonly addDiaryEntryButtonVariant$$ = computed(() => {
    if (this.deviceInfoService.isDesktopScreen$$()) return 'primary';
    return this.openedDiaryEntryId$$() !== null ? 'raised' : 'primary';
  });

  protected isDeleteDayConfirmOpen = false;
  protected readonly Icon = IconName;

  // Measures natural content width from the unconstrained inner spans (unaffected by
  // whatever width is currently applied to their parent), so recalculation never needs
  // to reset columns back to auto first — that reset was the source of the visible jump.
  private readonly columnWidthsSyncEffect$$ = afterRenderEffect({
    read: () => {
      this.selectedDayDiaryEntries$$();

      const weightWidths = this.weightMeasureElems().map((elem) => elem.nativeElement.getBoundingClientRect().width);
      const percentWidths = this.percentMeasureElems().map((elem) => elem.nativeElement.getBoundingClientRect().width);
      if (weightWidths.length === 0) return;

      const nextWeight = Math.ceil(Math.max(...weightWidths));
      const nextPercent = Math.ceil(Math.max(...percentWidths));

      this.columnWidths$$.update((current) => {
        if (current.weight === nextWeight && current.percent === nextPercent) return current;
        return { weight: nextWeight, percent: nextPercent };
      });
    },
  });

  private readonly closeFoodEntriesOnDayChangeEffect$$ = effect(() => {
    const currentDay = this.foodDiaryService.selectedDayIso$$();

    if (this.previousSelectedDay !== currentDay) {
      this.previousSelectedDay = currentDay;

      if (this.openedDiaryEntryId$$() !== null) {
        this.closeAllAccordions();
        this.openedDiaryEntryId$$.set(null);
      }
    }
  });

  protected readonly foodDiaryService = inject(FoodDiaryService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  protected readonly deviceInfoService = inject(DeviceInfoService);
  protected readonly foodCatalogueService = inject(FoodCatalogueService);
  private readonly accordionGroupService = inject(AccordionGroupService);
  private readonly keyboardService = inject(KeyboardService);

  private readonly shortcutSubscription = this.keyboardService
    .shortcut$({
      code: 'KeyN',
      when: () => this.foodAddModalService.currentState$$() === ModalState.CLOSED,
    })
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      this.openAddFoodModal();
    });

  protected setBackgroundStyle(percent: number, ltr = false): { [key: string]: string } {
    const percentCapped = percent <= 100 ? percent : 100;
    const dir = ltr ? 'to right' : 'to left';
    return {
      background: `linear-gradient(${dir}, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
    };
  }

  protected openAddFoodModal() {
    this.closeAllAccordions();
    this.foodAddModalService.openModal();
  }

  protected openDeleteDayConfirmationModal(): void {
    if (!this.hasSelectedDayDiaryEntries$$()) return;

    this.closeAllAccordions();
    this.isDeleteDayConfirmOpen = true;
  }

  protected closeDeleteDayConfirmationModal(): void {
    this.isDeleteDayConfirmOpen = false;
  }

  protected async onDeleteDayConfirmed(): Promise<void> {
    this.isDeleteDayConfirmOpen = false;
    await this.foodDiaryService.deleteSelectedDayEntries();
  }

  protected async onRestoreDayClicked(): Promise<void> {
    await this.foodDiaryService.restoreSelectedDayEntries();
  }

  protected isEntryExpanded(diaryEntryId: number): boolean {
    return this.openedDiaryEntryId$$() === diaryEntryId;
  }

  private readonly openedDiaryEntryId$$ = signal<number | null>(null);
  private previousSelectedDay: string | null = null;

  protected onVExpandOpened($event: CustomEvent<boolean>, expandingDiaryEntryId: number): void {
    if ($event.detail) {
      setTimeout(() => {
        this.openedDiaryEntryId$$.set(expandingDiaryEntryId);
      }, 0);
      this.foodDiaryService.focusDiaryEntry(expandingDiaryEntryId);

      if (this.deviceInfoService.isDesktopScreen$$()) return;

      setTimeout(() => {
        const foodIndex = this.selectedDayDiaryEntries$$().findIndex((food) => food.id === expandingDiaryEntryId);
        if (foodIndex === -1) return;

        const headerEl = this.diaryEntryHeaders()[foodIndex]?.nativeElement;
        if (headerEl) {
          window.scrollTo({
            top: headerEl.getBoundingClientRect().top + window.scrollY - 40,
            behavior: 'smooth',
          });
        }
      }, 100); // Waiting for the v-expand animation to finish, otherwise the scroll animation may not finish properly
    } else {
      this.openedDiaryEntryId$$.set(null);
      this.foodDiaryService.resetDiaryEntryForm(expandingDiaryEntryId);
    }
  }

  protected onBMIExpandOpened($event: CustomEvent<boolean>): void {
    if ($event.detail) {
      this.bodyWeightComponent().focusIfEmpty();
    }
  }

  protected closeAllAccordions(): void {
    this.accordionGroupService.closeAll('food-diary-section');
  }
}
