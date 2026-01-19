import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Account, Category, Transaction, TransactionKind, UsedFor } from '@app/shared/interfaces';

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.html',
  standalone: true,
  imports: [FormsModule],
})
export class TransactionForm {
  public readonly dateIsoInput = input<string | null>(null);
  public readonly transactionInput = input<Transaction | null>(null);

  public readonly onSaved = output<void>();
  public readonly onCancelled = output<void>();

  // Form fields
  protected dateISO = '';
  protected accountId: number | null = null;
  protected amount: number | null = null;
  protected kind: TransactionKind = TransactionKind.EXPENSE;
  protected isGift = false;
  protected notes = '';
  protected selectedCategoryIds: number[] = [];

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

    const transactionData: Transaction = {
      dateISO: this.dateISO,
      accountId: Number(this.accountId),
      amount: this.amount!,
      kind: this.kind,
      isGift: this.isGift,
      notes: this.notes || undefined,
      categoryIds: this.selectedCategoryIds,
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
    return Boolean(this.dateISO && this.accountId && this.amount && this.amount > 0 && this.kind);
  }

  protected getKindValues(): TransactionKind[] {
    return Object.values(TransactionKind);
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

  protected getTransactionCategories(): Category[] {
    return this.moneyService.categories$$().filter((category) => category.usedFor === UsedFor.TRANSACTION);
  }

  protected isCategorySelected(categoryId: number): boolean {
    return this.selectedCategoryIds.includes(categoryId);
  }

  protected toggleCategory(categoryId: number, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      if (!this.selectedCategoryIds.includes(categoryId)) {
        this.selectedCategoryIds.push(categoryId);
      }
    } else {
      this.selectedCategoryIds = this.selectedCategoryIds.filter((id) => id !== categoryId);
    }
  }

  private prepFormWithTransaction(transaction: Transaction): void {
    this.dateISO = transaction.dateISO;
    this.accountId = transaction.accountId;
    this.amount = transaction.amount;
    this.kind = transaction.kind;
    this.isGift = transaction.isGift;
    this.notes = transaction.notes || '';
    this.selectedCategoryIds = [...(transaction.categoryIds || [])];
  }

  private prepFormWithDate(dateInput: string): void {
    this.dateISO = dateInput;
    this.accountId = null;
    this.amount = null;
    this.kind = TransactionKind.EXPENSE;
    this.isGift = false;
    this.notes = '';
    this.selectedCategoryIds = [];
  }
}
