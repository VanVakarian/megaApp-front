import { NgClass } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodAddModalService, ModalState } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
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
  templateUrl: './food-search.html',
  styleUrl: './food-search.scss',
  imports: [VInput, VButton, VIcon, VCard, FlipAnimateDirective, NgClass],
  animations: [fadeScaleInAnimation],
})
export class FoodSearch {
  protected readonly Icon = IconName;

  protected readonly isLegacySearch$$ = computed(() => this.foodCatalogueService.isLegacySearch$$());

  protected readonly searchResults$$ = computed(() => {
    if (this.isLegacySearch$$()) {
      return this.foodCatalogueService.legacySearchResults$$();
    } else {
      return this.foodCatalogueService.searchResults$$();
    }
  });

  private readonly clearSearchOnModalCloseEffect$$ = effect(() => {
    const currentState = this.foodAddModalService.currentState$$();

    if (currentState === ModalState.CLOSED) {
      this.foodAddModalService.searchQuery$$.set('');
      this.foodCatalogueService.clearSearch();
    }

    if (currentState === ModalState.SEARCH) {
      setTimeout(() => this.focusInput(), 200);
    }
  });

  private readonly searchEffect$$ = effect(() => {
    const searchQuery = this.foodAddModalService.searchQuery$$();
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

  protected readonly deviceInfoService = inject(DeviceInfoService);
  protected readonly foodAddModalService = inject(FoodAddModalService);
  private readonly voiceRecordingService = inject(VoiceRecordingService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);

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

  protected onSearchClearClick(): void {
    this.foodAddModalService.searchQuery$$.set('');
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
    if (!catalogueEntry.imageVersion) {
      return null;
    }
    return `/api/images/food/${catalogueEntry.id}-thumb-v${catalogueEntry.imageVersion}.webp`;
  }
}
