import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MoneyService } from '../../../services/money.service';
import { Currency } from '../../../shared/interfaces';
import { CurrencyForm } from './currency-form/currency-form';

@Component({
  selector: 'currency-list',
  templateUrl: './currency-list.html',
  standalone: true,
  imports: [CommonModule, CurrencyForm],
})
export class CurrencyList {
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
