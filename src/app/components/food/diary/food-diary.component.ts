import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
  viewChildren,
  WritableSignal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatAccordion, MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { BMIComponent } from '@app/components/food/diary/bmi/bmi.component';
import { BodyWeightComponent } from '@app/components/food/diary/body-weight/body-weight.component';
import { CameraPreviewComponent } from '@app/components/food/diary/camera-preview/camera-preview.component';
import { DiaryEntryEditFormComponent } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form.component';
import { DiaryEntryNewFormComponent } from '@app/components/food/diary/diary-entry-new-form/diary-entry-new-form.component';
import { DiaryNavButtonsComponent } from '@app/components/food/diary/diary-nav/diary-nav-buttons.component';
import { DeviceDetectorService } from '@app/services/device-detector.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { PhotoCaptureService } from '@app/services/photo-capture.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { SettingsService } from '@app/services/settings.service';
import { VoiceRecordingService } from '@app/services/voice-recording.service';
import { FlipAnimateDirective } from '@app/shared/directives/flip-animate.directive';
import { CapturedPhoto, CatalogueEntry, ScreenType } from '@app/shared/interfaces';
import { IconName } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-food-diary',
  templateUrl: './food-diary.component.html',
  styleUrl: './food-diary.component.scss',
  imports: [
    NgStyle,
    ReactiveFormsModule,
    MatExpansionModule,
    MatCardModule,
    MatIconModule,
    DiaryNavButtonsComponent,
    DiaryEntryEditFormComponent,
    DiaryEntryNewFormComponent,
    BodyWeightComponent,
    BMIComponent,
    VButton,
    VModal,
    VIcon,
    CameraPreviewComponent,
    VInput,
    VCard,
    FlipAnimateDirective,
  ],
})
export class FoodDiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly foodAccordion = viewChild.required(MatAccordion);
  protected readonly newDiaryEntryPanel = viewChild.required<MatExpansionPanel>('newDiaryEntryPanel');
  protected readonly contDiv = viewChild.required<ElementRef>('foodCont');
  protected readonly nameDivs = viewChildren<ElementRef>('foodName');
  protected readonly weightsDivs = viewChildren<ElementRef>('foodWeight');
  protected readonly kcalsDivs = viewChildren<ElementRef>('foodKcals');
  protected readonly percentsDivs = viewChildren<ElementRef>('foodPercent');

  protected isAddFoodModalOpen = false;
  protected readonly isLegacySearch$$ = signal(false);

  protected readonly isCameraPreviewOpen$$: WritableSignal<boolean> = signal(false);

  protected get shouldShowCameraButton(): boolean {
    return this.deviceDetectorService.shouldShowCameraButtonSync();
  }

  protected readonly foodNameControl = new FormControl('');

  private searchSubscription?: Subscription;

  protected readonly IconName = IconName;

  private readonly searchTypeSwitchEffect = effect(() => {
    const isLegacy = this.isLegacySearch$$();
    const currentValue = this.foodNameControl.value;

    if (currentValue && currentValue.trim()) {
      if (isLegacy) {
        this.foodCatalogueService.legacySearchProducts(currentValue);
      } else {
        this.foodCatalogueService.searchProducts(currentValue);
      }
    }
  });

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

  protected get isRecording(): boolean {
    return this.voiceRecordingService.isRecording$$();
  }

  protected get searchResults$$(): CatalogueEntry[] {
    if (this.isLegacySearch$$()) {
      return this.foodCatalogueService.legacySearchResults$$();
    } else {
      return this.foodCatalogueService.searchResults$$();
    }
  }

  constructor(
    public foodDiaryService: FoodDiaryService,
    private ngZone: NgZone,
    private screenSizeWatcherService: ScreenSizeWatcherService,
    private settingsService: SettingsService,
    private voiceRecordingService: VoiceRecordingService,
    private photoCaptureService: PhotoCaptureService,
    private foodCatalogueService: FoodCatalogueService,
    protected deviceDetectorService: DeviceDetectorService,
  ) {
    // effect(() => console.log('SIGNAL isLegacySearch:', this.isLegacySearch$$())); // prettier-ignore
  }

  public ngOnInit(): void {
    this.deviceDetectorService.logDeviceInfo();

    this.searchSubscription = this.foodNameControl.valueChanges.subscribe((value) => {
      if (value === null) return;

      if (this.isLegacySearch$$()) {
        this.foodCatalogueService.legacySearchProducts(value);
      } else {
        this.foodCatalogueService.searchProducts(value);
      }
    });
  }

  public ngAfterViewInit(): void {
    setTimeout(() => this.adjustWidths(), 0);
  }

  public ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
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

  protected newDiaryEntryExpanded() {
    if (this.screenSizeWatcherService.currentScreenType === ScreenType.DESKTOP) return;

    setTimeout(() => {
      const panelEl = this.newDiaryEntryPanel();
      if (panelEl?._body?.nativeElement) {
        window.scrollTo({
          top: panelEl._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
          behavior: 'smooth',
        });
      }
    }, 170);
  }

  protected accordionCollapse() {
    this.foodAccordion().closeAll();
  }

  protected closeModal() {
    this.isAddFoodModalOpen = false;
    this.foodNameControl.setValue('');
    this.foodCatalogueService.searchResults$$.set([]);
    this.foodCatalogueService.legacySearchResults$$.set([]);
  }

  protected openAddFoodModal() {
    this.isAddFoodModalOpen = true;
    this.foodNameControl.setValue('');
    this.foodCatalogueService.searchResults$$.set([]);
    this.foodCatalogueService.legacySearchResults$$.set([]);
  }

  protected onModalOpened() {
    setTimeout(() => {
      const inputEl = document.querySelector(
        'v-modal v-input.catalogue-entry-name-input input.input-field',
      ) as HTMLInputElement;
      if (inputEl) inputEl.focus();
    }, 0);
  }

  protected async toggleVoiceRecording() {
    if (this.isRecording) {
      this.voiceRecordingService.stopRecording();
    } else {
      try {
        await this.voiceRecordingService.startRecording();
      } catch (error) {
        console.error('Failed to start voice recording:', error);
        alert('Failed to access microphone. Please check permissions.');
      }
    }
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
    // this.foodNameControl.setValue(product.name);
    // this.foodCatalogueService.searchResults$$.set([]);
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

  protected toggleLegacySearch() {
    this.isLegacySearch$$.update((val) => !val);
  }

  protected getDisplayName(catalogueEntry: CatalogueEntry): string {
    if (this.isLegacySearch$$()) {
      return catalogueEntry.legacyName || catalogueEntry.name;
    }
    return catalogueEntry.name;
  }
}
