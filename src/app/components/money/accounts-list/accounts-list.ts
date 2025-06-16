import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Account, AccountKind, Category, UsedFor } from '@app/shared/interfaces';
import { AccountsForm } from './accounts-form/accounts-form';

@Component({
  selector: 'accounts-list',
  templateUrl: './accounts-list.html',
  standalone: true,
  imports: [CommonModule, AccountsForm],
})
export class AccountsList {
  protected accounts$$ = computed(() => this.moneyService.accounts$$());
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected categories$$ = computed(() => this.moneyService.categories$$());
  protected showForm = false;
  protected editingAccount: Account | null = null;

  constructor(private moneyService: MoneyService) {}

  protected showCreateForm(): void {
    this.editingAccount = null;
    this.showForm = true;
  }

  protected editAccount(account: Account): void {
    this.editingAccount = account;
    this.showForm = true;
  }

  protected deleteAccount(id: number): void {
    this.moneyService.deleteAccount(id).subscribe((success) => {});
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingAccount = null;
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
    const currency = this.currencies$$().find((c) => c.id === currencyId);
    return currency ? currency.title : 'Unknown Currency';
  }

  protected getCategoryName(categoryId: number): string {
    const category = this.categories$$().find((c) => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  }

  protected getAccountCategories(): Category[] {
    return this.categories$$().filter((category) => category.usedFor === UsedFor.ACCOUNT);
  }
}
