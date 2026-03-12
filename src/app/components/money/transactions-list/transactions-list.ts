import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { FormModal } from '@app/shared/components/form-modal/form-modal';
import { AccountKind, Asset, Organization, SymbolPosition, Transaction, TransactionKind } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { TransactionForm } from './transaction-form/transaction-form';

interface TransactionGroup {
  date: string;
  dateDisplay: string;
  transactions: Transaction[];
}

interface GroupMeasurement {
  startY: number;
  height: number;
  group: TransactionGroup;
}

@Component({
  selector: 'transactions-list',
  templateUrl: './transactions-list.html',
  styleUrl: './transactions-list.scss',
  imports: [DefaultModal, FormModal, TransactionForm, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsList {
  protected readonly Icon = IconName;

  private readonly moneyService = inject(MoneyService);

  /**
   * Thousands separator. Options (narrowest to widest):
   * '\u2006' six-per-em   ~1/6em
   * '\u2009' thin space   ~1/5em
   * '\u202F' narrow-nbsp  ~1/4em
   * '\u2005' four-per-em  ~1/4em  ← current
   * '\u2004' three-per-em ~1/3em
   * '\u2002' en-space     ~1/2em
   */
  private readonly THOUSANDS_SEP = '\u2005';

  private readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  private readonly categories$$ = computed(() => this.moneyService.categories$$());
  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  private readonly organizations$$ = computed(() => this.moneyService.organizations$$());
  private readonly assets$$ = computed(() => this.moneyService.assets$$());

  protected readonly groupedTransactions$$ = computed(() => this.groupTransactionsByDate());
  protected readonly isDeleteConfirmOpen$$ = signal(false);

  private readonly pendingDeleteId$$ = signal<number | null>(null);

  protected readonly showForm$$ = signal(false);
  protected readonly formDateISO$$ = signal<string | null>(null);
  protected readonly editingTransaction$$ = signal<Transaction | null>(null);

  private readonly scrollContainerElem = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  private readonly HEADER_HEIGHT = 24;
  private readonly TRANSACTION_HEIGHT = 32;
  private readonly GROUP_BOTTOM_MARGIN = 16;
  private readonly BUFFER_PX = 1200;

  protected readonly containerHeight = 800;

  private readonly scrollTop$$ = signal(0);

  protected readonly isAtTop$$ = computed(() => this.scrollTop$$() === 0);

  private readonly groupMeasurements$$ = computed<GroupMeasurement[]>(() => {
    const groups = this.groupedTransactions$$();
    let y = 0;
    return groups.map((group) => {
      const height =
        this.HEADER_HEIGHT + group.transactions.length * this.TRANSACTION_HEIGHT + this.GROUP_BOTTOM_MARGIN;
      const measurement: GroupMeasurement = { startY: y, height, group };
      y += height;
      return measurement;
    });
  });

  protected readonly totalScrollHeight$$ = computed(() => {
    const measurements = this.groupMeasurements$$();
    if (!measurements.length) return 0;
    const last = measurements[measurements.length - 1];
    return last.startY + last.height;
  });

  protected readonly visibleMeasurements$$ = computed(() => {
    const measurements = this.groupMeasurements$$();
    const scrollTop = this.scrollTop$$();
    const visibleBottom = scrollTop + this.containerHeight;
    return measurements.filter(
      (m) => m.startY + m.height > scrollTop - this.BUFFER_PX && m.startY < visibleBottom + this.BUFFER_PX,
    );
  });

  protected readonly paddingTop$$ = computed(() => {
    const visible = this.visibleMeasurements$$();
    return visible.length ? visible[0].startY : 0;
  });

  protected readonly paddingBottom$$ = computed(() => {
    const visible = this.visibleMeasurements$$();
    const total = this.totalScrollHeight$$();
    if (!visible.length) return total;
    const last = visible[visible.length - 1];
    return total - (last.startY + last.height);
  });

  protected onScroll(event: Event): void {
    this.scrollTop$$.set((event.target as HTMLElement).scrollTop);
  }

  protected showNewTransactionForm(): void {
    this.formDateISO$$.set(this.getTodayDateISO());
    this.editingTransaction$$.set(null);
    this.showForm$$.set(true);
  }

  protected showTransactionForm(dateISO?: string, transaction?: Transaction): void {
    if (dateISO) {
      this.formDateISO$$.set(dateISO);
      this.editingTransaction$$.set(null);
    } else if (transaction) {
      this.editingTransaction$$.set(transaction);
      this.formDateISO$$.set(null);
    }
    this.showForm$$.set(true);
  }

  protected hideForm(): void {
    this.showForm$$.set(false);
  }

  protected getKindDisplayName(kind: TransactionKind): string {
    switch (kind) {
      case TransactionKind.INCOME:
        return 'Income';
      case TransactionKind.EXPENSE:
        return 'Expense';
      case TransactionKind.TRANSFER:
        return 'Transfer';
      case TransactionKind.INVEST_BUY:
        return 'invest buy';
      case TransactionKind.INVEST_SELL:
        return 'invest sell';
      case TransactionKind.INVEST_DIVIDEND:
        return 'invest dividend';
      default:
        return kind;
    }
  }

  protected getPrimaryLine(transaction: Transaction): string {
    if (transaction.kind === TransactionKind.TRANSFER) {
      return this.getTransferAccountLine(transaction);
    }

    if (this.isInvestKind(transaction.kind)) {
      return `${this.getAccountTitle(transaction.accountId)} - ${this.getKindDisplayName(transaction.kind)}`;
    }

    return this.getAccountTitle(transaction.accountId);
  }

  protected getAccountKindIcon(accountId: number): IconName {
    const account = this.accounts$$().find((a) => a.id === accountId);
    if (!account) return IconName.AccontBalanceWallet;

    switch (account.kind) {
      case AccountKind.CASH:
        return IconName.UniversalCurrencyAlt;
      case AccountKind.CARD:
        return IconName.CreditCard;
      case AccountKind.CHECKING:
        return IconName.AccontBalance;
      case AccountKind.DEPOSIT:
        return IconName.Savings;
      case AccountKind.BROKERAGE:
        return IconName.CandlestickChart;
      case AccountKind.CRYPTO:
        return IconName.CurrencyBitcoin;
      default:
        return IconName.AccontBalanceWallet;
    }
  }

  protected getAccountOrgLogoSrc(accountId: number): string | null {
    const account = this.accounts$$().find((a) => a.id === accountId);
    if (!account?.organizationId) return null;

    const org = this.organizations$$().find((o: Organization) => o.id === account.organizationId);
    if (!org?.logoBase64) return null;

    return `data:image/png;base64,${org.logoBase64}`;
  }

  protected getTransferOrgLogoSrc(transaction: Transaction): string | null {
    const twin = this.getTwinTransaction(transaction);
    if (!twin) return null;
    return this.getAccountOrgLogoSrc(twin.accountId);
  }

  protected getTransferAccountKindIcon(transaction: Transaction): IconName {
    const twin = this.getTwinTransaction(transaction);
    if (!twin) return IconName.AccontBalanceWallet;
    return this.getAccountKindIcon(twin.accountId);
  }

  protected getInvestSharesLine(transaction: Transaction): string | null {
    if (!this.isInvestKind(transaction.kind)) return null;

    const details = this.parseDetails(transaction.detailsJSON);
    const assetId = this.toPositiveNumber(details?.assetId);
    if (assetId == null) return null;

    const ticker = this.getAssetTicker(assetId);
    if (transaction.kind === TransactionKind.INVEST_DIVIDEND) {
      return ticker;
    }

    const quantity = this.toPositiveNumber(details?.quantity);
    if (quantity == null) return ticker;

    const sign = transaction.kind === TransactionKind.INVEST_BUY ? '+' : '-';
    return `${sign}${this.formatSharesQuantity(quantity)} shares ${ticker}`;
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
    const normalizedCategoryId = Number(categoryId);
    const category = this.categories$$().find((c) => Number(c.id) === normalizedCategoryId);
    if (!category) return 'Unknown Category';
    return category.name;
  }

  protected formatAmount(transaction: Transaction): string {
    const account = this.accounts$$().find((a) => a.id === transaction.accountId);
    if (!account) return transaction.amount.toString();

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return transaction.amount.toString();

    const whitespace = currency.whitespace ? ' ' : '';
    const sign =
      transaction.kind === TransactionKind.INCOME ? '+' : transaction.kind === TransactionKind.EXPENSE ? '-' : '';
    const amount = this.formatNumber(transaction.amount);

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
    if (transaction.kind === TransactionKind.INCOME || transaction.kind === TransactionKind.INVEST_DIVIDEND)
      return 'text-green-600';
    if (transaction.kind === TransactionKind.EXPENSE) return 'text-red-600';
    return '';
  }

  private isInvestKind(kind: TransactionKind): boolean {
    return (
      kind === TransactionKind.INVEST_BUY ||
      kind === TransactionKind.INVEST_SELL ||
      kind === TransactionKind.INVEST_DIVIDEND
    );
  }

  private getAssetTicker(assetId: number): string {
    const asset = this.assets$$().find((item: Asset) => item.id === assetId);
    return asset?.ticker ?? `asset #${assetId}`;
  }

  private parseDetails(detailsJSON: any): any {
    if (!detailsJSON) return null;

    if (typeof detailsJSON === 'object') {
      return detailsJSON;
    }

    if (typeof detailsJSON === 'string') {
      try {
        return JSON.parse(detailsJSON);
      } catch {
        return null;
      }
    }

    return null;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
    return numberValue;
  }

  private formatSharesQuantity(quantity: number): string {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(quantity);
  }

  private formatPlainAmount(accountId: number, amount: number): string {
    const account = this.accounts$$().find((a) => a.id === accountId);
    if (!account) return amount.toFixed(2);

    const currency = this.currencies$$().find((c) => c.id === account.currencyId);
    if (!currency) return amount.toFixed(2);

    const whitespace = currency.whitespace ? ' ' : '';
    const amountDisplay = this.formatNumber(amount);

    if (currency.symbolPosEnum === SymbolPosition.BEFORE) {
      return `${currency.symbol}${whitespace}${amountDisplay}`;
    }
    return `${amountDisplay}${whitespace}${currency.symbol}`;
  }

  private formatNumber(amount: number): string {
    const [int, dec] = amount.toFixed(2).split('.');
    const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, this.THOUSANDS_SEP);
    return `${intFormatted}.${dec}`;
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
