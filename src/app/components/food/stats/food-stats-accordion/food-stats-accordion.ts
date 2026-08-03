import { ChangeDetectionStrategy, Component, computed, Signal, signal, WritableSignal } from '@angular/core';
import { FoodStatsCharts } from '@app/components/food/stats/food-stats-charts/food-stats-charts';
import { HeatmapStrip } from '@app/components/food/stats/heatmap-strip/heatmap-strip';
import { Milestones } from '@app/components/food/stats/milestones/milestones';
import { Streak } from '@app/components/food/stats/streak/streak';
import { TopProducts } from '@app/components/food/stats/top-products/top-products';
import { VButton } from '@ui-kit/components/v-button/v-button';

const FoodStatsBlock = {
  Ribbon: 'ribbon',
  Streak: 'streak',
  TopProducts: 'topProducts',
  Milestones: 'milestones',
  Charts: 'charts',
} as const;

type FoodStatsBlock = (typeof FoodStatsBlock)[keyof typeof FoodStatsBlock];

interface BlockToggle {
  block: FoodStatsBlock;
  label: string;
}

// Fixed order shared with food-stats-columns: ribbon -> streak -> top products -> milestones -> charts.
const BLOCK_TOGGLES: BlockToggle[] = [
  { block: FoodStatsBlock.Ribbon, label: 'Лента' },
  { block: FoodStatsBlock.Streak, label: 'Серия' },
  { block: FoodStatsBlock.TopProducts, label: 'Топ продуктов' },
  { block: FoodStatsBlock.Milestones, label: 'Вехи' },
  { block: FoodStatsBlock.Charts, label: 'Графики' },
];

@Component({
  selector: 'food-stats-accordion',
  templateUrl: './food-stats-accordion.html',
  imports: [VButton, HeatmapStrip, Streak, TopProducts, Milestones, FoodStatsCharts],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodStatsAccordion {
  protected readonly Block = FoodStatsBlock;
  protected readonly toggles: BlockToggle[] = BLOCK_TOGGLES;

  private readonly openBlocks$$: WritableSignal<ReadonlySet<FoodStatsBlock>> = signal(new Set());

  protected readonly isAllOpen$$: Signal<boolean> = computed(() => this.openBlocks$$().size === this.toggles.length);

  protected isOpen(block: FoodStatsBlock): boolean {
    return this.openBlocks$$().has(block);
  }

  protected toggleBlock(block: FoodStatsBlock): void {
    this.openBlocks$$.update((current) => {
      const next = new Set(current);
      if (next.has(block)) next.delete(block);
      else next.add(block);
      return next;
    });
  }

  protected toggleAll(): void {
    this.openBlocks$$.set(this.isAllOpen$$() ? new Set() : new Set(this.toggles.map((toggle) => toggle.block)));
  }
}
