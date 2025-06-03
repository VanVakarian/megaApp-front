import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MoneyService } from '../../../services/money.service';
import { Currency } from '../../../shared/interfaces';
import { CurrencyForm } from './currency-form/currency-form';

@Component({
  selector: 'currency-list',
  templateUrl: './currency-list.html',
  standalone: true,
  imports: [CommonModule, CurrencyForm],
})
export class CurrencyList implements OnInit {
  protected currencies: Currency[] = [];
  protected showForm = false;
  protected editingCurrency: Currency | null = null;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.loadCurrencies();
  }

  private loadCurrencies(): void {
    this.moneyService.getCurrencies().subscribe((currencies) => {
      this.currencies = currencies;
    });
  }

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
    this.loadCurrencies();
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingCurrency = null;
  }

  protected deleteCurrency(id: number): void {
    this.moneyService.deleteCurrency(id).subscribe((success) => {
      if (success) {
        this.loadCurrencies();
      }
    });
  }
}
