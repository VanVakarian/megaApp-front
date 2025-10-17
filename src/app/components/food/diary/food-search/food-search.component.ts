import { NgClass } from '@angular/common';
import { AfterViewInit, Component, computed, effect, inject, OnDestroy } from '@angular/core';
import { DeviceDetectorService } from '@app/services/device-detector.service';
import { FoodAddModalService, ModalState } from '@app/services/food/food-add-modal.service';
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

@Component({
  selector: 'food-search',
  templateUrl: './food-search.component.html',
  styleUrl: './food-search.component.scss',
  imports: [VInput, VButton, VIcon, VCard, FlipAnimateDirective, NgClass],
  animations: [fadeScaleInAnimation],
})
export class FoodSearchComponent implements AfterViewInit, OnDestroy {
  protected readonly Icon = IconName;

  protected get searchQuery$$() {
    return this.foodAddModalService.searchQuery$$;
  }

  protected readonly isMobile$$ = computed(() => this.screenSizeWatcherService.isMobile$$());

  protected readonly isLegacySearch$$ = computed(() => this.foodCatalogueService.isLegacySearch$$());

  protected readonly searchResults$$ = computed(() => {
    if (this.isLegacySearch$$()) {
      return this.foodCatalogueService.legacySearchResults$$();
    } else {
      return this.foodCatalogueService.searchResults$$();
    }
  });

  private readonly clearSearchOnModalClose$$ = effect(() => {
    const currentState = this.foodAddModalService.currentState;

    if (currentState === ModalState.CLOSED) {
      this.foodAddModalService.searchQuery$$.set('');
      this.foodCatalogueService.clearSearch();
    }

    if (currentState === ModalState.SEARCH) {
      setTimeout(() => this.focusInput(), 200);
    }
  });

  private readonly searchEffect$$ = effect(() => {
    const searchQuery = this.searchQuery$$();
    const isLegacy = this.isLegacySearch$$();

    if (searchQuery && searchQuery.trim()) {
      if (isLegacy) {
        this.foodCatalogueService.legacySearchProducts(searchQuery);
      } else {
        this.foodCatalogueService.searchProducts(searchQuery);
      }
    } else {
      this.foodCatalogueService.clearSearch();
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
  private readonly foodAddModalService = inject(FoodAddModalService);
  private readonly deviceDetectorService = inject(DeviceDetectorService);
  private readonly screenSizeWatcherService = inject(ScreenSizeWatcherService);

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

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
    this.foodAddModalService.takePhoto();
  }

  protected selectProduct(product: CatalogueEntry): void {
    this.foodAddModalService.selectProduct(product);
  }

  protected addProduct(): void {
    this.foodAddModalService.addProduct();
  }

  protected closeModal(): void {
    this.foodAddModalService.closeModal();
  }

  protected getDisplayName(catalogueEntry: CatalogueEntry): string {
    const isLegacy = this.isLegacySearch$$();
    if (isLegacy) {
      return catalogueEntry.legacyName || catalogueEntry.name;
    }
    return catalogueEntry.name;
  }

  protected getImageUrl(catalogueEntry: CatalogueEntry): string | null {
    if (!catalogueEntry.hasImage) {
      return null;
    }
    return `/api/images/food/${catalogueEntry.id}-thumb.webp`;
  }
}
