import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { FoodStatsBlock, getFoodStatsBlockOrder } from '@app/components/food/stats/food-stats-block';
import { FoodStatsCharts } from '@app/components/food/stats/food-stats-charts/food-stats-charts';
import { Milestones } from '@app/components/food/stats/milestones/milestones';
import { Streak } from '@app/components/food/stats/streak/streak';
import { TopProducts } from '@app/components/food/stats/top-products/top-products';
import { LocalStorageService } from '@app/services/local-storage.service';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';

interface BlockToggle {
  block: FoodStatsBlock;
  icon: IconName;
}

const BLOCK_ICONS: Record<FoodStatsBlock, IconName> = {
  [FoodStatsBlock.Streak]: IconName.LocalFireDepartment,
  [FoodStatsBlock.Milestones]: IconName.Verified,
  [FoodStatsBlock.Charts]: IconName.BarChart,
  [FoodStatsBlock.TopProducts]: IconName.ForkChart,
};

// Accordion always renders as a single stacked column.
const BLOCK_TOGGLES: BlockToggle[] = getFoodStatsBlockOrder().map((block) => ({ block, icon: BLOCK_ICONS[block] }));

const OPEN_BLOCKS_STORAGE_KEY = 'food_stats_accordion_open_blocks';

@Component({
  selector: 'food-stats-accordion',
  templateUrl: './food-stats-accordion.html',
  imports: [VButton, VIcon, Streak, TopProducts, Milestones, FoodStatsCharts],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodStatsAccordion {
  protected readonly Block = FoodStatsBlock;
  protected readonly toggles: BlockToggle[] = BLOCK_TOGGLES;

  private readonly localStorageService = inject(LocalStorageService);

  private readonly openBlocks$$: WritableSignal<ReadonlySet<FoodStatsBlock>> = signal(this.loadOpenBlocks());

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
    this.localStorageService.setUserScoped(OPEN_BLOCKS_STORAGE_KEY, [...this.openBlocks$$()]);
  }

  private loadOpenBlocks(): ReadonlySet<FoodStatsBlock> {
    const stored = this.localStorageService.getUserScoped<FoodStatsBlock[]>(OPEN_BLOCKS_STORAGE_KEY);
    return new Set(stored ?? getFoodStatsBlockOrder());
  }
}
