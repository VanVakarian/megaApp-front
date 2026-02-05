import { Component, computed } from '@angular/core';
import { MoneyService } from '../../../services/money.service';
import { Currency } from '../../../shared/types';
import { CurrencyForm } from './currency-form/currency-form';

@Component({
  selector: 'currencies-list',
  templateUrl: './currencies-list.html',
  standalone: true,
  imports: [CurrencyForm],
})
export class CurrenciesList {
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected showForm = false;
  protected editingCurrency: Currency | null = null;

  constructor(private moneyService: MoneyService) {}

  protected showCreateForm(): void {
    this.editingCurrency = null;
    this.showForm = true;
  }

  protected editCurrency(currency: Currency): void {
    this.editingCurrency = currency;
    this.showForm = true;
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingCurrency = null;
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingCurrency = null;
  }

  protected deleteCurrency(id: number): void {
    this.moneyService.deleteCurrency(id).subscribe((success) => {});
  }
}
