import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VSlider, VSliderConfig, VSliderRangeValue } from '@ui-kit/components/v-slider/v-slider';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import { firstValueFrom } from 'rxjs';
import { MoneyService } from '../../services/money.service';
import { INCOME_CHART_ALLOWED_CATEGORIES, INCOME_VIRTUAL_SERIES } from '../../shared/chart-config';
import { convertAmount } from '../../shared/money-utils';
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
  accountContributions: Record<number, number>;
  accountSuspendedContributions: Record<number, number>;
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
    VSlider,
    VToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoneyScreen implements OnInit {
  protected readonly Icon = IconName;
  protected readonly MoneyTab = MoneyTab;
  protected readonly activeTab$$ = signal<MoneyTab>(MoneyTab.Transactions);

  private readonly moneyService = inject(MoneyService);
  private readonly sliderMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  private readonly currencies$$ = computed(() => this.moneyService.currencies$$());
  private readonly assets$$ = computed(() => this.moneyService.assets$$());
  private readonly transactions$$ = computed(() => this.moneyService.transactions$$());
  private readonly investAssetTrades$$ = computed(() => this.moneyService.investAssetTrades$$());
  private readonly categories$$ = computed(() => this.moneyService.categories$$());
  protected readonly isChartDataReady$$ = computed(
    () => this.moneyService.isChartDataReady$$() && !this.moneyService.isDisplayCurrencyChanging$$(),
  );
  private readonly fxTickers = new Set(['USD', 'EUR']);

  protected readonly displayCurrency$$ = computed(() => this.moneyService.displayCurrency$$());
  protected readonly displayCurrencySymbol$$ = computed(() => {
    const currency = this.moneyService.currencies$$().find((c) => c.ticker === this.displayCurrency$$());
    return currency?.symbol ?? '₽';
  });

  protected readonly currencyToggleItems: VToggleItem[] = [
    { id: 'RUB', label: '₽' },
    { id: 'USD', label: '$' },
    { id: 'EUR', label: '€' },
    { id: 'KZT', label: '₸' },
  ];

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

  protected readonly allChartMonths$$ = computed((): string[] => {
    const set = new Set<string>();
    this.balanceChartData$$().dates.forEach((d) => set.add(d.substring(0, 7)));
    this.incomeChartData$$().months.forEach((m) => set.add(m.substring(0, 7)));
    this.expenseChartData$$().monthRows.forEach((r) => set.add(r.period));
    return Array.from(set).sort();
  });

  private readonly rangeStartIdx$$ = computed((): number => {
    const months = this.allChartMonths$$();
    const saved = this.moneyService.chartRangeStart$$();
    if (!saved) return 0;
    const idx = months.indexOf(saved);
    return idx >= 0 ? idx : 0;
  });

  private readonly rangeEndIdx$$ = computed((): number => {
    const months = this.allChartMonths$$();
    const saved = this.moneyService.chartRangeEnd$$();
    if (!saved) return months.length > 0 ? months.length - 1 : 0;
    const idx = months.indexOf(saved);
    return idx >= 0 ? idx : months.length > 0 ? months.length - 1 : 0;
  });

  protected readonly sliderRange$$ = computed((): VSliderRangeValue => [this.rangeStartIdx$$(), this.rangeEndIdx$$()]);

  protected readonly chartRangeSliderConfig$$ = computed(
    (): VSliderConfig => ({
      isRange: true,
      min: 0,
      max: Math.max(0, this.allChartMonths$$().length - 1),
      valueList: this.allChartMonths$$().map((_, i) => i),
      thumbBorderRadius: 2,
    }),
  );

  protected readonly sliderStartLabel$$ = computed((): string =>
    this.formatSliderMonth(this.allChartMonths$$()[this.rangeStartIdx$$()]),
  );

  protected readonly sliderEndLabel$$ = computed((): string =>
    this.formatSliderMonth(this.allChartMonths$$()[this.rangeEndIdx$$()]),
  );

  protected readonly sliderRangeLabel$$ = computed((): string => {
    const total = this.rangeEndIdx$$() - this.rangeStartIdx$$() + 1;
    if (total <= 0) return '';
    const y = Math.floor(total / 12);
    const m = total % 12;
    const parts: string[] = [];
    if (y > 0) parts.push(`${y} yr${y > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} mo`);
    return parts.length > 0 ? parts.join(' ') : '1 mo';
  });

  protected readonly balanceChartDataClipped$$ = computed((): BalanceChartData => {
    const data = this.balanceChartData$$();
    const months = this.allChartMonths$$();
    const startIdx = this.rangeStartIdx$$();
    const endIdx = this.rangeEndIdx$$();
    if (startIdx === 0 && endIdx === months.length - 1) return data;
    const start = months[startIdx];
    const end = months[endIdx];
    const i0 = data.dates.findIndex((d) => d.substring(0, 7) >= start);
    let i1 = -1;
    for (let i = data.dates.length - 1; i >= 0; i--) {
      if (data.dates[i].substring(0, 7) <= end) {
        i1 = i;
        break;
      }
    }
    if (i0 < 0 || i1 < 0 || i0 > i1) return { dates: [], totals: [], accountSeries: [] };
    return {
      dates: data.dates.slice(i0, i1 + 1),
      totals: data.totals.slice(i0, i1 + 1),
      accountSeries: data.accountSeries.map((s) => ({
        ...s,
        values: s.values.slice(i0, i1 + 1),
        suspendedValues: s.suspendedValues.slice(i0, i1 + 1),
      })),
    };
  });

  protected readonly monthRangeForCharts$$ = computed((): [string, string] | null => {
    const months = this.allChartMonths$$();
    const startIdx = this.rangeStartIdx$$();
    const endIdx = this.rangeEndIdx$$();
    if (months.length === 0 || (startIdx === 0 && endIdx === months.length - 1)) return null;
    return [months[startIdx], months[endIdx]];
  });

  protected onChartRangeChange(range: VSliderRangeValue): void {
    const months = this.allChartMonths$$();
    const [startIdx, endIdx] = range;
    const isFullRange = startIdx === 0 && endIdx === months.length - 1;
    this.moneyService.setChartRange(
      isFullRange ? null : (months[startIdx] ?? null),
      isFullRange ? null : (months[endIdx] ?? null),
    );
  }

  protected setDisplayCurrency(id: string): void {
    if (!id || id === this.moneyService.displayCurrency$$()) return;
    if (this.moneyService.isDisplayCurrencyChanging$$()) return;
    this.moneyService.isDisplayCurrencyChanging$$.set(true);
    setTimeout(() => {
      this.moneyService.displayCurrency$$.set(id);
      localStorage.setItem('money_display_currency', id);
      setTimeout(() => this.moneyService.isDisplayCurrencyChanging$$.set(false), 0);
    }, 0);
  }

  public ngOnInit(): void {
    this.moneyService.resetLoadingState();
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
        accountSeriesMap.get(account.id)!.push(row.accountContributions[account.id] ?? 0);
        accountSuspendedSeriesMap.get(account.id)!.push(row.accountSuspendedContributions[account.id] ?? 0);
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

      const targetTicker = this.displayCurrency$$();
      const rates = this.moneyService.getRatesForDate(dateISO);

      const accountContributions: Record<number, number> = {};
      const accountSuspendedContributions: Record<number, number> = {};
      let total = 0;

      accounts.forEach((account) => {
        if (!account.id) return;

        if (this.isFxEquityAccount(account)) {
          const nativeAmount = fxInvestUnits.get(account.id) ?? 0;
          const fxTicker = this.getFxTickerForAccount(account.id);
          const targetAmount =
            fxTicker && rates ? convertAmount(nativeAmount, fxTicker, targetTicker, rates) : nativeAmount;
          accountContributions[account.id] = targetAmount;
          accountSuspendedContributions[account.id] = 0;
          total += targetAmount;
          return;
        }

        const amount = balances.get(account.id) ?? 0;
        const convertedBalance = this.convertNativeToTarget(amount, account.id, targetTicker, rates);
        total += convertedBalance;

        if (this.isBrokerAccount(account)) {
          const virtualValue = this.getBrokerVirtualValueForAccount(
            account.id,
            brokerUnitsByAsset,
            assetsById,
            targetTicker,
            rates,
          );
          const suspendedVirtualValue = this.getSuspendedBrokerVirtualValueForAccount(
            account.id,
            brokerUnitsByAsset,
            assetsById,
            assetSuspendedSince,
            dateISO,
            targetTicker,
            rates,
          );
          accountContributions[account.id] = convertedBalance + virtualValue;
          accountSuspendedContributions[account.id] = suspendedVirtualValue;
          total += virtualValue;
        } else {
          accountContributions[account.id] = convertedBalance;
          accountSuspendedContributions[account.id] = 0;
        }
      });

      rows.push({
        dateISO,
        total,
        accountContributions,
        accountSuspendedContributions,
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

  private getBrokerVirtualValueForAccount(
    accountId: number,
    brokerUnitsByAsset: Map<string, number>,
    assetsById: Map<number, string>,
    targetTicker: string,
    rates: Record<string, number> | null,
  ): number {
    if (!rates) return 0;

    let total = 0;
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

      total += convertAmount(units * quoteUsd, 'USD', targetTicker, rates);
    });

    return total;
  }

  private getSuspendedBrokerVirtualValueForAccount(
    accountId: number,
    brokerUnitsByAsset: Map<string, number>,
    assetsById: Map<number, string>,
    assetSuspendedSince: Map<number, string>,
    currentDateISO: string,
    targetTicker: string,
    rates: Record<string, number> | null,
  ): number {
    if (!rates) return 0;

    let total = 0;
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

      total += convertAmount(units * quoteUsd, 'USD', targetTicker, rates);
    });

    return total;
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

  private convertNativeToTarget(
    amount: number,
    accountId: number,
    targetTicker: string,
    rates: Record<string, number> | null,
  ): number {
    if (!rates) return amount;
    const currency = this.getCurrencyForAccount(accountId);
    if (!currency) return amount;
    return convertAmount(amount, currency.ticker, targetTicker, rates);
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
    const targetTicker = this.displayCurrency$$();

    incomeTransactions.forEach((t) => {
      const monthKey = t.dateISO.substring(0, 7);
      const monthIndex = monthIndexMap.get(monthKey);
      if (monthIndex === undefined) return;

      const rates = this.moneyService.getRatesForDate(t.dateISO);
      const targetAmount = this.convertNativeToTarget(t.amount, t.accountId, targetTicker, rates);

      const catId = t.categoryId ?? null;
      if (!categoryValues.has(catId)) {
        categoryValues.set(catId, new Array(months.length).fill(0));
      }
      categoryValues.get(catId)![monthIndex] += targetAmount;
    });

    const dividendValues = new Array(months.length).fill(0);
    dividendRows.forEach((row) => {
      const monthKey = row.dateISO.substring(0, 7);
      const idx = monthIndexMap.get(monthKey);
      if (idx !== undefined) dividendValues[idx] += row.amount;
    });

    const closedValues = new Array(months.length).fill(0);
    const cbOpenValues = new Array(months.length).fill(0);
    const cryptoClosedValues = new Array(months.length).fill(0);
    const cryptoOpenValues = new Array(months.length).fill(0);
    positionLotRows
      .filter((r) => r.pnl !== null)
      .forEach((row) => {
        const isCrypto = row.assetType === AssetType.CRYPTO;
        const perMonth = row.pnl! / row.openMonths.length;
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
    const targetTicker = this.displayCurrency$$();

    expenseTransactions.forEach((t) => {
      const rates = this.moneyService.getRatesForDate(t.dateISO);
      const targetAmount = this.convertNativeToTarget(t.amount, t.accountId, targetTicker, rates);

      const month = t.dateISO.substring(0, 7);

      const effectiveId = getEffectiveCategoryId(t);

      if (effectiveId == null) {
        monthUncategorized.set(month, (monthUncategorized.get(month) ?? 0) + targetAmount);
        return;
      }

      if (excludedRootIds.has(getRootCategoryId(effectiveId))) return;

      if (!monthAmounts.has(month)) monthAmounts.set(month, new Map());
      const monthCats = monthAmounts.get(month)!;
      monthCats.set(effectiveId, (monthCats.get(effectiveId) ?? 0) + targetAmount);
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
    const targetTicker = this.displayCurrency$$();
    return this.transactions$$()
      .filter((t) => t.kind === TransactionKind.INVEST_DIVIDEND)
      .map((t) => {
        const rates = this.moneyService.getRatesForDate(t.dateISO);
        const amount = this.convertNativeToTarget(t.amount, t.accountId, targetTicker, rates);
        return { dateISO: t.dateISO, amount };
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
    const targetTicker = this.displayCurrency$$();

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
        const rates = this.moneyService.getRatesForDate(trade.dateISO);
        const amount = this.convertNativeToTarget(trade.amount, trade.accountId, targetTicker, rates);
        return { trade, qty, amount, remaining: qty };
      });

      sells.forEach((sell) => {
        const sellDetails = this.parseDetails(sell.detailsJSON);
        const sellQty = this.toPositiveNumber(sellDetails?.quantity) ?? 0;
        const sellRates = this.moneyService.getRatesForDate(sell.dateISO);
        const sellAmount = this.convertNativeToTarget(sell.amount, sell.accountId, targetTicker, sellRates);

        let remainingToMatch = sellQty;

        for (const lot of lotQueue) {
          if (remainingToMatch <= 0) break;
          if (lot.remaining <= 0) continue;

          const matchedQty = Math.min(lot.remaining, remainingToMatch);
          const cost = lot.qty > 0 ? lot.amount * (matchedQty / lot.qty) : 0;
          const proceeds = sellQty > 0 ? sellAmount * (matchedQty / sellQty) : 0;

          const buyMonth = lot.trade.dateISO.substring(0, 7);
          const sellMonth = sell.dateISO.substring(0, 7);
          const openMonths = this.generateMonthRange(buyMonth, sellMonth);

          result.push({
            status: 'closed',
            assetType: firstTrade.assetType ?? null,
            buyDateISO: lot.trade.dateISO,
            sellDateISO: sell.dateISO,
            pnl: proceeds - cost,
            openMonths,
          });

          lot.remaining -= matchedQty;
          remainingToMatch -= matchedQty;
        }
      });

      const currentRates = this.moneyService.getRatesForDate(currentDateISO);

      lotQueue.forEach((lot) => {
        if (lot.remaining <= 0) return;

        const cost = lot.qty > 0 ? lot.amount * (lot.remaining / lot.qty) : 0;

        let currentValue: number | null = null;
        if (currentRates && ticker !== '?') {
          const quoteUsd = currentRates[ticker];
          if (typeof quoteUsd === 'number' && quoteUsd > 0) {
            currentValue = convertAmount(lot.remaining * quoteUsd, 'USD', targetTicker, currentRates);
          }
        }

        const buyMonth = lot.trade.dateISO.substring(0, 7);
        const openMonths = this.generateMonthRange(buyMonth, currentMonthISO);

        result.push({
          status: 'open',
          assetType: firstTrade.assetType ?? null,
          buyDateISO: lot.trade.dateISO,
          sellDateISO: null,
          pnl: currentValue !== null ? currentValue - cost : null,
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

  private formatSliderMonth(ym: string | undefined): string {
    if (!ym) return '';
    const [year, month] = ym.split('-').map(Number);
    return this.sliderMonthFormatter.format(new Date(year, month - 1, 1));
  }
}
