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
    '[style.minHeight]': 'minHeight$$()',
  },
})
export class VCard {
  public readonly config = input<VCardConfig>({});

  public readonly onCardclick = output<MouseEvent>();

  protected readonly settings$$ = computed(() => ({
    ...DEFAULT_V_CARD_CONFIG,
    ...this.config(),
  }));

  protected readonly borderRadius$$ = computed(() => this.settings$$().borderRadius);
  protected readonly padding$$ = computed(() => this.settings$$().padding);
  protected readonly backgroundImageUrl$$ = computed(() => this.settings$$().backgroundImageUrl);
  protected readonly backgroundImageOpacity$$ = computed(() => this.settings$$().backgroundImageOpacity);
  protected readonly minHeight$$ = computed(() => this.settings$$().minHeight);

  protected readonly borderRadiusString$$ = computed(() => `var(--unit-${this.borderRadius$$()})`);
  protected readonly paddingString$$ = computed(() => `var(--unit-${this.padding$$()})`);

  protected readonly cardBackgroundImage$$ = computed(() => {
    const imageUrl = this.backgroundImageUrl$$();
    if (!imageUrl) return null;
    const opacity = this.backgroundImageOpacity$$();
    return `linear-gradient(rgba(255, 255, 255, ${opacity}), rgba(255, 255, 255, ${opacity})), url('${imageUrl}')`;
  });

  protected onClick(event: MouseEvent): void {
    this.onCardclick.emit(event);
  }
}
