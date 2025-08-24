import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, input, output } from '@angular/core';
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
  },
})
export class VModal implements OnInit, OnDestroy {
  public readonly isOpen = input<boolean>(false);
  public readonly isCloseButtonVisible = input<boolean>(false);
  public readonly width = input<string>('400px');
  public readonly borderRadius = input<CssUnitValue>(2);

  public readonly onClose = output<void>();

  protected zIndex = 100;
  private layerController?: LayerController;

  constructor(private readonly zLayerService: ZLayerService) {}

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
