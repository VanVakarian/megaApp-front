import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Account, AccountKind, Category, Currency, UsedFor } from '@app/shared/interfaces';
import { AccountsForm } from './accounts-form/accounts-form';

@Component({
  selector: 'accounts-list',
  templateUrl: './accounts-list.html',
  standalone: true,
  imports: [CommonModule, AccountsForm],
})
export class AccountsList implements OnInit {
  protected accounts: Account[] = [];
  protected currencies: Currency[] = [];
  protected categories: Category[] = [];
  protected showForm = false;
  protected editingAccount: Account | null = null;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.loadData();
  }

  protected showCreateForm(): void {
    this.editingAccount = null;
    this.showForm = true;
  }

  protected editAccount(account: Account): void {
    this.editingAccount = account;
    this.showForm = true;
  }

  protected deleteAccount(id: number): void {
    this.moneyService.deleteAccount(id).subscribe((success) => {
      if (success) {
        this.loadAccounts();
      }
    });
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingAccount = null;
    this.loadAccounts();
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingAccount = null;
  }

  protected getKindDisplayName(kind: AccountKind): string {
    switch (kind) {
      case AccountKind.CASH:
        return 'Cash';
      case AccountKind.CARD:
        return 'Card';
      case AccountKind.CHECKING:
        return 'Checking';
      case AccountKind.DEPOSIT:
        return 'Deposit';
      case AccountKind.BROKERAGE:
        return 'Brokerage';
      case AccountKind.CRYPTO:
        return 'Crypto';
      default:
        return kind;
    }
  }

  protected getCurrencyTitle(currencyId: number): string {
    const currency = this.currencies.find((c) => c.id === currencyId);
    return currency ? currency.title : 'Unknown Currency';
  }

  protected getCategoryName(categoryId: number): string {
    const category = this.categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  }

  protected getAccountCategories(): Category[] {
    return this.categories.filter((category) => category.usedFor === UsedFor.ACCOUNT);
  }

  private loadData(): void {
    this.loadAccounts();
    this.loadCurrencies();
    this.loadCategories();
  }

  private loadAccounts(): void {
    this.moneyService.getAccounts().subscribe((accounts) => {
      this.accounts = accounts;
    });
  }

  private loadCurrencies(): void {
    this.moneyService.getCurrencies().subscribe((currencies) => {
      this.currencies = currencies;
    });
  }

  private loadCategories(): void {
    this.moneyService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }
}
