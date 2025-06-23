import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Transaction, TransactionKind } from '@app/shared/interfaces';
import { TransactionForm } from './transaction-form/transaction-form';

interface TransactionGroup {
  date: string;
  dateDisplay: string;
  transactions: Transaction[];
}

@Component({
  selector: 'transactions-list',
  templateUrl: './transactions-list.html',
  standalone: true,
  imports: [CommonModule, TransactionForm],
})
export class TransactionsList {
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected categories$$ = computed(() => this.moneyService.categories$$());
  protected accounts$$ = computed(() => this.moneyService.accounts$$());
  protected groupedTransactions$$ = computed(() => this.groupTransactionsByDate());

  protected showForm = false;
  protected editingTransaction: Transaction | null = null;

  constructor(private moneyService: MoneyService) {}

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

  protected getAccountTitle(accountId: number): string {
    const account = this.accounts$$().find((a) => a.id === accountId);
    return account ? account.title : 'Unknown Account';
  }

  protected getCategoryNames(categoryIds: number[]): string[] {
    if (!categoryIds || categoryIds.length === 0) return [];
    return categoryIds
      .map((id) => {
        const category = this.categories$$().find((c) => c.id === id);
        return category ? category.name : 'Unknown Category';
      })
      .filter(Boolean);
  }

  protected formatDate(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected formatAmount(amount: number, accountId: number): string {
    const account = this.accounts$$().find((a) => a.id === accountId);
    if (!account) return amount.toString();

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return amount.toString();

    const formattedAmount = Math.abs(amount).toFixed(2);
    const symbol = currency.symbol;
    const whitespace = currency.whitespace ? ' ' : '';

    if (currency.symbolPosEnum === 'before') {
      return `${symbol}${whitespace}${formattedAmount}`;
    } else {
      return `${formattedAmount}${whitespace}${symbol}`;
    }
  }

  protected deleteTransaction(id: number): void {
    this.moneyService.deleteTransaction(id).subscribe((success) => {});
  }

  protected showCreateForm(): void {
    this.editingTransaction = null;
    this.showForm = true;
  }

  protected editTransaction(transaction: Transaction): void {
    this.editingTransaction = transaction;
    this.showForm = true;
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingTransaction = null;
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingTransaction = null;
  }

  private groupTransactionsByDate(): TransactionGroup[] {
    const transactions = this.moneyService.transactions$$();
    const groups = new Map<string, TransactionGroup>();

    transactions.forEach((transaction) => {
      const dateKey = transaction.dateISO;

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: dateKey,
          dateDisplay: this.formatDate(transaction.dateISO),
          transactions: [],
        });
      }

      groups.get(dateKey)!.transactions.push(transaction);
    });

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Let's see if we want to sort transactions by id within each group
    // sortedGroups.forEach((group) => {
    //   group.transactions.sort((a, b) => {
    //     if (a.id && b.id) {
    //       return b.id - a.id;
    //     }
    //     return 0;
    //   });
    // });

    return sortedGroups;
  }
}
