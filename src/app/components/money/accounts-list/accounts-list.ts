import { Component, computed } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { Account, AccountKind } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { AccountForm } from './account-form/account-form';

@Component({
  selector: 'accounts-list',
  templateUrl: './accounts-list.html',
  standalone: true,
  imports: [AccountForm, DefaultModal, VButton, VCard],
})
export class AccountsList {
  protected accounts$$ = computed(() => this.moneyService.accounts$$());
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected showForm = false;
  protected editingAccount: Account | null = null;
  protected isDeleteConfirmOpen = false;
  protected pendingDeleteId: number | null = null;

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
    this.openConfirmationModal(id);
  }

  protected openConfirmationModal(id: number): void {
    this.pendingDeleteId = id;
    this.isDeleteConfirmOpen = true;
  }

  protected closeConfirmationModal(): void {
    this.isDeleteConfirmOpen = false;
    this.pendingDeleteId = null;
  }

  protected onDeleteConfirmed(): void {
    const id = this.pendingDeleteId;
    this.isDeleteConfirmOpen = false;
    this.pendingDeleteId = null;
    if (!id) return;
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

  protected getCurrencySymbol(currencyId: number): string {
    const currency = this.currencies$$().find((c) => c.id === currencyId);
    return currency ? currency.symbol : '';
  }
}
