import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import { VBackdropDirective } from '@app/shared/ui-kit/backdrop.directive';
import { CssUnitValue } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { LayerController, PARENT_LAYER_ID, ZLayerService } from '@app/shared/ui-kit/z-layer.service';

@Component({
  selector: 'v-modal',
  templateUrl: './v-modal.html',
  styleUrl: './v-modal.css',
  imports: [CommonModule, VButton, VBackdropDirective],
  providers: [
    {
      provide: PARENT_LAYER_ID,
      useFactory: (modal: VModal) => modal.layerId,
      deps: [VModal],
    },
  ],
  host: {
    '[style.--v-modal-width]': 'width()',
    '[style.--v-modal-border-radius]': 'getBorderRadius()',
    '[style.--v-modal-z-index]': 'zIndex',
    '[style.--v-modal-padding-y]': 'paddingYString()',
    '[style.--v-modal-padding-x]': 'paddingXString()',
  },
})
export class VModal implements OnInit, OnDestroy {
  public readonly isOpen = input<boolean>(false);
  public readonly isCloseButtonVisible = input<boolean>(false);
  public readonly width = input<string>('400px');
  public readonly borderRadius = input<CssUnitValue>(2);

  public readonly paddingY = input<CssUnitValue>(2);
  public readonly paddingX = input<CssUnitValue>(2);

  public readonly onClose = output<void>();
  public readonly onOpen = output<void>();

  protected readonly paddingYString = computed(() => `var(--unit-${this.paddingY()})`);
  protected readonly paddingXString = computed(() => `var(--unit-${this.paddingX()})`);

  private readonly onIsOpenChanged = effect(() => {
    const isOpen = this.isOpen();
    if (isOpen) this.onOpen.emit();
  });

  protected zIndex = 100;
  private layerController?: LayerController;

  private readonly zLayerService: ZLayerService = inject(ZLayerService);

  constructor() {}

  public get layerId(): string | undefined {
    return this.layerController?.id;
  }

  public ngOnInit(): void {
    if (this.isOpen()) {
      this.registerLayer();
    }
  }

  public ngOnDestroy(): void {
    this.layerController?.destroy();
  }

  public getBorderRadius(): string {
    return `var(--unit-${this.borderRadius()})`;
  }

  protected closeModal(): void {
    this.onClose.emit();
  }

  private registerLayer(): void {
    this.layerController = this.zLayerService.registerLayer('modal');
    this.zIndex = this.layerController.zIndex;
  }
}
