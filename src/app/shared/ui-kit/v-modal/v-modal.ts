import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, input, output } from '@angular/core';
import { VBackdropDirective } from '@app/shared/ui-kit/backdrop.directive';
import { CssUnitValue } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { LayerController, PARENT_LAYER_ID, ZLayerService } from '@app/shared/ui-kit/z-layer.service';

export type ModalDeviceType = 'mobile' | 'desktop';

export interface VModalConfig {
  isOpen?: boolean;
  isCloseButtonVisible?: boolean;
  width?: string;
  mobileWidth?: string;
  desktopWidth?: string;
  borderRadius?: CssUnitValue;
  padding?: CssUnitValue;
  paddingX?: CssUnitValue;
  paddingY?: CssUnitValue;
  deviceType?: ModalDeviceType;
}

const DEFAULT_V_MODAL_CONFIG: Required<VModalConfig> = {
  isOpen: false,
  isCloseButtonVisible: false,
  width: 'min(100vw, 400px)',
  mobileWidth: undefined as unknown as string,
  desktopWidth: undefined as unknown as string,
  borderRadius: 2,
  padding: undefined as unknown as CssUnitValue,
  paddingX: 2,
  paddingY: 2,
  deviceType: undefined as unknown as ModalDeviceType,
};

@Component({
  selector: 'v-modal',
  templateUrl: './v-modal.html',
  styleUrl: './v-modal.css',
  host: {
    '[style.--v-modal-width]': 'width$$()',
    '[style.--v-modal-border-radius]': 'borderRadiusString$$()',
    '[style.--v-modal-z-index]': 'zIndex',
    '[style.--v-modal-padding-x]': 'paddingXString$$()',
    '[style.--v-modal-padding-y]': 'paddingYString$$()',
  },
  providers: [
    {
      provide: PARENT_LAYER_ID,
      useFactory: (modal: VModal) => modal.layerId,
      deps: [VModal],
    },
  ],
  imports: [CommonModule, VButton, VBackdropDirective],
})
export class VModal {
  public readonly config = input<VModalConfig>({});

  public readonly onClose = output<void>();
  public readonly onOpen = output<void>();

  protected readonly settings$$ = computed(() => ({
    ...DEFAULT_V_MODAL_CONFIG,
    ...this.config(),
  }));

  protected readonly width$$ = computed(() => this.getFinalWidth());
  protected readonly paddingX$$ = computed(() => this.getPaddingX());
  protected readonly paddingY$$ = computed(() => this.getPaddingY());

  protected readonly paddingXString$$ = computed(() => `var(--unit-${this.paddingX$$()})`);
  protected readonly paddingYString$$ = computed(() => `var(--unit-${this.paddingY$$()})`);
  protected readonly borderRadiusString$$ = computed(() => `var(--unit-${this.settings$$().borderRadius})`);

  protected zIndex = 100;
  private layerController?: LayerController;
  private readonly zLayerService = inject(ZLayerService);

  private readonly isOpenEffect$$ = effect(() => {
    const isOpen = this.settings$$().isOpen;
    if (isOpen && !this.layerController) {
      this.registerLayer();
      this.onOpen.emit();
    }
  });

  public get layerId(): string | undefined {
    return this.layerController?.id;
  }

  public ngOnDestroy(): void {
    this.layerController?.destroy();
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.settings$$().isOpen) {
      this.closeModal();
    }
  }

  protected closeModal(): void {
    this.onClose.emit();
  }

  private registerLayer(): void {
    this.layerController = this.zLayerService.registerLayer('modal');
    this.zIndex = this.layerController.zIndex;
  }

  private getPaddingX(): CssUnitValue {
    const config = this.config();
    if (config.paddingX !== undefined) return config.paddingX;
    if (config.padding !== undefined) return config.padding;
    return this.settings$$().paddingX;
  }

  private getPaddingY(): CssUnitValue {
    const config = this.config();
    if (config.paddingY !== undefined) return config.paddingY;
    if (config.padding !== undefined) return config.padding;
    return this.settings$$().paddingY;
  }

  private getFinalWidth(): string {
    const deviceType = this.settings$$().deviceType;
    const config = this.config();

    if (deviceType === 'mobile' && config.mobileWidth) {
      return config.mobileWidth;
    }
    if (deviceType === 'desktop' && config.desktopWidth) {
      return config.desktopWidth;
    }
    return this.settings$$().width;
  }
}
