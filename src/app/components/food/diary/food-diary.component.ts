import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  viewChildren,
  WritableSignal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatAccordion, MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
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
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { SettingsService } from '@app/services/settings.service';
import { CapturedPhoto, CatalogueEntry, ScreenType } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';

enum ModalViewMode {
  CAMERA_PREVIEW,
  SEARCH,
  ADD_DIARY_ENTRY,
}

@Component({
  selector: 'app-food-diary',
  templateUrl: './food-diary.component.html',
  styleUrl: './food-diary.component.scss',
  imports: [
    NgStyle,
    MatExpansionModule,
    MatCardModule,
    DiaryNavButtonsComponent,
    DiaryEntryEditFormComponent,
    DiaryEntryAddFormComponent,
    BodyWeightComponent,
    BMIComponent,
    VButton,
    VModal,
    CameraPreviewComponent,
    FoodSearchComponent,
  ],
})
export class FoodDiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly foodAccordion = viewChild.required(MatAccordion);
  protected readonly contDiv = viewChild.required<ElementRef>('foodCont');
  protected readonly nameDivs = viewChildren<ElementRef>('foodName');
  protected readonly weightsDivs = viewChildren<ElementRef>('foodWeight');
  protected readonly kcalsDivs = viewChildren<ElementRef>('foodKcals');
  protected readonly percentsDivs = viewChildren<ElementRef>('foodPercent');

  protected isAddFoodModalOpen = false;

  protected readonly isCameraPreviewOpen$$: WritableSignal<boolean> = signal(false);
  protected readonly selectedProduct$$: WritableSignal<CatalogueEntry | null> = signal(null);

  protected readonly currentViewMode$$ = computed(() => {
    if (this.isCameraPreviewOpen$$()) {
      return ModalViewMode.CAMERA_PREVIEW;
    }
    if (this.selectedProduct$$()) {
      return ModalViewMode.ADD_DIARY_ENTRY;
    }
    return ModalViewMode.SEARCH;
  });

  protected readonly ModalViewMode = ModalViewMode;

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

    if (this.isLiteVersionSetting) {
      return `Съедено ${percent}% от дневной нормы`;
    } else {
      return `Съедено ${this.todaysKcalsEaten} ккал. от нормы ${this.todaysTargetKcals} (${percent}%)`;
    }
  }

  protected get isLiteVersionSetting(): boolean {
    return this.settingsService.settings$$()?.liteVersion ?? false;
  }

  constructor(
    public foodDiaryService: FoodDiaryService,
    private ngZone: NgZone,
    private screenSizeWatcherService: ScreenSizeWatcherService,
    private settingsService: SettingsService,
    private photoCaptureService: PhotoCaptureService,
    private foodCatalogueService: FoodCatalogueService,
    protected deviceDetectorService: DeviceDetectorService,
  ) {
    // effect(() => console.log('SIGNAL isLegacySearch:', this.isLegacySearch$$())); // prettier-ignore
  }

  public ngOnInit(): void {
    this.deviceDetectorService.logDeviceInfo();
  }

  public ngAfterViewInit(): void {
    setTimeout(() => this.adjustWidths(), 0);
  }

  public ngOnDestroy(): void {
    // Cleanup if needed
  }

  protected setBackgroundStyle(percent: number) {
    const percentCapped = percent <= 100 ? percent : 100;
    return {
      background: `linear-gradient(to right, var(--gradient-color) ${percentCapped}%, var(--gradient-bg) ${percentCapped}%)`,
    };
  }

  protected diaryEntryExpanded(diaryEntry: MatExpansionPanel, diaryEntryId: number) {
    this.foodDiaryService.diaryEntryClickedFocus$.next(diaryEntryId);

    if (this.screenSizeWatcherService.currentScreenType === ScreenType.DESKTOP) return;

    setTimeout(() => {
      window.scrollTo({
        top: diaryEntry._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'smooth',
      });
    }, 170);
  }

  protected accordionCollapse() {
    this.foodAccordion().closeAll();
  }

  protected closeModal() {
    this.isAddFoodModalOpen = false;
    this.selectedProduct$$.set(null);
    this.foodCatalogueService.clearSearch();
  }

  protected openAddFoodModal() {
    this.isAddFoodModalOpen = true;
  }

  protected onModalOpened() {
    // Логика фокуса теперь в FoodSearchComponent.ngAfterViewInit()
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

  protected goBackToSearch() {
    this.selectedProduct$$.set(null);
  }

  private adjustWidths(): void {
    this.ngZone.run(() => {
      const weightsDivs = this.weightsDivs();
      const kcalsDivs = this.kcalsDivs();
      const percentsDivs = this.percentsDivs();
      const nameDivs = this.nameDivs();
      const contDiv = this.contDiv();

      this.setWidth(weightsDivs);
      if (!this.isLiteVersionSetting) {
        this.setWidth(kcalsDivs);
      }
      this.setWidth(percentsDivs);

      const weightsWidth = this.getMaxWidth(weightsDivs);
      const kcalsWidth = this.getMaxWidth(kcalsDivs);
      const percentsWidth = this.getMaxWidth(percentsDivs);

      this.setWidth(weightsDivs, weightsWidth + 3);
      if (!this.isLiteVersionSetting) {
        this.setWidth(kcalsDivs, kcalsWidth + 10);
      }
      this.setWidth(percentsDivs, percentsWidth + 12);

      if (contDiv?.nativeElement) {
        const remainingWidth = contDiv.nativeElement.offsetWidth - weightsWidth - kcalsWidth - percentsWidth;
        this.setWidth(nameDivs, remainingWidth);
      }
    });
  }

  private getMaxWidth(elems: readonly ElementRef[]): number {
    const widths = elems.map((elem) => elem.nativeElement.offsetWidth);
    return Math.max(...widths);
  }

  private setWidth(elems: readonly ElementRef[], width?: number): void {
    elems.forEach((elem) => {
      elem.nativeElement.style.width = width === undefined ? 'auto' : `${width}px`;
    });
  }
}
