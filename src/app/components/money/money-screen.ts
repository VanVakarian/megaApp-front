import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { firstValueFrom } from 'rxjs';
import { MoneyService } from '../../services/money.service';
import { INCOME_CHART_ALLOWED_CATEGORIES, INCOME_VIRTUAL_SERIES } from '../../shared/chart-config';
import {
  Account,
  AssetType,
  BalanceChartAccountSeries,
  BalanceChartData,
  Category,
  Currency,
  DividendRow,
  ExpenseCategory,
  ExpenseChartData,
  ExpenseRow,
  IncomeChartData,
  InvestAssetTrade,
  PositionLotRow,
  Transaction,
  TransactionKind,
} from '../../shared/types';
import { AccountsList } from './accounts-list/accounts-list';
import { AssetsList } from './assets-list/assets-list';
import { BalancesChart } from './balances-chart/balances-chart';
import { CategoriesList } from './categories-list/categories-list';
import { CurrenciesList } from './currencies-list/currencies-list';
import { ExpenseChart } from './expense-chart/expense-chart';
import { IncomeChart } from './income-chart/income-chart';
import { OrganizationsList } from './organizations-list/organizations-list';
import { TransactionsList } from './transactions-list/transactions-list';

enum MoneyTab {
  Setup = 'setup',
  Categories = 'categories',
  Assets = 'assets',
  Transactions = 'transactions',
}

interface BalanceRow {
  dateISO: string;
  total: number;
  accountRubContributions: Record<number, number>;
  accountRubSuspendedContributions: Record<number, number>;
}

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  imports: [
    CurrenciesList,
    CategoriesList,
    AccountsList,
    OrganizationsList,
    AssetsList,
    TransactionsList,
    BalancesChart,
    ExpenseChart,
    IncomeChart,
    VButton,
    VCard,
    VIcon,
  ],
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
  private readonly investAssetTrades$$ = computed(() => this.moneyService.investAssetTrades$$());
  private readonly rateHistory$$ = computed(() => this.moneyService.rateHistory$$());
  private readonly categories$$ = computed(() => this.moneyService.categories$$());
  protected readonly isChartDataReady$$ = computed(() => this.moneyService.isChartDataReady$$());
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
  private readonly accountColumns$$ = computed(() => this.getOrderedAccounts());
  private readonly balanceRows$$ = computed(() => this.buildBalanceRows());
  protected readonly balanceChartData$$ = computed(() => this.buildChartData());
  protected readonly incomeChartData$$ = computed(() => this.buildIncomeChartData());
  protected readonly expenseChartData$$ = computed(() => this.buildExpenseChartData());

  public ngOnInit(): void {
    firstValueFrom(this.moneyService.getCurrencies());
    firstValueFrom(this.moneyService.getCategories());
    firstValueFrom(this.moneyService.getAccounts());
    firstValueFrom(this.moneyService.getOrganizations());
    firstValueFrom(this.moneyService.getAssets());
    firstValueFrom(this.moneyService.getTransactions());
    firstValueFrom(this.moneyService.getRateHistory());
    firstValueFrom(this.moneyService.getInvestAssetTrades());
  }

  protected setActiveTab(tab: MoneyTab): void {
    this.activeTab$$.set(tab);
  }

  protected isBrokerAccount(account: Account): boolean {
    return account.kind === 'brokerage' || account.kind === 'crypto';
  }

  private getOrderedAccounts(): Account[] {
    const orderIndex = new Map(this.accountOrder.map((title, index) => [title, index]));
    return [...this.accounts$$()].sort((first, second) => {
      const firstIndex = orderIndex.get(first.title) ?? Number.POSITIVE_INFINITY;
      const secondIndex = orderIndex.get(second.title) ?? Number.POSITIVE_INFINITY;
      return firstIndex - secondIndex;
    });
  }

  private buildChartData(): BalanceChartData {
    const rows = this.balanceRows$$();
    const accounts = this.accountColumns$$();
    const assets = this.assets$$();

    const suspendedAccountIds = new Set<number>();
    assets.forEach((asset) => {
      if (asset.suspendedSince) {
        asset.accountIds.forEach((id) => suspendedAccountIds.add(id));
      }
    });

    const accountSeriesMap = new Map<number, number[]>();
    const accountSuspendedSeriesMap = new Map<number, number[]>();
    accounts.forEach((a) => {
      if (a.id) {
        accountSeriesMap.set(a.id, []);
        accountSuspendedSeriesMap.set(a.id, []);
      }
    });

    rows.forEach((row) => {
      accounts.forEach((account) => {
        if (!account.id) return;
        accountSeriesMap.get(account.id)!.push(row.accountRubContributions[account.id] ?? 0);
        accountSuspendedSeriesMap.get(account.id)!.push(row.accountRubSuspendedContributions[account.id] ?? 0);
      });
    });

    const accountSeries: BalanceChartAccountSeries[] = [];
    accounts.forEach((account) => {
      if (!account.id) return;
      const values = accountSeriesMap.get(account.id) ?? [];
      if (values.some((v) => v !== 0)) {
        accountSeries.push({
          accountId: account.id,
          accountTitle: account.title,
          values,
          suspendedValues: accountSuspendedSeriesMap.get(account.id) ?? [],
          isSuspended: suspendedAccountIds.has(account.id),
        });
      }
    });

    return {
      dates: rows.map((r) => r.dateISO),
      totals: rows.map((r) => r.total),
      accountSeries,
    };
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
    const assetSuspendedSince = new Map<number, string>();
    this.assets$$().forEach((asset) => {
      if (!asset.id) return;
      assetsById.set(asset.id, asset.ticker);
      if (asset.suspendedSince) assetSuspendedSince.set(asset.id, asset.suspendedSince);
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

      const accountRubContributions: Record<number, number> = {};
      const accountRubSuspendedContributions: Record<number, number> = {};
      let total = 0;

      accounts.forEach((account) => {
        if (!account.id) return;

        if (this.isFxEquityAccount(account)) {
          const nativeAmount = fxInvestUnits.get(account.id) ?? 0;
          const fxTicker = this.getFxTickerForAccount(account.id);
          const fxToRubRate = fxTicker ? this.getFxToRubRateForDate(dateISO, fxTicker) : null;

          if (fxToRubRate != null) {
            const rubEquity = nativeAmount * fxToRubRate;
            accountRubContributions[account.id] = rubEquity;
            accountRubSuspendedContributions[account.id] = 0;
            total += rubEquity;
          } else {
            accountRubContributions[account.id] = nativeAmount;
            accountRubSuspendedContributions[account.id] = 0;
            total += nativeAmount;
          }

          return;
        }

        const amount = balances.get(account.id) ?? 0;
        const rubFromBalance = this.convertNativeToRub(amount, account.id, rates, usdRub);
        total += rubFromBalance;

        if (this.isBrokerAccount(account)) {
          const virtualRub = this.getBrokerVirtualRubForAccount(
            account.id,
            brokerUnitsByAsset,
            assetsById,
            usdRub,
            rates,
          );
          const suspendedVirtualRub = this.getSuspendedBrokerVirtualRubForAccount(
            account.id,
            brokerUnitsByAsset,
            assetsById,
            assetSuspendedSince,
            dateISO,
            usdRub,
            rates,
          );
          accountRubContributions[account.id] = rubFromBalance + virtualRub;
          accountRubSuspendedContributions[account.id] = suspendedVirtualRub;
          total += virtualRub;
        } else {
          accountRubContributions[account.id] = rubFromBalance;
          accountRubSuspendedContributions[account.id] = 0;
        }
      });

      rows.push({
        dateISO,
        total,
        accountRubContributions,
        accountRubSuspendedContributions,
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

  private getSuspendedBrokerVirtualRubForAccount(
    accountId: number,
    brokerUnitsByAsset: Map<string, number>,
    assetsById: Map<number, string>,
    assetSuspendedSince: Map<number, string>,
    currentDateISO: string,
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

      const suspendedSince = assetSuspendedSince.get(assetId);
      if (!suspendedSince || currentDateISO < suspendedSince) return;

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
    if (currency.ticker === 'USD') return amount * usdRub;
    const assetUsd = rates[currency.ticker];
    if (typeof assetUsd !== 'number' || assetUsd <= 0) return amount;
    return amount * assetUsd * usdRub;
  }

  private getCurrencyForAccount(accountId: number): Currency | null {
    const account = this.accounts$$().find((item) => item.id === accountId);
    if (!account) return null;
    return this.currencies$$().find((item) => item.id === account.currencyId) ?? null;
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

  private isEndOfMonth(dateISO: string): boolean {
    const date = new Date(dateISO + 'T00:00:00');
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    const result = nextDay.getMonth() !== date.getMonth();
    return result;
  }

  private buildIncomeChartData(): IncomeChartData {
    const transactions = this.transactions$$();
    const categories = this.categories$$();

    const dividendRows = this.buildDividendRows();
    const positionLotRows = this.buildPositionLotRows();

    const allowedCategoryIds = new Set(
      categories
        .filter((c) => c.id !== undefined && INCOME_CHART_ALLOWED_CATEGORIES.has(c.name))
        .map((c) => c.id as number),
    );
    const incomeTransactions = transactions.filter(
      (t) =>
        t.kind === TransactionKind.INCOME && !t.isGift && t.categoryId != null && allowedCategoryIds.has(t.categoryId),
    );

    const allDates: string[] = [
      ...incomeTransactions.map((t) => t.dateISO),
      ...dividendRows.map((r) => r.dateISO),
      ...positionLotRows.map((r) => r.buyDateISO),
      ...positionLotRows.filter((r) => r.sellDateISO != null).map((r) => r.sellDateISO!),
    ];

    const today = new Date();
    const currentMonthFirstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    if (positionLotRows.some((r) => r.status === 'open')) {
      allDates.push(currentMonthFirstDay);
    }

    if (!allDates.length) return { months: [], categorySeries: [] };

    allDates.sort();
    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const lastDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');

    const months: string[] = [];
    const cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (
      cursor.getFullYear() < lastDate.getFullYear() ||
      (cursor.getFullYear() === lastDate.getFullYear() && cursor.getMonth() <= lastDate.getMonth())
    ) {
      const eom = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push(
        `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`,
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const monthIndexMap = new Map<string, number>(months.map((m, i) => [m.substring(0, 7), i]));
    const categoryValues = new Map<number | null, number[]>();

    incomeTransactions.forEach((t) => {
      const monthKey = t.dateISO.substring(0, 7);
      const monthIndex = monthIndexMap.get(monthKey);
      if (monthIndex === undefined) return;

      const rates = this.getRatesForDate(t.dateISO);
      const usdRub = rates?.['RUB'] ? 1 / rates['RUB'] : undefined;
      const rubAmount = this.convertNativeToRub(t.amount, t.accountId, rates, usdRub);

      const catId = t.categoryId ?? null;
      if (!categoryValues.has(catId)) {
        categoryValues.set(catId, new Array(months.length).fill(0));
      }
      categoryValues.get(catId)![monthIndex] += rubAmount;
    });

    const dividendValues = new Array(months.length).fill(0);
    dividendRows.forEach((row) => {
      const monthKey = row.dateISO.substring(0, 7);
      const idx = monthIndexMap.get(monthKey);
      if (idx !== undefined) dividendValues[idx] += row.amountRub;
    });

    const closedValues = new Array(months.length).fill(0);
    const cbOpenValues = new Array(months.length).fill(0);
    const cryptoClosedValues = new Array(months.length).fill(0);
    const cryptoOpenValues = new Array(months.length).fill(0);
    positionLotRows
      .filter((r) => r.pnlRub !== null)
      .forEach((row) => {
        const isCrypto = row.assetType === AssetType.CRYPTO;
        const perMonth = row.pnlRub! / row.openMonths.length;
        if (row.status === 'closed') {
          const target = isCrypto ? cryptoClosedValues : closedValues;
          row.openMonths.forEach((monthKey) => {
            const idx = monthIndexMap.get(monthKey);
            if (idx !== undefined) target[idx] += perMonth;
          });
        } else {
          const target = isCrypto ? cryptoOpenValues : cbOpenValues;
          row.openMonths.forEach((monthKey) => {
            const idx = monthIndexMap.get(monthKey);
            if (idx !== undefined) target[idx] += perMonth;
          });
        }
      });

    const pushIfNonZero = (categoryId: number, categoryName: string, values: number[]) => {
      if (values.some((v) => v !== 0)) {
        categorySeries.push({ categoryId, categoryName, values });
      }
    };

    const categorySeries = Array.from(categoryValues.entries()).map(([catId, values]) => {
      const category = catId !== null ? categories.find((c) => c.id === catId) : null;
      return {
        categoryId: catId,
        categoryName: category?.name ?? 'Other',
        values,
      };
    });

    categorySeries.push({
      categoryId: INCOME_VIRTUAL_SERIES.DIVIDENDS,
      categoryName: 'Дивиденды',
      values: dividendValues,
    });
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CB_CLOSED_PNL, 'ЦБ закрытые', closedValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CB_OPEN_PNL, 'ЦБ открытые', cbOpenValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CRYPTO_CLOSED_PNL, 'Крипта закрытые', cryptoClosedValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CRYPTO_OPEN_PNL, 'Крипта открытые', cryptoOpenValues);

    const seriesOrderMap = new Map([
      ['Зарплата', 0],
      ['Проекты', 1],
      ['Проценты', 2],
      ['Дивиденды', 3],
      ['ЦБ закрытые', 4],
      ['ЦБ открытые', 5],
      ['Крипта закрытые', 6],
      ['Крипта открытые', 7],
    ]);

    categorySeries.sort((a, b) => {
      const orderA = seriesOrderMap.get(a.categoryName) ?? 99;
      const orderB = seriesOrderMap.get(b.categoryName) ?? 99;
      return orderA - orderB;
    });

    return { months, categorySeries };
  }

  private buildExpenseChartData(): ExpenseChartData {
    const transactions = this.transactions$$();
    const categories = this.categories$$();

    const EXCLUDED_NAMES = new Set(['Налог', 'Комиссии', 'Технический гэп']);

    const categoryMap = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id != null) categoryMap.set(c.id, c);
    });

    const excludedRootIds = new Set<number>();
    categories.forEach((c) => {
      if (c.id != null && !c.parentId && EXCLUDED_NAMES.has(c.name)) {
        excludedRootIds.add(c.id);
      }
    });

    const getRootCategoryId = (catId: number): number => {
      const cat = categoryMap.get(catId);
      if (!cat || !cat.parentId) return catId;
      return getRootCategoryId(cat.parentId);
    };

    const giftCategory = categories.find((c) => c.name === 'Подарок');
    const giftCategoryId = giftCategory?.id ?? null;

    const getEffectiveCategoryId = (t: Transaction): number | null => {
      if (t.isGift && giftCategoryId != null) return giftCategoryId;
      return t.categoryId ?? null;
    };

    const expenseTransactions = transactions.filter((t) => t.kind === TransactionKind.EXPENSE);

    if (!expenseTransactions.length) {
      return { categories: [], monthRows: [] };
    }

    const uniqueDisplayCategoryIds = new Set<number>();
    expenseTransactions.forEach((t) => {
      const effectiveId = getEffectiveCategoryId(t);
      if (effectiveId == null) return;
      if (excludedRootIds.has(getRootCategoryId(effectiveId))) return;
      uniqueDisplayCategoryIds.add(effectiveId);
    });

    const expenseCategories: ExpenseCategory[] = Array.from(uniqueDisplayCategoryIds)
      .map((id) => {
        const cat = categoryMap.get(id);
        return { id, name: cat?.name ?? 'Other' };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const monthAmounts = new Map<string, Map<number, number>>();
    const monthUncategorized = new Map<string, number>();

    expenseTransactions.forEach((t) => {
      const rates = this.getRatesForDate(t.dateISO);
      const usdRub = rates?.['RUB'] ? 1 / rates['RUB'] : undefined;
      const rubAmount = this.convertNativeToRub(t.amount, t.accountId, rates, usdRub);

      const month = t.dateISO.substring(0, 7);

      const effectiveId = getEffectiveCategoryId(t);

      if (effectiveId == null) {
        monthUncategorized.set(month, (monthUncategorized.get(month) ?? 0) + rubAmount);
        return;
      }

      if (excludedRootIds.has(getRootCategoryId(effectiveId))) return;

      if (!monthAmounts.has(month)) monthAmounts.set(month, new Map());
      const monthCats = monthAmounts.get(month)!;
      monthCats.set(effectiveId, (monthCats.get(effectiveId) ?? 0) + rubAmount);
    });

    const allMonths = new Set([...monthAmounts.keys(), ...monthUncategorized.keys()]);

    const toRows = (
      periodsSet: Set<string>,
      amountsMap: Map<string, Map<number, number>>,
      uncatMap: Map<string, number>,
    ): ExpenseRow[] =>
      Array.from(periodsSet)
        .sort((a, b) => a.localeCompare(b))
        .map((period) => {
          const catsMap = amountsMap.get(period);
          const categoryAmounts: Record<number, number> = {};
          let total = 0;
          catsMap?.forEach((amount, catId) => {
            categoryAmounts[catId] = amount;
            total += amount;
          });
          const uncategorizedAmount = uncatMap.get(period) ?? 0;
          total += uncategorizedAmount;
          return { period, categoryAmounts, total, uncategorizedAmount };
        });

    return {
      categories: expenseCategories,
      monthRows: toRows(allMonths, monthAmounts, monthUncategorized),
    };
  }

  private buildDividendRows(): DividendRow[] {
    return this.transactions$$()
      .filter((t) => t.kind === TransactionKind.INVEST_DIVIDEND)
      .map((t) => {
        const rates = this.getRatesForDate(t.dateISO);
        const usdRub = rates?.['RUB'] ? 1 / rates['RUB'] : undefined;
        const amountRub = this.convertNativeToRub(t.amount, t.accountId, rates, usdRub);
        return { dateISO: t.dateISO, amountRub };
      })
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }

  private buildPositionLotRows(): PositionLotRow[] {
    const trades = this.investAssetTrades$$();

    if (!trades.length) return [];

    const today = new Date();
    const currentMonthISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentDateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const groupMap = new Map<string, InvestAssetTrade[]>();
    trades.forEach((trade) => {
      if (!trade.assetId) return;
      const key = `${trade.accountId}:${trade.assetId}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(trade);
    });

    const result: PositionLotRow[] = [];

    groupMap.forEach((tradesInGroup) => {
      const buys = tradesInGroup
        .filter((t) => t.kind === TransactionKind.INVEST_BUY)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id - b.id);
      const sells = tradesInGroup
        .filter((t) => t.kind === TransactionKind.INVEST_SELL)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id - b.id);

      const firstTrade = tradesInGroup[0];
      const ticker = firstTrade.assetTicker ?? '?';

      const lotQueue = buys.map((trade) => {
        const details = this.parseDetails(trade.detailsJSON);
        const qty = this.toPositiveNumber(details?.quantity) ?? 0;
        const rates = this.getRatesForDate(trade.dateISO);
        const usdRub = rates?.['RUB'] ? 1 / rates['RUB'] : undefined;
        const amountRub = this.convertNativeToRub(trade.amount, trade.accountId, rates, usdRub);
        return { trade, qty, amountRub, remaining: qty };
      });

      sells.forEach((sell) => {
        const sellDetails = this.parseDetails(sell.detailsJSON);
        const sellQty = this.toPositiveNumber(sellDetails?.quantity) ?? 0;
        const sellRates = this.getRatesForDate(sell.dateISO);
        const sellUsdRub = sellRates?.['RUB'] ? 1 / sellRates['RUB'] : undefined;
        const sellAmountRub = this.convertNativeToRub(sell.amount, sell.accountId, sellRates, sellUsdRub);

        let remainingToMatch = sellQty;

        for (const lot of lotQueue) {
          if (remainingToMatch <= 0) break;
          if (lot.remaining <= 0) continue;

          const matchedQty = Math.min(lot.remaining, remainingToMatch);
          const costRub = lot.qty > 0 ? lot.amountRub * (matchedQty / lot.qty) : 0;
          const proceedsRub = sellQty > 0 ? sellAmountRub * (matchedQty / sellQty) : 0;

          const buyMonth = lot.trade.dateISO.substring(0, 7);
          const sellMonth = sell.dateISO.substring(0, 7);
          const openMonths = this.generateMonthRange(buyMonth, sellMonth);

          result.push({
            status: 'closed',
            assetType: firstTrade.assetType ?? null,
            buyDateISO: lot.trade.dateISO,
            sellDateISO: sell.dateISO,
            pnlRub: proceedsRub - costRub,
            openMonths,
          });

          lot.remaining -= matchedQty;
          remainingToMatch -= matchedQty;
        }
      });

      const currentRates = this.getRatesForDate(currentDateISO);
      const currentUsdRub = currentRates?.['RUB'] ? 1 / currentRates['RUB'] : undefined;

      lotQueue.forEach((lot) => {
        if (lot.remaining <= 0) return;

        const costRub = lot.qty > 0 ? lot.amountRub * (lot.remaining / lot.qty) : 0;

        let currentValueRub: number | null = null;
        if (currentRates && typeof currentUsdRub === 'number' && currentUsdRub > 0 && ticker !== '?') {
          const quoteUsd = currentRates[ticker];
          if (typeof quoteUsd === 'number' && quoteUsd > 0) {
            currentValueRub = lot.remaining * quoteUsd * currentUsdRub;
          }
        }

        const buyMonth = lot.trade.dateISO.substring(0, 7);
        const openMonths = this.generateMonthRange(buyMonth, currentMonthISO);

        result.push({
          status: 'open',
          assetType: firstTrade.assetType ?? null,
          buyDateISO: lot.trade.dateISO,
          sellDateISO: null,
          pnlRub: currentValueRub !== null ? currentValueRub - costRub : null,
          openMonths,
        });
      });
    });

    result.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'closed' ? -1 : 1;
      const dateA = a.sellDateISO ?? a.buyDateISO;
      const dateB = b.sellDateISO ?? b.buyDateISO;
      return dateB.localeCompare(dateA);
    });

    return result;
  }

  private generateMonthRange(fromMonthISO: string, toMonthISO: string): string[] {
    const months: string[] = [];
    const [fromYear, fromMonth] = fromMonthISO.split('-').map(Number);
    const [toYear, toMonth] = toMonthISO.split('-').map(Number);

    let year = fromYear;
    let month = fromMonth;

    while (year < toYear || (year === toYear && month <= toMonth)) {
      months.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return months;
  }
}
