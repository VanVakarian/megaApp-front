import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChildren,
  WritableSignal,
} from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { BMIComponent } from '@app/components/food/diary/bmi/bmi.component';
import { BodyWeightComponent } from '@app/components/food/diary/body-weight/body-weight.component';
import { CameraPreviewComponent } from '@app/components/food/diary/camera-preview/camera-preview.component';
import { DiaryEntryAddFormComponent } from '@app/components/food/diary/diary-entry-add-form/diary-entry-add-form.component';
import { DiaryEntryEditFormComponent } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form.component';
import { DiaryNavButtonsComponent } from '@app/components/food/diary/diary-nav/diary-nav-buttons.component';
import { FoodSearchComponent } from '@app/components/food/diary/food-search/food-search.component';
import { DeviceDetectorService } from '@app/services/device-detector.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { PhotoCaptureService } from '@app/services/photo-capture.service';
import { ScreenSizeWatcherService, ScreenType } from '@app/services/screen-size-watcher.service';
import { SettingsService } from '@app/services/settings.service';
import { CapturedPhoto, CatalogueEntry } from '@app/shared/interfaces';
import { OuterShadowRoundedDirective } from '@app/shared/ui-kit/shadow.directive';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { AccordionDirective } from '@app/shared/ui-kit/v-expand/accordion.directive';
import { AccordionService } from '@app/shared/ui-kit/v-expand/accordion.service';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';

enum ModalViewMode {
  CAMERA_PREVIEW,
  SEARCH,
  ADD_DIARY_ENTRY,
  CREATE_NEW_PRODUCT,
}

@Component({
  selector: 'app-food-diary',
  templateUrl: './food-diary.component.html',
  styleUrl: './food-diary.component.scss',
  imports: [
    NgStyle,
    DiaryNavButtonsComponent,
    DiaryEntryEditFormComponent,
    DiaryEntryAddFormComponent,
    BodyWeightComponent,
    BMIComponent,
    CameraPreviewComponent,
    FoodSearchComponent,
    VButton,
    VModal,
    VExpand,
    VCard,
    VIcon,
    OuterShadowRoundedDirective,
    AccordionDirective,
  ],
})
export class FoodDiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly weightsDivs = viewChildren<ElementRef>('foodWeight');
  protected readonly kcalsDivs = viewChildren<ElementRef>('foodKcals');
  protected readonly percentsDivs = viewChildren<ElementRef>('foodPercent');

  protected isAddFoodModalOpen = false;

  protected readonly isCameraPreviewOpen$$: WritableSignal<boolean> = signal(false);
  protected readonly selectedProduct$$: WritableSignal<CatalogueEntry | null> = signal(null);
  protected readonly isCreateNewProductMode$$: WritableSignal<boolean> = signal(false);

  private readonly shouldRecalcColumns$$ = signal(0);

  private readonly columnSyncEffect = effect(() => {
    this.selectedDayFood;
    this.shouldRecalcColumns$$();
    setTimeout(() => this.syncColumnWidths(), 0);
  });

  protected readonly currentViewMode$$ = computed(() => {
    if (this.isCameraPreviewOpen$$()) {
      return ModalViewMode.CAMERA_PREVIEW;
    }
    if (this.selectedProduct$$()) {
      return ModalViewMode.ADD_DIARY_ENTRY;
    }
    if (this.isCreateNewProductMode$$()) {
      return ModalViewMode.CREATE_NEW_PRODUCT;
    }
    return ModalViewMode.SEARCH;
  });

  protected readonly ModalViewMode = ModalViewMode;
  protected readonly IconName = IconName;

  protected get todaysKcalsPercent() {
    return this.foodDiaryService.selectedDayTotals$$().kcalsPercent;
  }

  protected get selectedDayFood() {
    const selectedDay = this.foodDiaryService.selectedDayIso$$();
    return this.foodDiaryService.diary$$()[selectedDay]?.food || [];
  }

  protected get todaysKcalsEaten() {
    return this.foodDiaryService.selectedDayTotals$$().kcalsEaten;
  }

  protected get todaysTargetKcals() {
    return this.foodDiaryService.selectedDayTotals$$().targetKcals;
  }

  protected get formattedSelectedDaysEatenPercent(): number {
    return Math.round(this.foodDiaryService.selectedDayTotals$$().kcalsPercent * 10) / 10;
  }

  protected get caloriesDisplayText(): string {
    const percent = this.formattedSelectedDaysEatenPercent;
    if (Number.isNaN(percent)) return '';

    // if (this.isLiteVersionSetting) {
    return `Съедено ${percent}% от дневной нормы`;
    // } else {
    //   return `Съедено ${this.todaysKcalsEaten} ккал. от нормы ${this.todaysTargetKcals} (${percent}%)`;
    // }
  }

  // protected get isLiteVersionSetting(): boolean {
  //   return this.settingsService.settings$$()?.liteVersion ?? false;
  // }

  constructor(
    public foodDiaryService: FoodDiaryService,
    private ngZone: NgZone,
    private screenSizeWatcherService: ScreenSizeWatcherService,
    private settingsService: SettingsService,
    private photoCaptureService: PhotoCaptureService,
    private foodCatalogueService: FoodCatalogueService,
    protected deviceDetectorService: DeviceDetectorService,
    private accordionService: AccordionService,
  ) {
    // effect(() => console.log('SIGNAL isLegacySearch:', this.isLegacySearch$$())); // prettier-ignore
  }

  public ngOnInit(): void {
    // this.deviceDetectorService.logDeviceInfo();
  }

  public ngAfterViewInit(): void {
    this.triggerColumnRecalc();
  }

  private triggerColumnRecalc(): void {
    this.shouldRecalcColumns$$.update((val) => val + 1);
  }

  public ngOnDestroy(): void {}

  protected setBackgroundStyle(
    percent: number,
    isFirst: boolean = false,
    isLast: boolean = false,
  ): { [key: string]: string } {
    const percentCapped = percent <= 100 ? percent : 100;
    return {
      background: `linear-gradient(to right, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
      'border-top-left-radius': isFirst ? 'var(--unit-2)' : '0',
      'border-top-right-radius': isFirst ? 'var(--unit-2)' : '0',
      'border-bottom-left-radius': isLast ? 'var(--unit-2)' : '0',
      'border-bottom-right-radius': isLast ? 'var(--unit-2)' : '0',
    };
  }

  protected diaryEntryExpanded(diaryEntry: MatExpansionPanel, diaryEntryId: number) {
    if (this.screenSizeWatcherService.currentScreenType === ScreenType.DESKTOP) return;

    setTimeout(() => {
      window.scrollTo({
        top: diaryEntry._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'smooth',
      });
    }, 170);
  }

  protected accordionCollapse() {
    this.accordionService.closeGroup('food-group');
  }

  protected closeModal() {
    this.isAddFoodModalOpen = false;
    this.selectedProduct$$.set(null);
    this.isCreateNewProductMode$$.set(false);
    this.foodCatalogueService.clearSearch();
  }

  protected openAddFoodModal() {
    this.isAddFoodModalOpen = true;
  }

  protected async takePhoto() {
    this.isCameraPreviewOpen$$.set(true);
  }

  protected async onPhotoTaken(capturedPhoto: CapturedPhoto) {
    this.isCameraPreviewOpen$$.set(false);

    try {
      const result = await this.photoCaptureService.analyzeImage(capturedPhoto.file);

      if (result?.result && result.data) {
        console.log('Photo analysis result:', result.data);
        this.closeModal();
      } else if (result?.error) {
        console.error('Photo analysis failed:', result.error);
        // alert('Не удалось проанализировать фото. Попробуйте еще раз.');
      } else {
        console.error('Photo analysis returned no results');
        // alert('Продукт на фото не распознан. Попробуйте другое фото.');
      }
    } catch (error) {
      console.error('Error during photo analysis:', error);
      // alert('Ошибка при анализе фото. Попробуйте еще раз.');
    }
  }

  protected onCameraPreviewCancelled() {
    this.isCameraPreviewOpen$$.set(false);
  }

  protected selectProduct(product: CatalogueEntry) {
    this.selectedProduct$$.set(product);
  }

  protected openCreateNewProductMode() {
    this.isCreateNewProductMode$$.set(true);
  }

  protected goBackToSearch() {
    this.selectedProduct$$.set(null);
    this.isCreateNewProductMode$$.set(false);
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

  protected onVExpandOpened($event: CustomEvent<boolean>, diaryEntryId: number): void {
    if ($event.detail) {
      this.foodDiaryService.focusDiaryEntry(diaryEntryId);
      this.triggerColumnRecalc();
    } else {
      this.foodDiaryService.resetDiaryEntryForm(diaryEntryId);
    }
  }
}
