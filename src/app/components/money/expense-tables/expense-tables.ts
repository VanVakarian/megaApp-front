import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ExpenseTablesData } from '@app/shared/types';

@Component({
  selector: 'expense-tables',
  templateUrl: './expense-tables.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseTables {
  readonly dataInput = input.required<ExpenseTablesData>();

  protected readonly categories$$ = computed(() => this.dataInput().categories);
  protected readonly yearRows$$ = computed(() => this.dataInput().yearRows);
  protected readonly monthRows$$ = computed(() => this.dataInput().monthRows);

  protected getCategoryAmount(categoryAmounts: Record<number, number>, categoryId: number): number {
    return categoryAmounts[categoryId] ?? 0;
  }

  protected formatAmountRub(amount: number): string {
    if (amount === 0) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount) + ' ₽';
  }
}
