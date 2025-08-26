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
import { BMIComponent } from '@app/components/food/diary/bmi/bmi.component';
import { BodyWeightComponent } from '@app/components/food/diary/body-weight/body-weight.component';
import { CameraPreviewComponent } from '@app/components/food/diary/camera-preview/camera-preview.component';
import { DiaryEntryEditFormComponent } from '@app/components/food/diary/diary-entry-edit-form/diary-entry-edit-form.component';
import { DiaryEntryNewFormComponent } from '@app/components/food/diary/diary-entry-new-form/diary-entry-new-form.component';
import { DiaryNavButtonsComponent } from '@app/components/food/diary/diary-nav/diary-nav-buttons.component';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { PhotoCaptureService } from '@app/services/photo-capture.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { SettingsService } from '@app/services/settings.service';
import { VoiceRecordingService } from '@app/services/voice-recording.service';
import { CapturedPhoto, ScreenType } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VModal } from '@app/shared/ui-kit/v-modal/v-modal';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-food-diary',
  templateUrl: './food-diary.component.html',
  styleUrl: './food-diary.component.scss',
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
    VButton,
    VModal,
    CameraPreviewComponent,
  ],
})
export class FoodDiaryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatAccordion)
  protected foodAccordion!: MatAccordion;

  @ViewChild('newDiaryEntryPanel')
  protected newDiaryEntryPanel!: MatExpansionPanel;

  @ViewChild('foodCont')
  protected contDiv!: ElementRef;

  @ViewChildren('foodName')
  protected nameDivs!: QueryList<ElementRef>;

  @ViewChildren('foodWeight')
  protected weightsDivs!: QueryList<ElementRef>;

  @ViewChildren('foodKcals')
  protected kcalsDivs!: QueryList<ElementRef>;

  @ViewChildren('foodPercent')
  protected percentsDivs!: QueryList<ElementRef>;

  protected isAddFoodModalOpen = false;
  protected isCameraPreviewOpen = false;

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

  constructor(
    public foodDiaryService: FoodDiaryService,
    private ngZone: NgZone,
    private screenSizeWatcherService: ScreenSizeWatcherService,
    private settingsService: SettingsService,
    private voiceRecordingService: VoiceRecordingService,
    private photoCaptureService: PhotoCaptureService,
  ) {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    // initial setting columns width
    combineLatest([this.weightsDivs.changes, this.kcalsDivs.changes, this.percentsDivs.changes]).subscribe(() =>
      this.adjustWidths(),
    );
    setTimeout(() => this.adjustWidths(), 0);
  }

  public ngOnDestroy(): void {}

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
      window.scrollTo({
        top: this.newDiaryEntryPanel._body.nativeElement.getBoundingClientRect().top + window.scrollY - 70,
        behavior: 'smooth',
      });
    }, 170);
  }

  protected accordionCollapse() {
    this.foodAccordion.closeAll();
  }

  protected closeModal() {
    this.isAddFoodModalOpen = false;
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
    this.isCameraPreviewOpen = true;
  }

  protected async onPhotoTaken(capturedPhoto: CapturedPhoto) {
    this.isCameraPreviewOpen = false;

    try {
      const result = await this.photoCaptureService.analyzeImage(capturedPhoto.file);

      if (result?.result && result.data) {
        console.log('Photo analysis result:', result.data);
        this.closeModal();
      } else if (result?.error) {
        console.error('Photo analysis failed:', result.error);
        alert('Не удалось проанализировать фото. Попробуйте еще раз.');
      } else {
        console.error('Photo analysis returned no results');
        alert('Продукт на фото не распознан. Попробуйте другое фото.');
      }
    } catch (error) {
      console.error('Error during photo analysis:', error);
      alert('Ошибка при анализе фото. Попробуйте еще раз.');
    }
  }

  protected onCameraPreviewCancelled() {
    this.isCameraPreviewOpen = false;
  }

  private adjustWidths(): void {
    this.ngZone.run(() => {
      this.setWidth(this.weightsDivs);
      if (!this.isLiteVersionSetting) {
        this.setWidth(this.kcalsDivs);
      }
      this.setWidth(this.percentsDivs);

      const weightsWidth = this.getMaxWidth(this.weightsDivs);
      const kcalsWidth = this.getMaxWidth(this.kcalsDivs);
      const percentsWidth = this.getMaxWidth(this.percentsDivs);

      this.setWidth(this.weightsDivs, weightsWidth + 3);
      if (!this.isLiteVersionSetting) {
        this.setWidth(this.kcalsDivs, kcalsWidth + 10);
      }
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
