import { Component, computed, input, output } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

export interface VCardConfig {
  borderRadius?: CssUnitValue;
  padding?: CssUnitValue;
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number;
  minHeight?: string;
}

const DEFAULT_V_CARD_CONFIG: Required<VCardConfig> = {
  borderRadius: 4,
  padding: 2,
  backgroundImageUrl: null,
  backgroundImageOpacity: 1,
  minHeight: 'auto',
};

@Component({
  selector: 'v-card',
  templateUrl: './v-card.html',
  styleUrl: './v-card.css',
  host: {
    '[style.--v-card-border-radius]': 'borderRadiusString$$()',
    '[style.--v-card-padding]': 'paddingString$$()',
    '[style.backgroundImage]': 'cardBackgroundImage$$()',
    '[style.minHeight]': 'settings$$().minHeight',
  },
})
export class VCard {
  public readonly config = input<VCardConfig>({});

  public readonly onCardclick = output<MouseEvent>();

  protected readonly settings$$ = computed(() => ({
    ...DEFAULT_V_CARD_CONFIG,
    ...this.config(),
  }));

  protected readonly borderRadiusString$$ = computed(() => `var(--unit-${this.settings$$().borderRadius})`);
  protected readonly paddingString$$ = computed(() => `var(--unit-${this.settings$$().padding})`);

  protected readonly cardBackgroundImage$$ = computed(() => {
    const { backgroundImageUrl, backgroundImageOpacity } = this.settings$$();
    if (!backgroundImageUrl) return null;
    return `linear-gradient(rgba(255, 255, 255, ${backgroundImageOpacity}), rgba(255, 255, 255, ${backgroundImageOpacity})), url('${backgroundImageUrl}')`;
  });

  protected onClick(event: MouseEvent): void {
    this.onCardclick.emit(event);
  }
}
