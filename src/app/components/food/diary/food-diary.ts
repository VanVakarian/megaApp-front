import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  NgZone,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { BMI } from '@app/components/food/diary/bmi/bmi';
import { BodyWeight } from '@app/components/food/diary/body-weight/body-weight';
import { CameraPreview } from '@app/components/food/diary/camera-preview/camera-preview';
import { DiaryEntryAddForm } from '@app/components/food/diary/diary-entry-add-form/diary-entry-add-form';
import { DiaryEntryEditForm } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form';
import { DiaryNavButtons } from '@app/components/food/diary/diary-nav/diary-nav-buttons';
import { FoodSearch } from '@app/components/food/diary/food-search/food-search';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodAddModalService, ModalState } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VAccordion } from '@ui-kit/components/v-expand/v-accordion';
import { VExpand } from '@ui-kit/components/v-expand/v-expand';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VModal } from '@ui-kit/components/v-modal/v-modal';
import { AccordionGroupService } from '@ui-kit/services/accordion-group.service';
import { CatalogueEntryEditForm } from './catalogue-entry-edit-form/catalogue-entry-edit-form';
import { NutritionSummary } from './nutrition-summary/nutrition-summary';

@Component({
  selector: 'food-diary',
  templateUrl: './food-diary.html',
  styleUrl: './food-diary.scss',
  imports: [
    NgStyle,
    DiaryNavButtons,
    DiaryEntryEditForm,
    DiaryEntryAddForm,
    BMI,
    CameraPreview,
    FoodSearch,
    CatalogueEntryEditForm,
    BodyWeight,
    NutritionSummary,
    VButton,
    VModal,
    VAccordion,
    VExpand,
    VCard,
    VIcon,
  ],
})
export class FoodDiary implements AfterViewInit {
  protected readonly bodyWeightComponent = viewChild.required<BodyWeight>('bodyWeight');
  protected readonly diaryEntryHeaders = viewChildren<ElementRef>('diaryEntryHeader');

  protected readonly weightsDivs = viewChildren<ElementRef>('foodWeight');
  protected readonly kcalsDivs = viewChildren<ElementRef>('foodKcals');
  protected readonly percentsDivs = viewChildren<ElementRef>('foodPercent');

  private readonly shouldRecalcColumns$$ = signal(0);

  protected readonly ModalViewMode = ModalState;

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

  private readonly columnWidthsSyncEffect$$ = effect(() => {
    this.selectedDayDiaryEntries$$();
    this.shouldRecalcColumns$$();
    setTimeout(() => this.syncColumnWidths(), 0);
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
  private readonly ngZone = inject(NgZone);

  public ngAfterViewInit(): void {
    this.triggerColumnRecalc();
  }

  private triggerColumnRecalc(): void {
    this.shouldRecalcColumns$$.update((val) => val + 1);
  }

  protected setBackgroundStyle(percent: number, ltr = false): { [key: string]: string } {
    const percentCapped = percent <= 100 ? percent : 100;
    const dir = ltr ? 'to right' : 'to left';
    return {
      background: `linear-gradient(${dir}, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
    };
  }

  protected closeModal() {
    this.foodAddModalService.closeModal();
    this.foodCatalogueService.clearSearch();
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

  private syncColumnWidths(): void {
    this.ngZone.run(() => {
      const weightsDivs = this.weightsDivs();
      const kcalsDivs = this.kcalsDivs();
      const percentsDivs = this.percentsDivs();

      if (weightsDivs.length === 0) return;

      this.resetWidth(weightsDivs);
      this.resetWidth(kcalsDivs);
      this.resetWidth(percentsDivs);

      setTimeout(() => {
        const maxWeightWidth = this.getMaxWidth(weightsDivs);
        const maxKcalsWidth = this.getMaxWidth(kcalsDivs);
        const maxPercentWidth = this.getMaxWidth(percentsDivs);

        if (maxWeightWidth > 0) {
          this.setWidth(weightsDivs, maxWeightWidth);
        }
        if (maxKcalsWidth > 0) {
          this.setWidth(kcalsDivs, maxKcalsWidth);
        }
        if (maxPercentWidth > 0) {
          this.setWidth(percentsDivs, maxPercentWidth);
        }
      }, 0);
    });
  }

  private getMaxWidth(elems: readonly ElementRef[]): number {
    const widths = elems.map((elem) => elem.nativeElement.offsetWidth);
    return Math.max(...widths);
  }

  private resetWidth(elems: readonly ElementRef[]): void {
    elems.forEach((elem) => {
      elem.nativeElement.style.width = 'auto';
    });
  }

  private setWidth(elems: readonly ElementRef[], width: number): void {
    elems.forEach((elem) => {
      elem.nativeElement.style.width = `${Math.ceil(width)}px`;
    });
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
      this.triggerColumnRecalc();

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
