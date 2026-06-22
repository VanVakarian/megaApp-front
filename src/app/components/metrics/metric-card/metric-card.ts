import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { VCard } from '@ui-kit/components/v-card/v-card';

@Component({
  selector: 'metric-card',
  templateUrl: './metric-card.html',
  imports: [VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCard {
  public readonly labelInput = input.required<string>();
  public readonly valueInput = input<string>('');
  public readonly dotClassInput = input<string | null>(null);
}
