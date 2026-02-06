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

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
  imports: [FormsModule, VButton, VCard, VDropdown, VIcon, VInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionForm {
  protected readonly Icon = IconName;
  private readonly dateInputElem = viewChild<ElementRef<HTMLInputElement>>('dateInputElem');

  public readonly dateIsoInput = input<string | null>(null);
  public readonly transactionInput = input<Transaction | null>(null);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  protected readonly dateISO$$ = signal('');
  protected readonly accountId$$ = signal<string | null>(null);
  protected readonly amount$$ = signal('');
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

    const parsedAmount = this.parseAmount();
    if (parsedAmount === null) return;
    const normalizedAmount = this.normalizeAmount(parsedAmount);
    if (normalizedAmount === null) return;

    const transactionData: Transaction = {
      dateISO: this.dateISO$$(),
      accountId: Number(this.accountId$$()),
      amount: normalizedAmount,
      kind: this.kind$$(),
      isGift: false,
      notes: this.notes$$() || undefined,
      categoryId: this.categoryId$$() ? Number(this.categoryId$$()) : null,
    };

    const currentTransaction = this.transactionInput();
    if (currentTransaction?.id) {
      // Edit mode
      transactionData.id = currentTransaction.id;
      this.moneyService.updateTransaction(transactionData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    } else {
      // Create mode
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
    const amount = this.parseAmount();
    const normalizedAmount = amount === null ? null : this.normalizeAmount(amount);
    return Boolean(this.dateISO$$() && this.accountId$$() && normalizedAmount && normalizedAmount > 0 && this.kind$$());
  }

  protected accountItems(): DropdownItem[] {
    return this.getAccounts().map((account) => ({
      value: String(account.id),
      label: account.title,
    }));
  }

  protected kindItems(): DropdownItem[] {
    return this.getKindValues().map((kind) => ({
      value: kind,
      label: this.getKindDisplayName(kind),
    }));
  }

  private getKindValues(): TransactionKind[] {
    return Object.values(TransactionKind);
  }

  protected onKindChange(): void {
    this.categoryId$$.set(null);
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
      default:
        return kind;
    }
  }

  private getAccounts(): Account[] {
    return this.moneyService.accounts$$();
  }

  private getSelectedCurrency(): Currency | null {
    if (!this.accountId$$()) return null;
    const accountId = Number(this.accountId$$());
    if (!Number.isFinite(accountId)) return null;
    const account = this.moneyService.accounts$$().find((item) => item.id === accountId);
    if (!account) return null;
    return this.moneyService.currencies$$().find((item) => item.id === account.currencyId) ?? null;
  }

  protected getCurrencyPrefix(): string | null {
    const currency = this.getSelectedCurrency();
    if (!currency?.symbol) return null;
    if (currency.symbolPosEnum !== SymbolPosition.BEFORE) return null;
    const whitespace = currency.whitespace ? ' ' : '';
    return `${currency.symbol}${whitespace}`;
  }

  protected getCurrencyPostfix(): string | null {
    const currency = this.getSelectedCurrency();
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
  }

  private prepFormWithDate(dateInput: string): void {
    this.dateISO$$.set(dateInput);
    this.accountId$$.set(null);
    this.amount$$.set('');
    this.kind$$.set(TransactionKind.EXPENSE);
    this.notes$$.set('');
    this.categoryId$$.set(null);
  }

  private parseAmount(): number | null {
    if (!this.amount$$()) return null;
    if (this.amount$$() === '-' || this.amount$$() === '+') return null;
    const parsed = Number(this.amount$$());
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
