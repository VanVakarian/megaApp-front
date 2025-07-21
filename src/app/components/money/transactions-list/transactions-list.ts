import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ComponentRef,
  EnvironmentInjector,
  OnDestroy,
  computed,
  createComponent,
  effect,
} from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { SymbolPosition, Transaction, TransactionKind } from '@app/shared/interfaces';
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
  imports: [CommonModule],
})
export class TransactionsList implements AfterViewInit, OnDestroy {
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected categories$$ = computed(() => this.moneyService.categories$$());
  protected accounts$$ = computed(() => this.moneyService.accounts$$());
  protected groupedTransactions$$ = computed(() => this.groupTransactionsByDate());

  private formRef: ComponentRef<TransactionForm> | null = null;
  private activeFormTarget: HTMLElement | null = null;

  constructor(
    private moneyService: MoneyService,
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector,
  ) {
    effect(() => { console.log('GROUPED TRANSACTIONS:', this.groupedTransactions$$()) }); // prettier-ignore
  }

  public ngAfterViewInit(): void {
    this.createFormComponent();
  }

  public ngOnDestroy(): void {
    if (this.formRef) {
      this.appRef.detachView(this.formRef.hostView);
      this.formRef.destroy();
    }
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

  protected formatAmount(transaction: Transaction): string {
    const account = this.accounts$$().find((a) => a.id === transaction.accountId);
    if (!account) return transaction.amount.toString();

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return transaction.amount.toString();

    const whitespace = currency.whitespace ? ' ' : '';
    const sign = transaction.kind === TransactionKind.INCOME ? '+' : '-';
    const amount = transaction.amount.toFixed(2);

    if (currency.symbolPosEnum === SymbolPosition.BEFORE) {
      return `${currency.symbol}${whitespace}${sign}${amount}`;
    } else {
      return `${sign}${amount}${whitespace}${currency.symbol}`;
    }
  }

  protected transactionKindIsIncome(transaction: Transaction): boolean {
    return transaction.kind === TransactionKind.INCOME;
  }

  protected deleteTransaction(id: number): void {
    this.moneyService.deleteTransaction(id).subscribe((success) => {});
  }

  protected showTransactionForm(targetElem: HTMLElement, dateISO?: string, transaction?: Transaction): void {
    if (dateISO) {
      this.toggleForm(targetElem, dateISO, undefined);
    } else if (transaction) {
      this.toggleForm(targetElem, undefined, transaction);
    }
  }

  private createFormComponent(): void {
    this.formRef = createComponent(TransactionForm, {
      environmentInjector: this.injector,
    });
    this.formRef.instance.onSaved.subscribe(() => this.hideForm());
    this.formRef.instance.onCancelled.subscribe(() => this.hideForm());
    this.appRef.attachView(this.formRef.hostView);
  }

  private toggleForm(targetElement: HTMLElement, dateISO?: string, transaction?: Transaction): void {
    if (this.activeFormTarget === targetElement) {
      this.hideForm();
    } else {
      this.moveFormTo(targetElement, dateISO, transaction);
    }
  }

  private moveFormTo(targetElement: HTMLElement, dateISO?: string, transaction?: Transaction): void {
    if (!this.formRef) return;

    const formElement = this.formRef.location.nativeElement as HTMLElement;
    if (formElement.parentNode) {
      formElement.parentNode.removeChild(formElement);
    }

    targetElement.appendChild(formElement);
    this.activeFormTarget = targetElement;

    if (transaction) {
      this.formRef.setInput('dateIsoInput', null);
      this.formRef.setInput('transactionInput', transaction);
    } else {
      this.formRef.setInput('dateIsoInput', dateISO);
      this.formRef.setInput('transactionInput', null);
    }

    this.showForm();
  }

  private showForm(): void {
    if (this.formRef) {
      (this.formRef.location.nativeElement as HTMLElement).style.display = 'block';
    }
  }

  private hideForm(): void {
    if (this.formRef) {
      (this.formRef.location.nativeElement as HTMLElement).style.display = 'none';
      this.activeFormTarget = null;
    }
  }

  private groupTransactionsByDate(): TransactionGroup[] {
    const transactions = this.moneyService.transactions$$();
    const transactionsByDateMap = new Map<string, TransactionGroup>();

    transactions.forEach((transaction) => {
      const dateIsoKey = transaction.dateISO;

      if (!transactionsByDateMap.has(dateIsoKey)) {
        transactionsByDateMap.set(dateIsoKey, {
          date: dateIsoKey,
          dateDisplay: this.formatDate(transaction.dateISO),
          transactions: [],
        });
      }

      transactionsByDateMap.get(dateIsoKey)!.transactions.push(transaction);
    });

    const groupsSortedByDate = Array.from(transactionsByDateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Let's see if we want to sort transactions by id within each group
    // sortedGroups.forEach((group) => {
    //   group.transactions.sort((a, b) => {
    //     if (a.id && b.id) {
    //       return b.id - a.id;
    //     }
    //     return 0;
    //   });
    // });

    return groupsSortedByDate;
  }

  private formatDate(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    const currentYear = new Date().getFullYear();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    if (date.getFullYear() !== currentYear) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  }
}
