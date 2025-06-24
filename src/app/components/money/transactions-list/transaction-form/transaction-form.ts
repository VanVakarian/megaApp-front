import { CommonModule } from '@angular/common';
import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Account, Category, Transaction, TransactionKind, UsedFor } from '@app/shared/interfaces';
import { calculateTodayIsoWithUserTimeShift } from '@app/shared/utils';

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class TransactionForm implements OnInit {
  public readonly transaction = input<Transaction | null>(null);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  // Form fields
  protected dateISO = '';
  protected accountId: number | null = null;
  protected amount: number | null = null;
  protected kind: TransactionKind = TransactionKind.EXPENSE;
  protected isGift = false;
  protected notes = '';
  protected selectedCategoryIds: number[] = [];

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.dateISO = calculateTodayIsoWithUserTimeShift();

    const currentTransaction = this.transaction();
    if (currentTransaction) {
      this.fillForm(currentTransaction);
    }
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

    const currentTransaction = this.transaction();
    if (currentTransaction?.id) {
      // Edit mode
      transactionData.id = currentTransaction.id;
      this.moneyService.updateTransaction(transactionData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    } else {
      // Create mode
      this.moneyService.createTransaction(transactionData).subscribe((success) => {
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
    return Boolean(this.transaction()?.id);
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

  private fillForm(transaction: Transaction): void {
    this.dateISO = transaction.dateISO;
    this.accountId = transaction.accountId;
    this.amount = transaction.amount;
    this.kind = transaction.kind;
    this.isGift = transaction.isGift;
    this.notes = transaction.notes || '';
    this.selectedCategoryIds = [...(transaction.categoryIds || [])];
  }
}
