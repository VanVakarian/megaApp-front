import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EnvironmentInjector,
  OnDestroy,
  computed,
  createComponent,
  inject,
  signal,
} from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { SymbolPosition, Transaction, TransactionKind } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { TransactionForm } from './transaction-form/transaction-form';

interface TransactionGroup {
  date: string;
  dateDisplay: string;
  transactions: Transaction[];
}

@Component({
  selector: 'transactions-list',
  templateUrl: './transactions-list.html',
  imports: [DefaultModal, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsList implements AfterViewInit, OnDestroy {
  protected readonly Icon = IconName;

  private readonly moneyService = inject(MoneyService);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  private readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  private readonly categories$$ = computed(() => this.moneyService.categories$$());
  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());

  protected readonly groupedTransactions$$ = computed(() => this.groupTransactionsByDate());
  protected readonly isDeleteConfirmOpen$$ = signal(false);

  private readonly pendingDeleteId$$ = signal<number | null>(null);

  private formRef: ComponentRef<TransactionForm> | null = null;
  private activeFormTarget: HTMLElement | null = null;

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
      case TransactionKind.TRANSFER:
        return 'Transfer';
      default:
        return kind;
    }
  }

  protected getAccountTitle(accountId: number): string {
    const account = this.accounts$$().find((a) => a.id === accountId);
    return account ? account.title : 'Unknown Account';
  }

  protected getTransferAccountLine(transaction: Transaction): string {
    const twin = this.getTwinTransaction(transaction);
    if (!twin) return this.getAccountTitle(transaction.accountId);
    return `${this.getAccountTitle(transaction.accountId)} → ${this.getAccountTitle(twin.accountId)}`;
  }

  protected getCategoryName(categoryId?: number | null): string | null {
    if (!categoryId) return null;
    const category = this.categories$$().find((c) => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  }

  protected formatAmount(transaction: Transaction): string {
    const account = this.accounts$$().find((a) => a.id === transaction.accountId);
    if (!account) return transaction.amount.toString();

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return transaction.amount.toString();

    const whitespace = currency.whitespace ? ' ' : '';
    const sign =
      transaction.kind === TransactionKind.INCOME ? '+' : transaction.kind === TransactionKind.EXPENSE ? '-' : '';
    const amount = transaction.amount.toFixed(2);

    if (currency.symbolPosEnum === SymbolPosition.BEFORE) {
      return `${currency.symbol}${whitespace}${sign}${amount}`;
    } else {
      return `${sign}${amount}${whitespace}${currency.symbol}`;
    }
  }

  protected formatTransferAmounts(transaction: Transaction): string {
    const twin = this.getTwinTransaction(transaction);
    if (!twin) return this.formatAmount(transaction);
    const fromAmount = this.formatPlainAmount(transaction.accountId, transaction.amount);
    const toAmount = this.formatPlainAmount(twin.accountId, twin.amount);
    return `${fromAmount} → ${toAmount}`;
  }

  protected transactionKindIsIncome(transaction: Transaction): boolean {
    return transaction.kind === TransactionKind.INCOME;
  }

  protected getAmountClass(transaction: Transaction): string {
    if (transaction.kind === TransactionKind.INCOME) return 'text-green-600';
    if (transaction.kind === TransactionKind.EXPENSE) return 'text-red-600';
    return '';
  }

  private formatPlainAmount(accountId: number, amount: number): string {
    const account = this.accounts$$().find((a) => a.id === accountId);
    if (!account) return amount.toFixed(2);

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return amount.toFixed(2);

    const whitespace = currency.whitespace ? ' ' : '';
    const amountDisplay = amount.toFixed(2);

    if (currency.symbolPosEnum === SymbolPosition.BEFORE) {
      return `${currency.symbol}${whitespace}${amountDisplay}`;
    }
    return `${amountDisplay}${whitespace}${currency.symbol}`;
  }

  private getTwinTransaction(transaction: Transaction): Transaction | null {
    if (!transaction.twinId) return null;
    return this.moneyService.transactions$$().find((item) => item.id === transaction.twinId) ?? null;
  }

  private shouldDisplayTransaction(transaction: Transaction): boolean {
    if (transaction.kind !== TransactionKind.TRANSFER) return true;
    if (!transaction.twinId || !transaction.id) return true;
    return transaction.id < transaction.twinId;
  }

  protected deleteTransaction(id: number): void {
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
    this.moneyService.deleteTransaction(id).subscribe((success) => {});
  }

  protected showTransactionForm(targetElem: HTMLElement, dateISO?: string, transaction?: Transaction): void {
    if (dateISO) {
      this.toggleForm(targetElem, dateISO, undefined);
    } else if (transaction) {
      this.toggleForm(targetElem, undefined, transaction);
    }
  }

  protected showNewTransactionForm(targetElem: HTMLElement): void {
    this.toggleForm(targetElem, this.getTodayDateISO(), undefined);
  }

  private createFormComponent(): void {
    this.formRef = createComponent(TransactionForm, {
      environmentInjector: this.injector,
    });
    this.formRef.instance.savedOutput.subscribe(() => this.hideForm());
    this.formRef.instance.cancelledOutput.subscribe(() => this.hideForm());
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
      if (!this.shouldDisplayTransaction(transaction)) return;
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

  private getTodayDateISO(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
