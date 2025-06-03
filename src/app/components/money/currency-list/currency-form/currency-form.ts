import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '../../../../services/money.service';
import { Currency, SymbolPosition } from '../../../../shared/interfaces';

@Component({
  selector: 'currency-form',
  templateUrl: './currency-form.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class CurrencyForm implements OnInit {
  @Input()
  public currency: Currency | null = null;

  @Output()
  public readonly saved = new EventEmitter<void>();

  @Output()
  public readonly cancelled = new EventEmitter<void>();

  // Form fields
  protected title = '';
  protected ticker = '';
  protected symbol = '';
  protected symbolPosEnum: SymbolPosition = SymbolPosition.BEFORE;
  protected whitespace = false;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    if (this.currency) {
      this.fillForm(this.currency);
    }
  }

  private fillForm(currency: Currency): void {
    this.title = currency.title;
    this.ticker = currency.ticker;
    this.symbol = currency.symbol;
    this.symbolPosEnum = currency.symbolPosEnum;
    this.whitespace = currency.whitespace;
  }

  protected save(): void {
    if (!this.title || !this.ticker || !this.symbol) return;

    const currencyData: Currency = {
      title: this.title,
      ticker: this.ticker,
      symbol: this.symbol,
      symbolPosEnum: this.symbolPosEnum,
      whitespace: this.whitespace,
    };

    if (this.currency?.id) {
      // Update existing
      currencyData.id = this.currency.id;
      this.moneyService.updateCurrency(currencyData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    } else {
      // Create new
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
    return !!this.currency?.id;
  }
}
