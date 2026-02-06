import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
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
})
export class TransactionForm {
  protected readonly Icon = IconName;
  protected readonly dateInputElem = viewChild<ElementRef<HTMLInputElement>>('dateInputElem');

  public readonly dateIsoInput = input<string | null>(null);
  public readonly transactionInput = input<Transaction | null>(null);

  public readonly onSaved = output<void>();
  public readonly onCancelled = output<void>();

  // Form fields
  protected dateISO = '';
  protected accountId: string | null = null;
  protected amount = '';
  protected kind: TransactionKind = TransactionKind.EXPENSE;
  protected notes = '';
  protected categoryId: string | null = null;

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
      dateISO: this.dateISO,
      accountId: Number(this.accountId),
      amount: normalizedAmount,
      kind: this.kind,
      isGift: false,
      notes: this.notes || undefined,
      categoryId: this.categoryId ? Number(this.categoryId) : null,
    };

    const currentTransaction = this.transactionInput();
    if (currentTransaction?.id) {
      // Edit mode
      transactionData.id = currentTransaction.id;
      this.moneyService.updateTransaction(transactionData).subscribe((success) => {
        if (success) {
          this.onSaved.emit();
        }
      });
    } else {
      // Create mode
      this.moneyService.createTransaction(transactionData).subscribe((success) => {
        if (success) {
          this.onSaved.emit();
        }
      });
    }
  }

  protected cancel(): void {
    this.onCancelled.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.transactionInput()?.id);
  }

  protected isFormValid(): boolean {
    const amount = this.parseAmount();
    const normalizedAmount = amount === null ? null : this.normalizeAmount(amount);
    return Boolean(this.dateISO && this.accountId && normalizedAmount && normalizedAmount > 0 && this.kind);
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

  protected getKindValues(): TransactionKind[] {
    return Object.values(TransactionKind);
  }

  protected onKindChange(): void {
    this.categoryId = null;
  }

  protected onDateControlClick(): void {
    this.openNativeDatePicker(this.dateInputElem()?.nativeElement);
  }

  protected onDatePicked(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const dateIso = input?.value;
    if (!dateIso) return;
    this.dateISO = dateIso;
  }

  protected getKindDisplayName(kind: TransactionKind): string {
    switch (kind) {
      case TransactionKind.INCOME:
        return 'Income';
      case TransactionKind.EXPENSE:
        return 'Expense';
      default:
        return kind;
    }
  }

  protected getAccounts(): Account[] {
    return this.moneyService.accounts$$();
  }

  protected getSelectedCurrency(): Currency | null {
    if (!this.accountId) return null;
    const accountId = Number(this.accountId);
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

  protected getTransactionCategories(): Category[] {
    const categoryType = this.kind === TransactionKind.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
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

  protected getCategoryLabel(category: Category): string {
    if (!category.parentId) return category.name;

    const parentCategory = this.moneyService.categories$$().find((parent) => parent.id === category.parentId);
    if (!parentCategory) return category.name;

    return `${parentCategory.name} / ${category.name}`;
  }

  private prepFormWithTransaction(transaction: Transaction): void {
    this.dateISO = transaction.dateISO;
    this.accountId = String(transaction.accountId);
    this.amount = String(transaction.amount);
    this.kind = transaction.kind;
    this.notes = transaction.notes || '';
    this.categoryId = transaction.categoryId ? String(transaction.categoryId) : null;
  }

  private prepFormWithDate(dateInput: string): void {
    this.dateISO = dateInput;
    this.accountId = null;
    this.amount = '';
    this.kind = TransactionKind.EXPENSE;
    this.notes = '';
    this.categoryId = null;
  }

  private parseAmount(): number | null {
    if (!this.amount) return null;
    if (this.amount === '-' || this.amount === '+') return null;
    const parsed = Number(this.amount);
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
