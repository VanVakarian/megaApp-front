import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { firstValueFrom } from 'rxjs';
import { MoneyService } from '../../services/money.service';
import { Account, Currency, SymbolPosition, Transaction, TransactionKind } from '../../shared/types';
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
  brokerVirtualRub: Record<number, number>;
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

  private readonly moneyService = inject(MoneyService);

  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  private readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  private readonly assets$$ = computed(() => this.moneyService.assets$$());
  private readonly transactions$$ = computed(() => this.moneyService.transactions$$());
  private readonly rateHistory$$ = computed(() => this.moneyService.rateHistory$$());
  private readonly fxTickers = new Set(['USD', 'EUR']);

  private readonly accountOrder = [
    'Яндекс.Деньги',
    'Нал руб',
    'Сбер карта',
    'Нал тенге',
    'Каспи карта',
    'Каспи депозит',
    '27898',
    '46T4M',
    '4020VC1',
    'Крипта',
    '16163',
    '27897',
    'USD (наличные)',
    'EUR (наличные)',
    '26319',
    'Сбер депозит',
  ];
  protected readonly accountColumns$$ = computed(() => this.getOrderedAccounts());
  protected readonly visibleAccountColumns$$ = computed(() => this.getVisibleAccounts());
  protected readonly balanceRows$$ = computed(() => this.buildBalanceRows());

  public ngOnInit(): void {
    firstValueFrom(this.moneyService.getCurrencies());
    firstValueFrom(this.moneyService.getCategories());
    firstValueFrom(this.moneyService.getAccounts());
    firstValueFrom(this.moneyService.getAssets());
    firstValueFrom(this.moneyService.getTransactions());
    firstValueFrom(this.moneyService.getRateHistory());
  }

  protected setActiveTab(tab: MoneyTab): void {
    this.activeTab$$.set(tab);
  }

  protected getAccountTitle(account: Account): string {
    return account.title;
  }

  protected isBrokerAccount(account: Account): boolean {
    return account.kind === 'brokerage';
  }

  protected isCryptoTradesBrokerAccount(account: Account): boolean {
    if (!this.isBrokerAccount(account)) return false;
    return /крипто|crypto/i.test(account.title ?? '');
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

  protected formatBrokerVirtualBalance(row: BalanceRow, account: Account): string {
    const accountId = account.id;
    if (!accountId) return '0';
    const rubCurrency = this.getRubCurrency();
    return this.formatAmount(row.brokerVirtualRub[accountId] ?? 0, rubCurrency);
  }

  private getOrderedAccounts(): Account[] {
    const orderIndex = new Map(this.accountOrder.map((title, index) => [title, index]));
    return [...this.accounts$$()].sort((first, second) => {
      const firstIndex = orderIndex.get(first.title) ?? Number.POSITIVE_INFINITY;
      const secondIndex = orderIndex.get(second.title) ?? Number.POSITIVE_INFINITY;
      return firstIndex - secondIndex;
    });
  }

  private getVisibleAccounts(): Account[] {
    return this.accountColumns$$();
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

    const rawDateKeys = Array.from(transactionsByDate.keys()).sort((a, b) => a.localeCompare(b));
    const endOfMonthDates = new Set<string>();
    if (rawDateKeys.length) {
      const cursor = new Date(rawDateKeys[0] + 'T00:00:00');
      const lastDate = new Date(rawDateKeys[rawDateKeys.length - 1] + 'T00:00:00');
      cursor.setDate(1);
      while (cursor <= lastDate) {
        const eom = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const eomStr = `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`;
        endOfMonthDates.add(eomStr);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const dateKeys = Array.from(new Set([...rawDateKeys, ...endOfMonthDates])).sort((a, b) => a.localeCompare(b));
    const balances = new Map<number, number>();
    const fxInvestUnits = new Map<number, number>();
    const brokerUnitsByAsset = new Map<string, number>();
    const fxInvestAccountIds = new Set<number>();

    const assetsById = new Map<number, string>();
    this.assets$$().forEach((asset) => {
      if (!asset.id) return;
      assetsById.set(asset.id, asset.ticker);
    });

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

        this.applyBrokerPositionDelta(transaction, brokerUnitsByAsset);

        if (fxInvestAccountIds.has(transaction.accountId) && transaction.kind === TransactionKind.TRANSFER) {
          const currentFx = fxInvestUnits.get(transaction.accountId) ?? 0;
          fxInvestUnits.set(transaction.accountId, currentFx + delta);
        }
      });

      if (!this.isEndOfMonth(dateISO)) return;

      const rates = this.getRatesForDate(dateISO);
      const rubUsd = rates?.['RUB'];
      const usdRub = typeof rubUsd === 'number' && rubUsd > 0 ? 1 / rubUsd : undefined;

      const accountBalances: Record<number, number> = {};
      const accountRubEquity: Record<number, number> = {};
      const brokerVirtualRub: Record<number, number> = {};
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
        total += this.convertNativeToRub(amount, account.id, rates, usdRub);

        if (this.isBrokerAccount(account)) {
          const virtualRub = this.getBrokerVirtualRubForAccount(
            account.id,
            brokerUnitsByAsset,
            assetsById,
            usdRub,
            rates,
          );
          brokerVirtualRub[account.id] = virtualRub;
          total += virtualRub;
        }
      });

      rows.push({
        dateISO,
        dateDisplay: this.formatDateDMY(dateISO),
        total,
        accountBalances,
        accountRubEquity,
        brokerVirtualRub,
        isYearEnd: this.isYearEnd(dateISO),
      });
    });

    return rows;
  }

  private getTransactionDelta(transaction: Transaction): number {
    if (transaction.kind === TransactionKind.INCOME) return transaction.amount;
    if (transaction.kind === TransactionKind.EXPENSE) return -transaction.amount;
    if (transaction.kind === TransactionKind.INVEST_BUY) return -transaction.amount;
    if (transaction.kind === TransactionKind.INVEST_SELL || transaction.kind === TransactionKind.INVEST_DIVIDEND) {
      return transaction.amount;
    }
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

  private applyBrokerPositionDelta(transaction: Transaction, brokerUnitsByAsset: Map<string, number>): void {
    if (transaction.kind !== TransactionKind.INVEST_BUY && transaction.kind !== TransactionKind.INVEST_SELL) return;

    const details = this.parseDetails(transaction.detailsJSON);
    const assetId = this.toPositiveNumber(details?.assetId);
    const quantity = this.toPositiveNumber(details?.quantity);
    if (assetId == null || quantity == null) return;

    const key = `${transaction.accountId}:${assetId}`;
    const current = brokerUnitsByAsset.get(key) ?? 0;

    if (transaction.kind === TransactionKind.INVEST_BUY) {
      brokerUnitsByAsset.set(key, current + quantity);
      return;
    }

    const next = current - quantity;
    brokerUnitsByAsset.set(key, next > 0 ? next : 0);
  }

  private getBrokerVirtualRubForAccount(
    accountId: number,
    brokerUnitsByAsset: Map<string, number>,
    assetsById: Map<number, string>,
    usdRub: number | undefined,
    rates: Record<string, number> | null,
  ): number {
    if (!rates || typeof usdRub !== 'number' || usdRub <= 0) return 0;

    let totalRub = 0;
    brokerUnitsByAsset.forEach((units, key) => {
      if (units <= 0) return;

      const [rawAccountId, rawAssetId] = key.split(':');
      const keyAccountId = Number(rawAccountId);
      const assetId = Number(rawAssetId);
      if (!Number.isFinite(keyAccountId) || !Number.isFinite(assetId)) return;
      if (keyAccountId !== accountId) return;

      const ticker = assetsById.get(assetId);
      if (!ticker) return;

      const quoteUsd = rates[ticker];
      if (typeof quoteUsd !== 'number' || quoteUsd <= 0) return;

      totalRub += units * quoteUsd * usdRub;
    });

    return totalRub;
  }

  private getRatesForDate(dateISO: string): Record<string, number> | null {
    const history = this.rateHistory$$();
    if (!history.length) return null;

    const merged: Record<string, number> = {};
    let hasAny = false;

    history
      .filter((item) => item.dateISO <= dateISO)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .forEach((item) => {
        const rates = item.ratesJson;
        if (rates && typeof rates === 'object') {
          Object.assign(merged, rates);
          hasAny = true;
        }
      });

    return hasAny ? merged : null;
  }

  private parseDetails(detailsJSON: any): any {
    if (!detailsJSON) return null;
    if (typeof detailsJSON === 'object') return detailsJSON;

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
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric;
  }

  private convertNativeToRub(
    amount: number,
    accountId: number,
    rates: Record<string, number> | null,
    usdRub: number | undefined,
  ): number {
    const currency = this.getCurrencyForAccount(accountId);
    if (!currency || currency.ticker === 'RUB') return amount;
    if (!rates || typeof usdRub !== 'number' || usdRub <= 0) return amount;
    const assetUsd = rates[currency.ticker];
    if (typeof assetUsd !== 'number' || assetUsd <= 0) return amount;
    return amount * assetUsd * usdRub;
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
    if (account.kind !== 'cash') return false;
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
    const rates = this.getRatesForDate(dateISO);
    if (!rates) return null;
    const rubUsd = rates['RUB'];
    if (typeof rubUsd !== 'number' || rubUsd <= 0) return null;
    const usdRub = 1 / rubUsd;

    if (fxTicker === 'USD') return usdRub;

    if (fxTicker === 'EUR') {
      const eur = rates['EUR'];
      if (typeof eur !== 'number' || eur <= 0) return null;
      return eur * usdRub;
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
    const result = nextDay.getMonth() !== date.getMonth();
    return result;
  }

  private isYearEnd(dateISO: string): boolean {
    const date = new Date(dateISO + 'T00:00:00');
    return date.getMonth() === 11 && this.isEndOfMonth(dateISO);
  }
}
