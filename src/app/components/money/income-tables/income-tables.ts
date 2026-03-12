import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IncomeChartData } from '@app/shared/types';

@Component({
  selector: 'income-tables',
  templateUrl: './income-tables.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeTables {
  readonly dataInput = input.required<IncomeChartData>();

  protected readonly dividendRows$$ = computed(() => this.dataInput().dividendRows);

  protected readonly closedLotRows$$ = computed(() =>
    this.dataInput().positionLotRows.filter((r) => r.status === 'closed'),
  );

  protected readonly openLotRows$$ = computed(() =>
    this.dataInput().positionLotRows.filter((r) => r.status === 'open'),
  );

  protected formatAmountRub(amount: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount) + ' ₽';
  }

  protected formatQty(qty: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(qty);
  }

  protected formatPeriod(openMonths: string[]): string {
    if (!openMonths.length) return '—';
    const first = openMonths[0];
    const last = openMonths[openMonths.length - 1];
    const count = openMonths.length;
    if (first === last) return `${first} (1 mo)`;
    return `${first} → ${last} (${count} mo)`;
  }

  protected pnlPerMonth(pnlRub: number | null, openMonths: string[]): number | null {
    if (pnlRub === null || !openMonths.length) return null;
    return pnlRub / openMonths.length;
  }
}
