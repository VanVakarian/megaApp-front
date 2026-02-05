import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Account, AccountKind, Currency } from '@app/shared/types';

@Component({
  selector: 'account-form',
  templateUrl: './account-form.html',
  standalone: true,
  imports: [FormsModule],
})
export class AccountForm implements OnInit {
  public readonly account = input<Account | null>(null);
  public readonly currencies = input<Currency[]>([]);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  protected title = '';
  protected currencyId: number | null = null;
  protected invest = false;
  protected kind: AccountKind | null = null;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    const currentAccount = this.account();
    if (currentAccount) {
      this.fillForm(currentAccount);
    }
  }

  protected save(): void {
    if (!this.isFormValid()) return;

    const accountData: Account = {
      title: this.title,
      currencyId: this.currencyId!,
      invest: this.invest,
      kind: this.kind!,
    };

    const currentAccount = this.account();
    if (currentAccount?.id) {
      accountData.id = currentAccount.id;
      this.moneyService.updateAccount(accountData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    } else {
      this.moneyService.createAccount(accountData).subscribe((success) => {
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
    return Boolean(this.account()?.id);
  }

  protected isFormValid(): boolean {
    return Boolean(this.title && this.currencyId && this.kind);
  }

  protected getKindValues(): AccountKind[] {
    return Object.values(AccountKind);
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

  private fillForm(account: Account): void {
    this.title = account.title;
    this.currencyId = account.currencyId;
    this.invest = account.invest;
    this.kind = account.kind;
  }
}
