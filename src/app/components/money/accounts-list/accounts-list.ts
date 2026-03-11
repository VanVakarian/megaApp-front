import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { FormModal } from '@app/shared/components/form-modal/form-modal';
import { Account, AccountKind } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ICON_BUTTON } from '../money.const';
import { AccountForm } from './account-form/account-form';

@Component({
  selector: 'accounts-list',
  templateUrl: './accounts-list.html',
  imports: [AccountForm, DefaultModal, FormModal, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsList {
  protected readonly Icon = IconName;
  protected readonly iconButton = ICON_BUTTON;

  private readonly moneyService = inject(MoneyService);

  protected readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  protected readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  protected readonly organizations$$ = computed(() => this.moneyService.organizations$$());
  private readonly assets$$ = computed(() => this.moneyService.assets$$());
  private readonly transactions$$ = computed(() => this.moneyService.transactions$$());

  protected readonly showForm$$ = signal(false);
  protected readonly editingAccount$$ = signal<Account | null>(null);
  protected readonly isDeleteConfirmOpen$$ = signal(false);

  private readonly pendingDeleteId$$ = signal<number | null>(null);

  protected showCreateForm(): void {
    this.editingAccount$$.set(null);
    this.showForm$$.set(true);
  }

  protected editAccount(account: Account): void {
    this.editingAccount$$.set(account);
    this.showForm$$.set(true);
  }

  protected deleteAccount(id: number): void {
    if (!this.canDeleteAccount(id)) return;
    this.openConfirmationModal(id);
  }

  private openConfirmationModal(id: number): void {
    this.pendingDeleteId$$.set(id);
    this.isDeleteConfirmOpen$$.set(true);
  }

  protected closeConfirmationModal(): void {
    this.isDeleteConfirmOpen$$.set(false);
    this.pendingDeleteId$$.set(null);
  }

  protected onDeleteConfirmed(): void {
    const id = this.pendingDeleteId$$();
    this.isDeleteConfirmOpen$$.set(false);
    this.pendingDeleteId$$.set(null);
    if (!id) return;
    if (!this.canDeleteAccount(id)) return;
    this.moneyService.deleteAccount(id).subscribe((success) => {});
  }

  protected onSaved(): void {
    this.showForm$$.set(false);
    this.editingAccount$$.set(null);
  }

  protected onCancelled(): void {
    this.showForm$$.set(false);
    this.editingAccount$$.set(null);
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

  protected canDeleteAccount(accountId: number): boolean {
    const hasTransactions = this.transactions$$().some((transaction) => transaction.accountId === accountId);
    if (hasTransactions) return false;

    const hasAssets = this.assets$$().some((asset) => asset.accountIds.includes(accountId));
    return !hasAssets;
  }
}
