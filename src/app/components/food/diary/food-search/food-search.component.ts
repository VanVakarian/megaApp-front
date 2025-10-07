import { NgClass } from '@angular/common';
import { AfterViewInit, Component, computed, effect, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DeviceDetectorService } from '@app/services/device-detector.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { ScreenSizeWatcherService } from '@app/services/screen-size-watcher.service';
import { VoiceRecordingService } from '@app/services/voice-recording.service';
import { fadeScaleInAnimation } from '@app/shared/animations';
import { FlipAnimateDirective } from '@app/shared/directives/flip-animate.directive';
import { CatalogueEntry } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';
import { Subscription } from 'rxjs';

@Component({
  selector: 'food-search',
  templateUrl: './food-search.component.html',
  styleUrl: './food-search.component.scss',
  imports: [ReactiveFormsModule, VInput, VButton, VIcon, VCard, FlipAnimateDirective, NgClass],
  animations: [fadeScaleInAnimation],
})
export class FoodSearchComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly isSearchMode = input<boolean>(false);

  readonly onProductSelect = output<CatalogueEntry>();
  readonly onPhotoTake = output<void>();
  readonly onAddNewProduct = output<void>();
  readonly onClose = output<void>();

  protected readonly foodNameControl = new FormControl('');
  protected readonly Icon = IconName;

  private searchSubscription?: Subscription;

  protected readonly isMobile$$ = computed(() => this.screenSizeWatcherService.isMobile$$());

  protected readonly isLegacySearch$$ = computed(() => this.foodCatalogueService.isLegacySearch$$());

  protected readonly searchResults$$ = computed(() => {
    const isLegacy = this.isLegacySearch$$();
    if (isLegacy) {
      return this.foodCatalogueService.legacySearchResults$$();
    } else {
      return this.foodCatalogueService.searchResults$$();
    }
  });

  private readonly focusEffect = effect(() => {
    if (this.isSearchMode()) {
      setTimeout(() => this.focusInput(), 200);
    }
  });

  private readonly syncSearchQueryEffect = effect(() => {
    const serviceQuery = this.foodCatalogueService.searchQuery$$();
    if (this.foodNameControl.value !== serviceQuery) {
      this.foodNameControl.setValue(serviceQuery, { emitEvent: false });
    }
  });

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

  protected get isRecording(): boolean {
    return this.voiceRecordingService.isRecording$$();
  }

  protected get shouldShowCameraButton(): boolean {
    return this.deviceDetectorService.shouldShowCameraButtonSync();
  }

  private readonly voiceRecordingService = inject(VoiceRecordingService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);
  private readonly deviceDetectorService = inject(DeviceDetectorService);
  private readonly screenSizeWatcherService = inject(ScreenSizeWatcherService);

  ngOnInit(): void {
    this.searchSubscription = this.foodNameControl.valueChanges.subscribe((value) => {
      if (value === null) return;

      if (this.isLegacySearch$$()) {
        this.foodCatalogueService.legacySearchProducts(value);
      } else {
        this.foodCatalogueService.searchProducts(value);
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  private focusInput(): void {
    const inputEl = document.querySelector('v-input.catalogue-entry-name-input input') as HTMLInputElement;
    if (inputEl) inputEl.focus();
  }

  protected toggleLegacySearch(): void {
    this.foodCatalogueService.isLegacySearch$$.update((val) => !val);
  }

  protected async toggleVoiceRecording(): Promise<void> {
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

  protected takePhoto(): void {
    this.onPhotoTake.emit();
  }

  protected selectProduct(product: CatalogueEntry): void {
    this.foodCatalogueService.searchResults$$.set([]);
    this.foodCatalogueService.legacySearchResults$$.set([]);
    this.onProductSelect.emit(product);
  }

  protected addProduct(): void {
    this.onAddNewProduct.emit();
  }

  protected closeModal(): void {
    this.onClose.emit();
  }

  protected getDisplayName(catalogueEntry: CatalogueEntry): string {
    const isLegacy = this.isLegacySearch$$();
    if (isLegacy) {
      return catalogueEntry.legacyName || catalogueEntry.name;
    }
    return catalogueEntry.name;
  }
}
