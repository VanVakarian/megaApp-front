import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import {
  Account,
  Category,
  CategoryType,
  Currency,
  SymbolPosition,
  Transaction,
  TransactionKind,
} from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VToggle } from '@ui-kit/components/v-toggle/v-toggle';

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
  imports: [FormsModule, VButton, VCard, VDropdown, VIcon, VInput, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionForm {
  protected readonly Icon = IconName;
  protected readonly TransactionKind = TransactionKind;
  private readonly dateInputElem = viewChild<ElementRef<HTMLInputElement>>('dateInputElem');

  public readonly dateIsoInput = input<string | null>(null);
  public readonly transactionInput = input<Transaction | null>(null);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  protected readonly dateISO$$ = signal('');
  protected readonly accountId$$ = signal<string | null>(null);
  protected readonly accountToId$$ = signal<string | null>(null);
  protected readonly amount$$ = signal('');
  protected readonly amountTo$$ = signal('');
  protected readonly kind$$ = signal<TransactionKind>(TransactionKind.EXPENSE);
  protected readonly notes$$ = signal('');
  protected readonly categoryId$$ = signal<string | null>(null);

  constructor(private moneyService: MoneyService) {
    effect(() => {
      const date = this.dateIsoInput();
      const transaction = this.transactionInput();

      if (transaction) {
        this.prepFormWithTransaction(transaction);
      } else if (date) {
        this.prepFormWithDate(date);
      }
    });
  }

  protected save(): void {
    if (!this.isFormValid()) return;

    if (this.kind$$() === TransactionKind.TRANSFER) {
      const parsedFromAmount = this.parseAmount(this.amount$$());
      const parsedToAmount = this.parseAmount(this.amountTo$$());
      if (parsedFromAmount === null || parsedToAmount === null) return;

      const normalizedFromAmount = this.normalizeAmount(parsedFromAmount);
      const normalizedToAmount = this.normalizeAmount(parsedToAmount);
      if (normalizedFromAmount === null || normalizedToAmount === null) return;

      const currentTransaction = this.transactionInput();
      const currentTwinId = currentTransaction?.twinId;

      if (currentTransaction?.id && currentTwinId) {
        this.moneyService
          .updateTransfer({
            id: currentTransaction.id,
            twinId: currentTwinId,
            dateISO: this.dateISO$$(),
            accountId: Number(this.accountId$$()),
            amount: normalizedFromAmount,
            twinAccountId: Number(this.accountToId$$()),
            twinAmount: normalizedToAmount,
            notes: this.notes$$() || undefined,
          })
          .subscribe((success) => {
            if (success) {
              this.savedOutput.emit();
            }
          });
      } else {
        this.moneyService
          .createTransfer({
            dateISO: this.dateISO$$(),
            accountId: Number(this.accountId$$()),
            amount: normalizedFromAmount,
            twinAccountId: Number(this.accountToId$$()),
            twinAmount: normalizedToAmount,
            notes: this.notes$$() || undefined,
          })
          .subscribe((success) => {
            if (success) {
              this.savedOutput.emit();
            }
          });
      }

      return;
    }

    const parsedAmount = this.parseAmount(this.amount$$());
    if (parsedAmount === null) return;
    const normalizedAmount = this.normalizeAmount(parsedAmount);
    if (normalizedAmount === null) return;

    const currentTransaction = this.transactionInput();
    const accountId = currentTransaction?.accountId ?? Number(this.accountId$$());
    const kind = currentTransaction?.kind ?? this.kind$$();

    const transactionData: Transaction = {
      dateISO: this.dateISO$$(),
      accountId,
      amount: normalizedAmount,
      kind,
      isGift: false,
      notes: this.notes$$() || undefined,
      categoryId: this.categoryId$$() ? Number(this.categoryId$$()) : null,
    };

    if (currentTransaction?.id) {
      transactionData.id = currentTransaction.id;
      this.moneyService.updateTransaction(transactionData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    } else {
      this.moneyService.createTransaction(transactionData).subscribe((success) => {
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
    return Boolean(this.transactionInput()?.id);
  }

  protected isFormValid(): boolean {
    if (this.kind$$() === TransactionKind.TRANSFER) {
      const amountFrom = this.parseAmount(this.amount$$());
      const amountTo = this.parseAmount(this.amountTo$$());
      const normalizedFrom = amountFrom === null ? null : this.normalizeAmount(amountFrom);
      const normalizedTo = amountTo === null ? null : this.normalizeAmount(amountTo);

      return Boolean(
        this.dateISO$$() &&
          this.accountId$$() &&
          this.accountToId$$() &&
          this.accountId$$() !== this.accountToId$$() &&
          normalizedFrom &&
          normalizedFrom > 0 &&
          normalizedTo &&
          normalizedTo > 0,
      );
    }

    const amount = this.parseAmount(this.amount$$());
    const normalizedAmount = amount === null ? null : this.normalizeAmount(amount);
    return Boolean(this.dateISO$$() && this.accountId$$() && normalizedAmount && normalizedAmount > 0 && this.kind$$());
  }

  protected accountItems(): DropdownItem[] {
    return this.getAccounts().map((account) => ({
      value: String(account.id),
      label: account.title,
    }));
  }

  protected onKindToggleChange(value: string[]): void {
    const nextKind = value[0] as TransactionKind | undefined;
    this.kind$$.set(nextKind ?? TransactionKind.EXPENSE);
    this.categoryId$$.set(null);
    if (this.kind$$() !== TransactionKind.TRANSFER) {
      this.accountToId$$.set(null);
      this.amountTo$$.set('');
    }
  }

  protected onDateControlClick(): void {
    this.openNativeDatePicker(this.dateInputElem()?.nativeElement);
  }

  protected onDatePicked(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const dateIso = input?.value;
    if (!dateIso) return;
    this.dateISO$$.set(dateIso);
  }

  private getKindDisplayName(kind: TransactionKind): string {
    switch (kind) {
      case TransactionKind.INCOME:
        return 'Income';
      case TransactionKind.EXPENSE:
        return 'Expense';
      case TransactionKind.TRANSFER:
        return 'Transfer';
      default:
        return kind;
    }
  }

  protected kindToggleItems(): { id: string; label: string }[] {
    return [
      { id: TransactionKind.EXPENSE, label: 'Expense' },
      { id: TransactionKind.INCOME, label: 'Income' },
      { id: TransactionKind.TRANSFER, label: 'Transfer' },
    ];
  }

  protected kindToggleValue(): string[] {
    return [this.kind$$()];
  }

  private getAccounts(): Account[] {
    return this.moneyService.accounts$$();
  }

  private getSelectedCurrency(accountIdValue: string | null): Currency | null {
    if (!accountIdValue) return null;
    const accountId = Number(accountIdValue);
    if (!Number.isFinite(accountId)) return null;
    const account = this.moneyService.accounts$$().find((item) => item.id === accountId);
    if (!account) return null;
    return this.moneyService.currencies$$().find((item) => item.id === account.currencyId) ?? null;
  }

  protected getCurrencyPrefix(): string | null {
    const currency = this.getSelectedCurrency(this.accountId$$());
    if (!currency?.symbol) return null;
    if (currency.symbolPosEnum !== SymbolPosition.BEFORE) return null;
    const whitespace = currency.whitespace ? ' ' : '';
    return `${currency.symbol}${whitespace}`;
  }

  protected getCurrencyPostfix(): string | null {
    const currency = this.getSelectedCurrency(this.accountId$$());
    if (!currency?.symbol) return null;
    if (currency.symbolPosEnum !== SymbolPosition.AFTER) return null;
    const whitespace = currency.whitespace ? ' ' : '';
    return `${whitespace}${currency.symbol}`;
  }

  protected getCurrencyPrefixForAccount(accountIdValue: string | null): string | null {
    const currency = this.getSelectedCurrency(accountIdValue);
    if (!currency?.symbol) return null;
    if (currency.symbolPosEnum !== SymbolPosition.BEFORE) return null;
    const whitespace = currency.whitespace ? ' ' : '';
    return `${currency.symbol}${whitespace}`;
  }

  protected getCurrencyPostfixForAccount(accountIdValue: string | null): string | null {
    const currency = this.getSelectedCurrency(accountIdValue);
    if (!currency?.symbol) return null;
    if (currency.symbolPosEnum !== SymbolPosition.AFTER) return null;
    const whitespace = currency.whitespace ? ' ' : '';
    return `${whitespace}${currency.symbol}`;
  }

  private getTransactionCategories(): Category[] {
    const categoryType = this.kind$$() === TransactionKind.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    const categories = this.moneyService.categories$$().filter((category) => category.categoryType === categoryType);
    const parentsWithChildren = new Set<number>();

    categories.forEach((category) => {
      if (category.parentId) {
        parentsWithChildren.add(category.parentId);
      }
    });

    return categories.filter((category) => !parentsWithChildren.has(category.id!));
  }

  protected categoryItems(): DropdownItem[] {
    return [
      { value: '', label: 'No category' },
      ...this.getTransactionCategories().map((category) => ({
        value: String(category.id),
        label: this.getCategoryLabel(category),
      })),
    ];
  }

  private getCategoryLabel(category: Category): string {
    if (!category.parentId) return category.name;

    const parentCategory = this.moneyService.categories$$().find((parent) => parent.id === category.parentId);
    if (!parentCategory) return category.name;

    return `${parentCategory.name} / ${category.name}`;
  }

  private prepFormWithTransaction(transaction: Transaction): void {
    this.dateISO$$.set(transaction.dateISO);
    this.accountId$$.set(String(transaction.accountId));
    this.amount$$.set(String(transaction.amount));
    this.kind$$.set(transaction.kind);
    this.notes$$.set(transaction.notes || '');
    this.categoryId$$.set(transaction.categoryId ? String(transaction.categoryId) : null);

    if (transaction.kind === TransactionKind.TRANSFER) {
      const twin = this.getTwinTransaction(transaction);
      this.accountToId$$.set(twin?.accountId ? String(twin.accountId) : null);
      this.amountTo$$.set(twin?.amount ? String(twin.amount) : '');
      this.categoryId$$.set(null);
    } else {
      this.accountToId$$.set(null);
      this.amountTo$$.set('');
    }
  }

  private prepFormWithDate(dateInput: string): void {
    this.dateISO$$.set(dateInput);
    this.accountId$$.set(null);
    this.accountToId$$.set(null);
    this.amount$$.set('');
    this.amountTo$$.set('');
    this.kind$$.set(TransactionKind.EXPENSE);
    this.notes$$.set('');
    this.categoryId$$.set(null);
  }

  private getTwinTransaction(transaction: Transaction): Transaction | null {
    if (!transaction.twinId) return null;
    return this.moneyService.transactions$$().find((item) => item.id === transaction.twinId) ?? null;
  }

  private parseAmount(value: string): number | null {
    if (!value) return null;
    if (value === '-' || value === '+') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeAmount(amount: number): number | null {
    if (!Number.isFinite(amount)) return null;
    return Math.abs(amount);
  }

  private openNativeDatePicker(input: HTMLInputElement | null | undefined): void {
    if (!input) return;

    const inputWithPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof inputWithPicker.showPicker === 'function') {
      inputWithPicker.showPicker();
      return;
    }

    input.focus();
    input.click();
  }
}
