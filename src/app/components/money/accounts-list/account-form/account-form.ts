import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Account, AccountKind, Currency, Organization } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { VInput } from '@ui-kit/components/v-input/v-input';

@Component({
  selector: 'account-form',
  templateUrl: './account-form.html',
  imports: [FormsModule, VButton, VDropdown, VCheckbox, VInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountForm {
  public readonly accountInput = input<Account | null>(null);
  public readonly currenciesInput = input<Currency[]>([]);
  public readonly organizationsInput = input<Organization[]>([]);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  protected readonly title$$ = signal('');
  protected readonly currencyId$$ = signal<string | null>(null);
  protected readonly isInvest$$ = signal(false);
  protected readonly kind$$ = signal<AccountKind | ''>('');
  protected readonly organizationId$$ = signal<string | null>(null);

  constructor(private moneyService: MoneyService) {
    effect(() => {
      const currentAccount = this.accountInput();
      if (currentAccount) {
        this.fillForm(currentAccount);
      } else {
        this.resetForm();
      }
    });
  }

  protected save(): void {
    if (!this.isFormValid()) return;

    const accountData: Account = {
      title: this.title$$(),
      currencyId: Number(this.currencyId$$()),
      isInvest: this.isInvest$$(),
      kind: this.kind$$() as AccountKind,
      organizationId: this.organizationId$$() ? Number(this.organizationId$$()) : null,
    };

    const currentAccount = this.accountInput();
    if (currentAccount?.id) {
      accountData.id = currentAccount.id;
      this.moneyService.updateAccount(accountData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    } else {
      this.moneyService.createAccount(accountData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    }
  }

  protected cancel(): void {
    this.cancelledOutput.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.accountInput()?.id);
  }

  protected isFormValid(): boolean {
    return Boolean(this.title$$() && this.currencyId$$() && this.kind$$());
  }

  protected currencyItems(): DropdownItem[] {
    return this.currenciesInput().map((currency) => ({
      value: String(currency.id),
      label: `${currency.title} (${currency.ticker})`,
    }));
  }

  protected organizationItems(): DropdownItem[] {
    return [
      { value: '', label: 'None' },
      ...this.organizationsInput().map((org) => ({
        value: String(org.id),
        label: org.title,
      })),
    ];
  }

  protected kindItems(): DropdownItem[] {
    return this.getKindValues().map((kind) => ({
      value: kind,
      label: this.getKindDisplayName(kind),
    }));
  }

  private getKindValues(): AccountKind[] {
    return Object.values(AccountKind);
  }

  private getKindDisplayName(kind: AccountKind): string {
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

  private fillForm(account: Account): void {
    this.title$$.set(account.title);
    this.currencyId$$.set(String(account.currencyId));
    this.isInvest$$.set(account.isInvest);
    this.kind$$.set(account.kind);
    this.organizationId$$.set(account.organizationId ? String(account.organizationId) : null);
  }

  private resetForm(): void {
    this.title$$.set('');
    this.currencyId$$.set(null);
    this.isInvest$$.set(false);
    this.kind$$.set('');
    this.organizationId$$.set(null);
  }
}
