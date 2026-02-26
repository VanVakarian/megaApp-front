import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { firstValueFrom } from 'rxjs';
import { MoneyService } from '../../services/money.service';
import { Account, Currency, MoneyRateHistory, SymbolPosition, Transaction, TransactionKind } from '../../shared/types';
import { AccountsList } from './accounts-list/accounts-list';
import { AssetsList } from './assets-list/assets-list';
import { CategoriesList } from './categories-list/categories-list';
import { CurrenciesList } from './currencies-list/currencies-list';
import { TransactionsList } from './transactions-list/transactions-list';

enum MoneyTab {
  Currencies = 'currencies',
  Categories = 'categories',
  Accounts = 'accounts',
  Assets = 'assets',
  Transactions = 'transactions',
}

interface BalanceRow {
  dateISO: string;
  dateDisplay: string;
  total: number;
  accountBalances: Record<number, number>;
  accountRubEquity: Record<number, number>;
  isYearEnd: boolean;
}

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  imports: [CurrenciesList, CategoriesList, AccountsList, AssetsList, TransactionsList, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoneyScreen implements OnInit {
  protected readonly Icon = IconName;
  protected readonly MoneyTab = MoneyTab;
  protected readonly activeTab$$ = signal<MoneyTab>(MoneyTab.Transactions);
  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  private readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  private readonly transactions$$ = computed(() => this.moneyService.transactions$$());
  private readonly rateHistory$$ = computed(() => this.moneyService.rateHistory$$());
  private readonly fxTickers = new Set(['USD', 'EUR']);

  private readonly accountOrder = [
    'Наличка',
    'Яндекс.Деньги',
    'Банковский счет',
    'Банковский депозит',
    'USD (наличные)',
    'EUR (наличные)',
  ];
  protected readonly accountColumns$$ = computed(() => this.getOrderedAccounts());
  protected readonly balanceRows$$ = computed(() => this.buildBalanceRows());

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    firstValueFrom(this.moneyService.getCurrencies());
    firstValueFrom(this.moneyService.getCategories());
    firstValueFrom(this.moneyService.getAccounts());
    firstValueFrom(this.moneyService.getTransactions());
    firstValueFrom(this.moneyService.getRateHistory());
  }

  protected setActiveTab(tab: MoneyTab): void {
    this.activeTab$$.set(tab);
  }

  protected getAccountTitle(account: Account): string {
    return account.title;
  }

  protected formatAccountBalance(row: BalanceRow, account: Account): string {
    const accountId = account.id;
    if (!accountId) return '0';
    const amount = row.accountBalances[accountId] ?? 0;
    const currency = this.getCurrencyForAccount(accountId);
    const rubEquity = row.accountRubEquity[accountId];
    if (rubEquity != null && this.isFxEquityAccount(account)) {
      const rubCurrency = this.getRubCurrency();
      return `${this.formatAmount(amount, currency)} (${this.formatAmount(rubEquity, rubCurrency)})`;
    }
    return this.formatAmount(amount, currency);
  }

  protected formatTotal(row: BalanceRow): string {
    const currency = this.getRubCurrency() ?? this.getCurrencyForTotal();
    return this.formatAmount(row.total, currency);
  }

  private getOrderedAccounts(): Account[] {
    const orderIndex = new Map(this.accountOrder.map((title, index) => [title, index]));
    return [...this.accounts$$()].sort((first, second) => {
      const firstIndex = orderIndex.get(first.title) ?? Number.POSITIVE_INFINITY;
      const secondIndex = orderIndex.get(second.title) ?? Number.POSITIVE_INFINITY;
      return firstIndex - secondIndex;
    });
  }

  private buildBalanceRows(): BalanceRow[] {
    const accounts = this.accounts$$();
    const transactions = this.transactions$$();
    if (!accounts.length || !transactions.length) return [];

    const transactionsByDate = new Map<string, Transaction[]>();
    transactions.forEach((transaction) => {
      const key = transaction.dateISO;
      if (!transactionsByDate.has(key)) {
        transactionsByDate.set(key, []);
      }
      transactionsByDate.get(key)!.push(transaction);
    });

    const dateKeys = Array.from(transactionsByDate.keys()).sort((a, b) => a.localeCompare(b));
    const balances = new Map<number, number>();
    const fxInvestUnits = new Map<number, number>();
    const fxInvestAccountIds = new Set<number>();

    accounts.forEach((account) => {
      if (this.isFxEquityAccount(account) && account.id) {
        fxInvestAccountIds.add(account.id);
        fxInvestUnits.set(account.id, 0);
      }
    });

    accounts.forEach((account) => {
      if (account.id) {
        balances.set(account.id, 0);
      }
    });

    const rows: BalanceRow[] = [];

    dateKeys.forEach((dateISO) => {
      const items = transactionsByDate.get(dateISO) ?? [];
      items.forEach((transaction) => {
        const delta = this.getTransactionDelta(transaction);
        const current = balances.get(transaction.accountId) ?? 0;
        balances.set(transaction.accountId, current + delta);

        if (fxInvestAccountIds.has(transaction.accountId) && transaction.kind === TransactionKind.TRANSFER) {
          const currentFx = fxInvestUnits.get(transaction.accountId) ?? 0;
          fxInvestUnits.set(transaction.accountId, currentFx + delta);
        }
      });

      if (!this.isEndOfMonth(dateISO)) return;

      const accountBalances: Record<number, number> = {};
      const accountRubEquity: Record<number, number> = {};
      let total = 0;

      accounts.forEach((account) => {
        if (!account.id) return;

        if (this.isFxEquityAccount(account)) {
          const nativeAmount = fxInvestUnits.get(account.id) ?? 0;
          accountBalances[account.id] = nativeAmount;
          const fxTicker = this.getFxTickerForAccount(account.id);
          const fxToRubRate = fxTicker ? this.getFxToRubRateForDate(dateISO, fxTicker) : null;

          if (fxToRubRate != null) {
            const rubEquity = nativeAmount * fxToRubRate;
            accountRubEquity[account.id] = rubEquity;
            total += rubEquity;
          } else {
            total += nativeAmount;
          }

          return;
        }

        const amount = balances.get(account.id) ?? 0;
        accountBalances[account.id] = amount;
        total += amount;
      });

      rows.push({
        dateISO,
        dateDisplay: this.formatDateDMY(dateISO),
        total,
        accountBalances,
        accountRubEquity,
        isYearEnd: this.isYearEnd(dateISO),
      });
    });

    return rows;
  }

  private getTransactionDelta(transaction: Transaction): number {
    if (transaction.kind === TransactionKind.INCOME) return transaction.amount;
    if (transaction.kind === TransactionKind.EXPENSE) return -transaction.amount;
    if (transaction.kind !== TransactionKind.TRANSFER) return 0;

    const direction = this.getTransferDirection(transaction);
    if (direction === 'out') return -transaction.amount;
    if (direction === 'in') return transaction.amount;
    return 0;
  }

  private getTransferDirection(transaction: Transaction): 'out' | 'in' | null {
    const detailsJSON = transaction.detailsJSON;
    if (!detailsJSON) return null;

    let parsed: any = detailsJSON;
    if (typeof detailsJSON === 'string') {
      try {
        parsed = JSON.parse(detailsJSON);
      } catch {
        return null;
      }
    }

    const direction = parsed?.direction ?? null;
    if (direction === 'out' || direction === 'in') return direction;
    return null;
  }

  private getCurrencyForAccount(accountId: number): Currency | null {
    const account = this.accounts$$().find((item) => item.id === accountId);
    if (!account) return null;
    return this.currencies$$().find((item) => item.id === account.currencyId) ?? null;
  }

  private getCurrencyForTotal(): Currency | null {
    const account = this.accountColumns$$()[0];
    if (!account?.id) return null;
    return this.getCurrencyForAccount(account.id);
  }

  private getRubCurrency(): Currency | null {
    return this.currencies$$().find((item) => item.ticker === 'RUB') ?? null;
  }

  private isFxEquityAccount(account: Account): boolean {
    if (!account.isInvest || !account.id) return false;
    const ticker = this.getFxTickerForAccount(account.id);
    return ticker != null;
  }

  private getFxTickerForAccount(accountId: number): string | null {
    const currency = this.getCurrencyForAccount(accountId);
    if (!currency?.ticker) return null;
    if (!this.fxTickers.has(currency.ticker)) return null;
    return currency.ticker;
  }

  private getFxToRubRateForDate(dateISO: string, fxTicker: string): number | null {
    const row = this.rateHistory$$().find((item: MoneyRateHistory) => item.dateISO === dateISO);
    if (!row) return null;
    const rates = row.ratesJson;
    if (!rates || typeof rates !== 'object') return null;
    const rub = rates['RUB'];
    if (typeof rub !== 'number') return null;

    if (fxTicker === 'USD') return rub;

    if (fxTicker === 'EUR') {
      const eur = rates['EUR'];
      if (typeof eur !== 'number' || eur <= 0) return null;
      return rub / eur;
    }

    return null;
  }

  private formatAmount(amount: number, currency: Currency | null): string {
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    if (!currency?.symbol) return formatted;
    const whitespace = currency.whitespace ? ' ' : '';
    if (currency.symbolPosEnum === SymbolPosition.BEFORE) {
      return `${currency.symbol}${whitespace}${formatted}`;
    }
    return `${formatted}${whitespace}${currency.symbol}`;
  }

  private formatDateDMY(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private isEndOfMonth(dateISO: string): boolean {
    const date = new Date(dateISO + 'T00:00:00');
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    return nextDay.getMonth() !== date.getMonth();
  }

  private isYearEnd(dateISO: string): boolean {
    const date = new Date(dateISO + 'T00:00:00');
    return date.getMonth() === 11 && this.isEndOfMonth(dateISO);
  }
}
