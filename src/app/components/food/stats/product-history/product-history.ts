import { Component, ElementRef, effect, inject, OnDestroy, viewChild } from '@angular/core';
import { StatsHelpIcon } from '@app/components/food/stats/stats-help-icon/stats-help-icon';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodProductHistoryStateService } from '@app/services/food/food-product-history-state.service';
import { FoodScreenMobileTab, FoodScreenModeService } from '@app/services/food/food-screen-mode.service';
import { formatDateTicks } from '@app/shared/utils';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VChip } from '@ui-kit/components/v-chip/v-chip';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';

// State (tracked products, loaded entries, pagination cursor) lives in FoodScreen-scoped
// FoodProductHistoryStateService, not here — this component is remounted on every layout-form
// change (mobile diary↔stats toggle, stats 2↔3 column boundary, see plan 31), and a component-local
// signal would be wiped on each remount.
@Component({
  selector: 'food-stats-product-history',
  templateUrl: './product-history.html',
  styleUrl: './product-history.scss',
  imports: [VCard, VButton, VIcon, VChip, StatsHelpIcon],
})
export class ProductHistory implements OnDestroy {
  private readonly sentinelElem = viewChild<ElementRef<HTMLElement>>('sentinel');

  protected readonly Icon = IconName;

  protected readonly state = inject(FoodProductHistoryStateService);
  protected readonly trackedProducts$$ = this.state.trackedProducts$$;
  protected readonly entries$$ = this.state.entries$$;
  protected readonly isLoading$$ = this.state.isLoading$$;
  protected readonly isLoadingMore$$ = this.state.isLoadingMore$$;
  protected readonly error$$ = this.state.error$$;
  protected readonly productNameById$$ = this.state.productNameById$$;

  private readonly foodDiaryService = inject(FoodDiaryService);
  private readonly foodScreenModeService = inject(FoodScreenModeService);
  private readonly foodAddModalService = inject(FoodAddModalService);

  private observer: IntersectionObserver | null = null;

  private readonly sentinelObserverEffect$$ = effect(() => {
    const el = this.sentinelElem()?.nativeElement;
    this.observer?.disconnect();
    this.observer = null;
    if (!el) return;

    this.observer = new IntersectionObserver((observedEntries) => {
      if (observedEntries[0]?.isIntersecting) this.state.loadMore();
    });
    this.observer.observe(el);
  });

  public ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected openPicker(): void {
    this.foodAddModalService.openForProductSelection((product) => this.state.addProduct(product));
  }

  protected goToDate(dateIso: string): void {
    this.foodDiaryService.selectedDayIso$$.set(dateIso);
    if (this.foodScreenModeService.isSingleColumnLayout$$()) {
      this.foodScreenModeService.mobileTab$$.set(FoodScreenMobileTab.Diary);
    }
  }

  protected formatDate(dateIso: string): string {
    return formatDateTicks(dateIso);
  }
}
