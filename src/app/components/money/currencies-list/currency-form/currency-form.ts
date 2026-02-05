import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '../../../../services/money.service';
import { Currency, SymbolPosition } from '../../../../shared/types';

@Component({
  selector: 'currency-form',
  templateUrl: './currency-form.html',
  standalone: true,
  imports: [FormsModule],
})
export class CurrencyForm implements OnInit {
  public readonly currency = input<Currency | null>(null);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  // Form fields
  protected title = '';
  protected ticker = '';
  protected symbol = '';
  protected symbolPosEnum: SymbolPosition = SymbolPosition.BEFORE;
  protected whitespace = false;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    const currentCurrency = this.currency();
    if (currentCurrency) {
      this.fillForm(currentCurrency);
    }
  }

  private fillForm(currency: Currency): void {
    this.title = currency.title;
    this.ticker = currency.ticker;
    this.symbol = currency.symbol;
    this.symbolPosEnum = currency.symbolPosEnum;
    this.whitespace = Boolean(currency.whitespace);
  }

  protected save(): void {
    if (!this.title || !this.ticker || !this.symbol) return;

    const currencyData: Currency = {
      title: this.title,
      ticker: this.ticker,
      symbol: this.symbol,
      symbolPosEnum: this.symbolPosEnum,
      whitespace: Boolean(this.whitespace),
    };

    const currentCurrency = this.currency();
    if (currentCurrency?.id) {
      currencyData.id = currentCurrency.id;
      this.moneyService.updateCurrency(currencyData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    } else {
      this.moneyService.createCurrency(currencyData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.currency()?.id);
  }
}
