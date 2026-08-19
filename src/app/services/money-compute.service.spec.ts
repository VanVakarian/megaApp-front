import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Account,
  AccountKind,
  Asset,
  AssetType,
  Category,
  CategoryType,
  Currency,
  InvestAssetTrade,
  SymbolPosition,
  Transaction,
  TransactionKind,
} from '@app/shared/types';
import { createPerformanceMetricsFake } from '@app/testing/performance-metrics.fake';
import { MoneyComputeService } from './money-compute.service';
import { MoneyService } from './money.service';
import { PerformanceMetricsService } from './performance-metrics.service';

interface MoneyServiceFakeInput {
  transactions?: Transaction[];
  accounts?: Account[];
  currencies?: Currency[];
  categories?: Category[];
  assets?: Asset[];
  investAssetTrades?: InvestAssetTrade[];
  displayCurrency?: string;
  rates?: Record<string, number> | null;
}

function createMoneyServiceFake(input: MoneyServiceFakeInput = {}) {
  const fake = {
    transactions$$: signal(input.transactions ?? []),
    accounts$$: signal(input.accounts ?? []),
    currencies$$: signal(input.currencies ?? []),
    categories$$: signal(input.categories ?? []),
    assets$$: signal(input.assets ?? []),
    investAssetTrades$$: signal(input.investAssetTrades ?? []),
    displayCurrency$$: signal(input.displayCurrency ?? 'RUB'),
    getRatesForDate: (_dateISO: string) => input.rates ?? null,
  };
  return fake as unknown as MoneyService;
}

function setup(input: MoneyServiceFakeInput = {}): MoneyComputeService {
  TestBed.configureTestingModule({
    providers: [
      { provide: MoneyService, useValue: createMoneyServiceFake(input) },
      { provide: PerformanceMetricsService, useValue: createPerformanceMetricsFake() },
    ],
  });
  return TestBed.inject(MoneyComputeService);
}

const RUB: Currency = {
  id: 1,
  title: 'Рубль',
  ticker: 'RUB',
  symbol: '₽',
  symbolPosEnum: SymbolPosition.AFTER,
  whitespace: true,
};

function account(overrides: Partial<Account>): Account {
  return {
    id: 1,
    title: 'Cash',
    currencyId: 1,
    isInvest: false,
    isArchived: false,
    kind: AccountKind.CASH,
    ...overrides,
  };
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    dateISO: '2026-01-15',
    accountId: 1,
    amount: 100,
    kind: TransactionKind.EXPENSE,
    isGift: false,
    ...overrides,
  };
}

describe('MoneyComputeService.balanceChartData$$', () => {
  it('returns empty chart data when there are no accounts', () => {
    const service = setup({ accounts: [] });
    expect(service.balanceChartData$$()).toEqual({ dates: [], totals: [], accountSeries: [] });
  });

  it('accumulates cash balance across months from income/expense transactions', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      transactions: [
        tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.INCOME, amount: 1000, isGift: false }),
        tx({ id: 2, dateISO: '2026-01-20', kind: TransactionKind.EXPENSE, amount: 300 }),
        tx({ id: 3, dateISO: '2026-02-05', kind: TransactionKind.EXPENSE, amount: 200 }),
      ],
    });
    const result = service.balanceChartData$$();
    expect(result.dates).toEqual(['2026-01-31', '2026-02-28']);
    expect(result.totals).toEqual([700, 500]);
    expect(result.accountSeries).toEqual([
      { accountId: 1, accountTitle: 'Cash', values: [700, 500], suspendedValues: [0, 0], isSuspended: false },
    ]);
  });

  it('excludes an account whose balance stays zero across every month', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 }), account({ id: 2, title: 'Untouched' })],
      transactions: [tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.INCOME, amount: 500 })],
    });
    const result = service.balanceChartData$$();
    expect(result.accountSeries.map((s) => s.accountId)).toEqual([1]);
  });

  it('tracks an FX-invest cash account via transfer deltas only, not via all cash-delta transaction kinds', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1, isInvest: true, kind: AccountKind.CASH })],
      transactions: [
        tx({
          id: 1,
          dateISO: '2026-01-10',
          kind: TransactionKind.TRANSFER,
          amount: 1000,
          detailsJSON: { direction: 'in' },
        }),
      ],
    });
    const result = service.balanceChartData$$();
    expect(result.accountSeries).toEqual([
      { accountId: 1, accountTitle: 'Cash', values: [1000], suspendedValues: [0], isSuspended: false },
    ]);
  });

  it('splits a brokerage account value into total (all positions) and suspended-only subset', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1, kind: AccountKind.BROKERAGE })],
      assets: [
        { id: 10, title: 'Active Co', ticker: 'ACT', type: AssetType.STOCK, accountIds: [1] },
        {
          id: 20,
          title: 'Frozen Co',
          ticker: 'FRZ',
          type: AssetType.STOCK,
          accountIds: [1],
          suspendedSince: '2026-01-01',
        },
      ],
      transactions: [
        tx({
          id: 1,
          dateISO: '2026-01-05',
          kind: TransactionKind.INVEST_BUY,
          amount: 100,
          detailsJSON: { assetId: 10, quantity: 5 },
        }),
        tx({
          id: 2,
          dateISO: '2026-01-06',
          kind: TransactionKind.INVEST_BUY,
          amount: 100,
          detailsJSON: { assetId: 20, quantity: 3 },
        }),
      ],
      rates: { ACT: 10, FRZ: 20 },
    });
    const result = service.balanceChartData$$();
    const series = result.accountSeries[0];
    // cash spent buying = -100 -100 = -200; ACT position = 5*10 = 50; FRZ position = 3*20 = 60
    expect(series.values[0]).toBe(-200 + 50 + 60);
    expect(series.suspendedValues[0]).toBe(60);
    expect(series.isSuspended).toBe(true);
  });
});

describe('MoneyComputeService.expenseChartData$$', () => {
  it('returns empty chart data when there are no expense transactions', () => {
    const service = setup({ currencies: [RUB], accounts: [account({ id: 1 })], transactions: [] });
    expect(service.expenseChartData$$()).toEqual({ categories: [], monthRows: [] });
  });

  it('keeps uncategorized expenses out of categoryAmounts but folded into the month total', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      transactions: [
        tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.EXPENSE, amount: 150, categoryId: null }),
      ],
    });
    const result = service.expenseChartData$$();
    expect(result.categories).toEqual([]);
    expect(result.monthRows).toEqual([
      { period: '2026-01', categoryAmounts: {}, total: 150, uncategorizedAmount: 150 },
    ]);
  });

  it('excludes an entire category subtree rooted at an excluded name (e.g. Налог)', () => {
    const categories: Category[] = [
      { id: 1, name: 'Налог', categoryType: CategoryType.EXPENSE, parentId: null },
      { id: 2, name: 'НДФЛ', categoryType: CategoryType.EXPENSE, parentId: 1 },
      { id: 3, name: 'Еда', categoryType: CategoryType.EXPENSE, parentId: null },
    ];
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      categories,
      transactions: [
        tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.EXPENSE, amount: 500, categoryId: 2 }),
        tx({ id: 2, dateISO: '2026-01-11', kind: TransactionKind.EXPENSE, amount: 200, categoryId: 3 }),
      ],
    });
    const result = service.expenseChartData$$();
    expect(result.categories).toEqual([{ id: 3, name: 'Еда' }]);
    expect(result.monthRows).toEqual([
      { period: '2026-01', categoryAmounts: { 3: 200 }, total: 200, uncategorizedAmount: 0 },
    ]);
  });

  it('redirects gift expenses to the "Подарок" category regardless of their original category', () => {
    const categories: Category[] = [
      { id: 1, name: 'Подарок', categoryType: CategoryType.EXPENSE, parentId: null },
      { id: 2, name: 'Еда', categoryType: CategoryType.EXPENSE, parentId: null },
    ];
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      categories,
      transactions: [
        tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.EXPENSE, amount: 300, categoryId: 2, isGift: true }),
      ],
    });
    const result = service.expenseChartData$$();
    expect(result.categories).toEqual([{ id: 1, name: 'Подарок' }]);
    expect(result.monthRows[0].categoryAmounts).toEqual({ 1: 300 });
  });
});

describe('MoneyComputeService.incomeChartData$$', () => {
  it('only includes income categories on the allow-list', () => {
    const categories: Category[] = [
      { id: 1, name: 'Зарплата', categoryType: CategoryType.INCOME, parentId: null },
      { id: 2, name: 'Возврат долга', categoryType: CategoryType.INCOME, parentId: null },
    ];
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      categories,
      transactions: [
        tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.INCOME, amount: 1000, categoryId: 1 }),
        tx({ id: 2, dateISO: '2026-01-11', kind: TransactionKind.INCOME, amount: 500, categoryId: 2 }),
      ],
    });
    const result = service.incomeChartData$$();
    const names = result.categorySeries.map((s) => s.categoryName);
    expect(names).toContain('Зарплата');
    expect(names).not.toContain('Возврат долга');
  });

  it('always includes a Дивиденды series, even when it is all zero', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1 })],
      categories: [{ id: 1, name: 'Зарплата', categoryType: CategoryType.INCOME, parentId: null }],
      transactions: [tx({ id: 1, dateISO: '2026-01-10', kind: TransactionKind.INCOME, amount: 1000, categoryId: 1 })],
    });
    const result = service.incomeChartData$$();
    const dividends = result.categorySeries.find((s) => s.categoryName === 'Дивиденды');
    expect(dividends).toBeDefined();
    expect(dividends!.values.every((v) => v === 0)).toBe(true);
  });

  it('splits FIFO-matched sell PnL proportionally across the matched buy lots', () => {
    const service = setup({
      currencies: [RUB],
      accounts: [account({ id: 1, kind: AccountKind.BROKERAGE })],
      investAssetTrades: [
        {
          id: 1,
          dateISO: '2026-01-05',
          accountId: 1,
          amount: 1000,
          kind: TransactionKind.INVEST_BUY,
          assetId: 10,
          assetTicker: 'ACT',
          assetType: AssetType.STOCK,
          detailsJSON: { assetId: 10, quantity: 10 },
        },
        {
          id: 2,
          dateISO: '2026-02-05',
          accountId: 1,
          amount: 1200,
          kind: TransactionKind.INVEST_BUY,
          assetId: 10,
          assetTicker: 'ACT',
          assetType: AssetType.STOCK,
          detailsJSON: { assetId: 10, quantity: 10 },
        },
        {
          id: 3,
          dateISO: '2026-03-05',
          accountId: 1,
          amount: 1800,
          kind: TransactionKind.INVEST_SELL,
          assetId: 10,
          assetTicker: 'ACT',
          assetType: AssetType.STOCK,
          detailsJSON: { assetId: 10, quantity: 15 },
        },
      ],
    });
    const result = service.incomeChartData$$();
    const closedPnl = result.categorySeries.find((s) => s.categoryName === 'ЦБ закрытые');
    expect(closedPnl).toBeDefined();
    // lot1 (10@1000) fully consumed: cost=1000, proceeds=1800*10/15=1200 -> pnl=200, spread over Jan-Mar (3 months)
    // lot2 (10@1200) partially consumed for 5 units: cost=1200*5/10=600, proceeds=1800*5/15=600 -> pnl=0
    const total = closedPnl!.values.reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(200, 5);
  });
});
