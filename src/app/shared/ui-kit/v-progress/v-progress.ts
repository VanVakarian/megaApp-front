import { Component, computed, input } from '@angular/core';
import { CssUnitValue } from '@app/shared/ui-kit/types';

export enum ProgressBarStyle {
  Flat,
  Raised,
  Inset,
}

export interface VProgressConfig {
  value?: number;
  min?: number;
  max?: number;
  height?: CssUnitValue;
  borderRadius?: CssUnitValue;
  barColor?: string;
  barStyle?: ProgressBarStyle;
  barGap?: number;
  isShowValues?: boolean;
  valueSuffix?: string;
}

const DEFAULT_V_PROGRESS_CONFIG: Required<VProgressConfig> = {
  value: 0,
  min: 0,
  max: 100,
  height: 3,
  borderRadius: 2,
  barColor: 'var(--color-primary)',
  barStyle: ProgressBarStyle.Flat,
  barGap: 1,
  isShowValues: false,
  valueSuffix: '',
};

@Component({
  selector: 'v-progress',
  templateUrl: './v-progress.html',
  styleUrl: './v-progress.css',
  host: {
    '[style.--v-progress-height]': 'heightString$$()',
    '[style.--v-progress-border-radius]': 'borderRadiusString$$()',
    '[style.--v-progress-bar-color]': 'barColor$$()',
    '[style.--v-progress-percentage]': 'percentage$$()',
    '[style.--v-progress-bar-gap]': 'barGap$$()',
    '[style.--v-progress-value]': 'settings$$().value',
    '[attr.bar-style]': 'barStyle$$()',
  },
})
export class VProgress {
  public readonly config = input<VProgressConfig>({});

  protected readonly settings$$ = computed(() => ({
    ...DEFAULT_V_PROGRESS_CONFIG,
    ...this.config(),
  }));

  protected readonly heightString$$ = computed(() => `var(--unit-${this.settings$$().height})`);
  protected readonly borderRadiusString$$ = computed(() => `var(--unit-${this.settings$$().borderRadius})`);
  protected readonly barColor$$ = computed(() => this.settings$$().barColor);
  protected readonly barStyle$$ = computed(() => {
    const style = this.settings$$().barStyle;
    switch (style) {
      case ProgressBarStyle.Flat:
        return 'flat';
      case ProgressBarStyle.Raised:
        return 'raised';
      case ProgressBarStyle.Inset:
        return 'inset';
      default:
        return 'flat';
    }
  });
  protected readonly barGap$$ = computed(() => `${this.settings$$().barGap}px`);

  protected readonly isShowValues$$ = computed(() => this.settings$$().isShowValues);

  protected readonly scaleMin$$ = computed(() => {
    const { min, value } = this.settings$$();
    return Math.min(min, value);
  });

  protected readonly scaleMax$$ = computed(() => {
    const { max, value } = this.settings$$();
    return Math.max(max, value);
  });

  protected readonly scaleRange$$ = computed(() => this.scaleMax$$() - this.scaleMin$$());

  protected readonly leftLabel$$ = computed(() => {
    const { value, min } = this.settings$$();
    return value < min ? value : min;
  });

  protected readonly leftLabelText$$ = computed(() => this.formatValue(this.leftLabel$$()));

  protected readonly leftLabelIsPrimary$$ = computed(() => this.leftLabel$$() === this.settings$$().min);

  protected readonly rightLabel$$ = computed(() => {
    const { value, max } = this.settings$$();
    return value > max ? value : max;
  });

  protected readonly rightLabelText$$ = computed(() => this.formatValue(this.rightLabel$$()));

  protected readonly rightLabelIsPrimary$$ = computed(() => this.rightLabel$$() === this.settings$$().max);

  protected readonly middleLabel$$ = computed(() => {
    const { value, min, max } = this.settings$$();
    if (value < min) return min;
    if (value > max) return max;
    return null;
  });

  protected readonly middleLabelText$$ = computed(() => {
    const middle = this.middleLabel$$();
    return middle !== null ? this.formatValue(middle) : null;
  });

  protected readonly currentValueText$$ = computed(() => this.formatValue(this.settings$$().value));

  protected readonly shouldShowCurrentValue$$ = computed(() => {
    const value = this.settings$$().value;
    return value !== this.leftLabel$$() && value !== this.rightLabel$$();
  });

  protected readonly percentage$$ = computed(() => {
    const percentage = this.calculatePercentage(this.settings$$().value);
    return percentage < 3 && percentage > 0 ? '3%' : `${percentage}%`;
  });

  protected readonly valuePosition$$ = computed(() => {
    return this.calculateClampedPosition(this.settings$$().value);
  });

  protected readonly middlePosition$$ = computed(() => {
    const middle = this.middleLabel$$();
    return middle !== null ? this.calculateClampedPosition(middle) : null;
  });

  private formatValue(value: number): string {
    return `${value}${this.settings$$().valueSuffix}`;
  }

  private calculatePercentage(value: number): number {
    const min = this.scaleMin$$();
    const range = this.scaleRange$$();
    if (range === 0) return 0;
    return ((value - min) / range) * 100;
  }

  private calculateClampedPosition(value: number): string {
    const percentage = this.calculatePercentage(value);
    const clampedPercentage = Math.max(10, Math.min(percentage, 90));
    return `${clampedPercentage}%`;
  }
}
