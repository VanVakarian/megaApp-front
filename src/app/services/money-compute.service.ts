import { Injectable, Signal, computed, inject } from '@angular/core';
import { INCOME_CHART_ALLOWED_CATEGORIES, INCOME_VIRTUAL_SERIES } from '../shared/chart-config';
import { convertAmount } from '../shared/money-utils';
import {
  Account,
  AssetType,
  BalanceChartAccountSeries,
  BalanceChartData,
  Category,
  Currency,
  ExpenseCategory,
  ExpenseChartData,
  IncomeChartData,
  InvestAssetTrade,
  PositionLotRow,
  Transaction,
  TransactionKind,
} from '../shared/types';
import { MoneyService } from './money.service';

interface MonthlyBuckets {
  accountDelta: Record<string, Record<number, number>>;
  fxInvestDelta: Record<string, Record<number, number>>;
  brokerDelta: Record<string, Record<string, number>>;
  income: Record<string, Record<number, Record<number, number>>>;
  expense: Record<string, Record<number, Record<number, number>>>;
  dividends: Record<string, Record<number, number>>;
}

@Injectable({ providedIn: 'root' })
export class MoneyComputeService {
  private readonly moneyService = inject(MoneyService);
  private readonly fxTickers = new Set(['USD', 'EUR']);

  private readonly monthlyBuckets$$: Signal<MonthlyBuckets> = computed(() =>
    this.buildBuckets(
      this.moneyService.transactions$$(),
      this.moneyService.accounts$$(),
      this.moneyService.currencies$$(),
      this.moneyService.categories$$(),
    ),
  );

  private readonly positionLotRows$$: Signal<PositionLotRow[]> = computed(() =>
    this.buildPositionLotRows(
      this.moneyService.investAssetTrades$$(),
      this.moneyService.accounts$$(),
      this.moneyService.currencies$$(),
      this.moneyService.displayCurrency$$(),
    ),
  );

  public readonly balanceChartData$$: Signal<BalanceChartData> = computed(() => this.buildBalanceChartData());

  public readonly incomeChartData$$: Signal<IncomeChartData> = computed(() => this.buildIncomeChartData());

  public readonly expenseChartData$$: Signal<ExpenseChartData> = computed(() => this.buildExpenseChartData());

  // ── Bucket builder ────────────────────────────────────────────────────────

  private buildBuckets(
    transactions: Transaction[],
    accounts: Account[],
    currencies: Currency[],
    categories: Category[],
  ): MonthlyBuckets {
    const buckets: MonthlyBuckets = {
      accountDelta: {},
      fxInvestDelta: {},
      brokerDelta: {},
      income: {},
      expense: {},
      dividends: {},
    };

    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const fxInvestAccountIds = new Set<number>();
    accounts.forEach((a) => {
      if (!a.id || a.kind !== 'cash' || !a.isInvest) return;
      const currency = currencyById.get(a.currencyId);
      if (currency && this.fxTickers.has(currency.ticker)) fxInvestAccountIds.add(a.id);
    });

    const giftCategoryId = categories.find((c) => c.name === 'Подарок')?.id ?? null;

    for (const tx of transactions) {
      const { accountId, amount, kind } = tx;
      const month = tx.dateISO.substring(0, 7);

      const cashDelta = this.getTxCashDelta(tx);
      if (cashDelta !== 0) {
        buckets.accountDelta[month] ??= {};
        buckets.accountDelta[month][accountId] = (buckets.accountDelta[month][accountId] ?? 0) + cashDelta;
      }

      if (fxInvestAccountIds.has(accountId) && kind === TransactionKind.TRANSFER && cashDelta !== 0) {
        buckets.fxInvestDelta[month] ??= {};
        buckets.fxInvestDelta[month][accountId] = (buckets.fxInvestDelta[month][accountId] ?? 0) + cashDelta;
      }

      if (kind === TransactionKind.INVEST_BUY || kind === TransactionKind.INVEST_SELL) {
        const details = this.parseDetails(tx.detailsJSON);
        const assetId = this.toPositiveNumber(details?.assetId);
        const quantity = this.toPositiveNumber(details?.quantity);
        if (assetId != null && quantity != null) {
          const key = `${accountId}:${assetId}`;
          buckets.brokerDelta[month] ??= {};
          buckets.brokerDelta[month][key] =
            (buckets.brokerDelta[month][key] ?? 0) + (kind === TransactionKind.INVEST_BUY ? quantity : -quantity);
        }
      }

      if (kind === TransactionKind.INCOME && !tx.isGift) {
        const catId = tx.categoryId ?? -1;
        buckets.income[month] ??= {};
        buckets.income[month][accountId] ??= {};
        buckets.income[month][accountId][catId] = (buckets.income[month][accountId][catId] ?? 0) + amount;
      }

      if (kind === TransactionKind.EXPENSE) {
        const catId = tx.isGift && giftCategoryId != null ? giftCategoryId : (tx.categoryId ?? -1);
        buckets.expense[month] ??= {};
        buckets.expense[month][accountId] ??= {};
        buckets.expense[month][accountId][catId] = (buckets.expense[month][accountId][catId] ?? 0) + amount;
      }

      if (kind === TransactionKind.INVEST_DIVIDEND) {
        buckets.dividends[month] ??= {};
        buckets.dividends[month][accountId] = (buckets.dividends[month][accountId] ?? 0) + amount;
      }
    }

    return buckets;
  }

  // ── Balance chart ─────────────────────────────────────────────────────────

  private buildBalanceChartData(): BalanceChartData {
    const buckets = this.monthlyBuckets$$();
    const accounts = this.moneyService.accounts$$();
    const assets = this.moneyService.assets$$();
    const currencies = this.moneyService.currencies$$();
    const targetTicker = this.moneyService.displayCurrency$$();

    if (!accounts.length) return { dates: [], totals: [], accountSeries: [] };

    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const accountCurrencyTicker = new Map<number, string>();
    const fxInvestAccountIds = new Set<number>();
    accounts.forEach((a) => {
      if (!a.id) return;
      const currency = currencyById.get(a.currencyId);
      if (currency) accountCurrencyTicker.set(a.id, currency.ticker);
      if (a.kind === 'cash' && a.isInvest && currency && this.fxTickers.has(currency.ticker)) {
        fxInvestAccountIds.add(a.id);
      }
    });

    const assetSuspendedSince = new Map<number, string>();
    const assetsById = new Map<number, string>();
    const suspendedAccountIds = new Set<number>();
    assets.forEach((asset) => {
      if (!asset.id) return;
      assetsById.set(asset.id, asset.ticker);
      if (asset.suspendedSince) {
        assetSuspendedSince.set(asset.id, asset.suspendedSince);
        asset.accountIds.forEach((id) => suspendedAccountIds.add(id));
      }
    });

    const allMonthsSet = new Set<string>([
      ...Object.keys(buckets.accountDelta),
      ...Object.keys(buckets.fxInvestDelta),
      ...Object.keys(buckets.brokerDelta),
    ]);
    if (!allMonthsSet.size) return { dates: [], totals: [], accountSeries: [] };

    const months = this.expandMonthRange(Array.from(allMonthsSet).sort());

    const cumulativeBalance = new Map<number, number>();
    const cumulativeFxInvest = new Map<number, number>();
    const cumulativeBrokerQty = new Map<string, number>();
    accounts.forEach((a) => {
      if (a.id) cumulativeBalance.set(a.id, 0);
    });

    const seriesMap = new Map<number, { values: number[]; suspendedValues: number[] }>();
    accounts.forEach((a) => {
      if (a.id) seriesMap.set(a.id, { values: [], suspendedValues: [] });
    });

    const dates: string[] = [];
    const totals: number[] = [];

    for (const monthKey of months) {
      const [yr, mo] = monthKey.split('-').map(Number);
      const eomDay = new Date(yr, mo, 0).getDate();
      const eomISO = `${yr}-${String(mo).padStart(2, '0')}-${String(eomDay).padStart(2, '0')}`;

      for (const [idStr, delta] of Object.entries(buckets.accountDelta[monthKey] ?? {})) {
        const id = Number(idStr);
        cumulativeBalance.set(id, (cumulativeBalance.get(id) ?? 0) + delta);
      }
      for (const [idStr, delta] of Object.entries(buckets.fxInvestDelta[monthKey] ?? {})) {
        const id = Number(idStr);
        cumulativeFxInvest.set(id, (cumulativeFxInvest.get(id) ?? 0) + delta);
      }
      for (const [key, qty] of Object.entries(buckets.brokerDelta[monthKey] ?? {})) {
        cumulativeBrokerQty.set(key, (cumulativeBrokerQty.get(key) ?? 0) + qty);
      }

      const rates = this.moneyService.getRatesForDate(eomISO);
      let total = 0;

      for (const account of accounts) {
        if (!account.id) continue;
        const series = seriesMap.get(account.id)!;
        const currencyTicker = accountCurrencyTicker.get(account.id);

        if (fxInvestAccountIds.has(account.id)) {
          const nativeAmt = cumulativeFxInvest.get(account.id) ?? 0;
          const converted =
            currencyTicker && rates ? convertAmount(nativeAmt, currencyTicker, targetTicker, rates) : nativeAmt;
          series.values.push(converted);
          series.suspendedValues.push(0);
          total += converted;
          continue;
        }

        const isBroker = account.kind === 'brokerage' || account.kind === 'crypto';
        const cashBalance = cumulativeBalance.get(account.id) ?? 0;
        const convertedCash =
          currencyTicker && rates ? convertAmount(cashBalance, currencyTicker, targetTicker, rates) : cashBalance;
        total += convertedCash;

        if (isBroker) {
          const virtualValue = this.sumBrokerPositions(
            account.id,
            cumulativeBrokerQty,
            assetsById,
            targetTicker,
            rates,
            null,
            eomISO,
          );
          const suspendedValue = this.sumBrokerPositions(
            account.id,
            cumulativeBrokerQty,
            assetsById,
            targetTicker,
            rates,
            assetSuspendedSince,
            eomISO,
          );
          series.values.push(convertedCash + virtualValue);
          series.suspendedValues.push(suspendedValue);
          total += virtualValue;
        } else {
          series.values.push(convertedCash);
          series.suspendedValues.push(0);
        }
      }

      dates.push(eomISO);
      totals.push(total);
    }

    const accountSeries: BalanceChartAccountSeries[] = [];
    for (const account of accounts) {
      if (!account.id) continue;
      const series = seriesMap.get(account.id)!;
      if (!series.values.some((v) => v !== 0)) continue;
      accountSeries.push({
        accountId: account.id,
        accountTitle: account.title,
        values: series.values,
        suspendedValues: series.suspendedValues,
        isSuspended: suspendedAccountIds.has(account.id),
      });
    }

    return { dates, totals, accountSeries };
  }

  private sumBrokerPositions(
    accountId: number,
    cumulativeBrokerQty: Map<string, number>,
    assetsById: Map<number, string>,
    targetTicker: string,
    rates: Record<string, number> | null,
    suspendedSinceMap: Map<number, string> | null,
    currentDateISO: string,
  ): number {
    if (!rates) return 0;
    let total = 0;
    cumulativeBrokerQty.forEach((units, key) => {
      if (units <= 0) return;
      const colonIdx = key.indexOf(':');
      if (Number(key.substring(0, colonIdx)) !== accountId) return;
      const assetId = Number(key.substring(colonIdx + 1));
      if (suspendedSinceMap != null) {
        const suspendedSince = suspendedSinceMap.get(assetId);
        if (!suspendedSince || currentDateISO < suspendedSince) return;
      }
      const ticker = assetsById.get(assetId);
      if (!ticker) return;
      const quoteUsd = rates[ticker];
      if (typeof quoteUsd !== 'number' || quoteUsd <= 0) return;
      total += convertAmount(units * quoteUsd, 'USD', targetTicker, rates);
    });
    return total;
  }

  // ── Income chart ──────────────────────────────────────────────────────────

  private buildIncomeChartData(): IncomeChartData {
    const buckets = this.monthlyBuckets$$();
    const positionLotRows = this.positionLotRows$$();
    const categories = this.moneyService.categories$$();
    const accounts = this.moneyService.accounts$$();
    const currencies = this.moneyService.currencies$$();
    const targetTicker = this.moneyService.displayCurrency$$();

    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const accountCurrencyTicker = new Map<number, string>();
    accounts.forEach((a) => {
      if (!a.id) return;
      const currency = currencyById.get(a.currencyId);
      if (currency) accountCurrencyTicker.set(a.id, currency.ticker);
    });

    const allowedCategoryIds = new Set(
      categories.filter((c) => c.id !== undefined && INCOME_CHART_ALLOWED_CATEGORIES.has(c.name)).map((c) => c.id!),
    );

    const today = new Date();
    const currentMonthISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const allMonthsSet = new Set<string>();
    Object.keys(buckets.income).forEach((m) => allMonthsSet.add(m));
    Object.keys(buckets.dividends).forEach((m) => allMonthsSet.add(m));
    positionLotRows.forEach((r) => r.openMonths.forEach((m) => allMonthsSet.add(m)));
    if (positionLotRows.some((r) => r.status === 'open')) allMonthsSet.add(currentMonthISO);

    if (!allMonthsSet.size) return { months: [], categorySeries: [] };

    const sortedMonths = Array.from(allMonthsSet).sort();
    const months = this.generateEomDates(sortedMonths[0], sortedMonths[sortedMonths.length - 1]);
    const monthIndexMap = new Map<string, number>(months.map((m, i) => [m.substring(0, 7), i]));

    const categoryValues = new Map<number, number[]>();

    for (const [monthKey, accountMap] of Object.entries(buckets.income)) {
      const monthIdx = monthIndexMap.get(monthKey);
      if (monthIdx === undefined) continue;
      const rates = this.moneyService.getRatesForDate(months[monthIdx]);

      for (const [accountIdStr, catMap] of Object.entries(accountMap)) {
        const accountId = Number(accountIdStr);
        const currencyTicker = accountCurrencyTicker.get(accountId);

        for (const [catIdStr, nativeAmt] of Object.entries(catMap)) {
          const catId = Number(catIdStr);
          if (catId === -1 || !allowedCategoryIds.has(catId)) continue;

          const converted =
            currencyTicker && rates ? convertAmount(nativeAmt, currencyTicker, targetTicker, rates) : nativeAmt;

          if (!categoryValues.has(catId)) categoryValues.set(catId, new Array(months.length).fill(0));
          categoryValues.get(catId)![monthIdx] += converted;
        }
      }
    }

    const dividendValues = new Array(months.length).fill(0);
    for (const [monthKey, accountMap] of Object.entries(buckets.dividends)) {
      const monthIdx = monthIndexMap.get(monthKey);
      if (monthIdx === undefined) continue;
      const rates = this.moneyService.getRatesForDate(months[monthIdx]);

      for (const [accountIdStr, nativeAmt] of Object.entries(accountMap)) {
        const accountId = Number(accountIdStr);
        const currencyTicker = accountCurrencyTicker.get(accountId);
        const converted =
          currencyTicker && rates ? convertAmount(nativeAmt, currencyTicker, targetTicker, rates) : nativeAmt;
        dividendValues[monthIdx] += converted;
      }
    }

    const closedValues = new Array(months.length).fill(0);
    const cbOpenValues = new Array(months.length).fill(0);
    const cryptoClosedValues = new Array(months.length).fill(0);
    const cryptoOpenValues = new Array(months.length).fill(0);

    positionLotRows
      .filter((r) => r.pnl !== null)
      .forEach((row) => {
        const isCrypto = row.assetType === AssetType.CRYPTO;
        const perMonth = row.pnl! / row.openMonths.length;
        const target =
          row.status === 'closed'
            ? isCrypto
              ? cryptoClosedValues
              : closedValues
            : isCrypto
              ? cryptoOpenValues
              : cbOpenValues;
        row.openMonths.forEach((monthKey) => {
          const idx = monthIndexMap.get(monthKey);
          if (idx !== undefined) target[idx] += perMonth;
        });
      });

    const categorySeries = Array.from(categoryValues.entries()).map(([catId, values]) => ({
      categoryId: catId,
      categoryName: categories.find((c) => c.id === catId)?.name ?? 'Other',
      values,
    }));

    categorySeries.push({
      categoryId: INCOME_VIRTUAL_SERIES.DIVIDENDS,
      categoryName: 'Дивиденды',
      values: dividendValues,
    });

    const pushIfNonZero = (categoryId: number, categoryName: string, values: number[]) => {
      if (values.some((v) => v !== 0)) categorySeries.push({ categoryId, categoryName, values });
    };
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CB_CLOSED_PNL, 'ЦБ закрытые', closedValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CB_OPEN_PNL, 'ЦБ открытые', cbOpenValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CRYPTO_CLOSED_PNL, 'Крипта закрытые', cryptoClosedValues);
    pushIfNonZero(INCOME_VIRTUAL_SERIES.CRYPTO_OPEN_PNL, 'Крипта открытые', cryptoOpenValues);

    const seriesOrder = new Map([
      ['Зарплата', 0],
      ['Проекты', 1],
      ['Проценты', 2],
      ['Дивиденды', 3],
      ['ЦБ закрытые', 4],
      ['ЦБ открытые', 5],
      ['Крипта закрытые', 6],
      ['Крипта открытые', 7],
    ]);
    categorySeries.sort((a, b) => (seriesOrder.get(a.categoryName) ?? 99) - (seriesOrder.get(b.categoryName) ?? 99));

    return { months, categorySeries };
  }

  // ── Expense chart ─────────────────────────────────────────────────────────

  private buildExpenseChartData(): ExpenseChartData {
    const buckets = this.monthlyBuckets$$();
    const categories = this.moneyService.categories$$();
    const accounts = this.moneyService.accounts$$();
    const currencies = this.moneyService.currencies$$();
    const targetTicker = this.moneyService.displayCurrency$$();

    if (!Object.keys(buckets.expense).length) return { categories: [], monthRows: [] };

    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const accountCurrencyTicker = new Map<number, string>();
    accounts.forEach((a) => {
      if (!a.id) return;
      const currency = currencyById.get(a.currencyId);
      if (currency) accountCurrencyTicker.set(a.id, currency.ticker);
    });

    const categoryMap = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id != null) categoryMap.set(c.id, c);
    });

    const EXCLUDED_NAMES = new Set(['Налог', 'Комиссии', 'Технический гэп']);
    const excludedRootIds = new Set<number>();
    categories.forEach((c) => {
      if (c.id != null && !c.parentId && EXCLUDED_NAMES.has(c.name)) excludedRootIds.add(c.id);
    });

    const getRootCategoryId = (catId: number): number => {
      const cat = categoryMap.get(catId);
      if (!cat || !cat.parentId) return catId;
      return getRootCategoryId(cat.parentId);
    };

    const uniqueDisplayCategoryIds = new Set<number>();
    const monthAmounts = new Map<string, Map<number, number>>();
    const monthUncategorized = new Map<string, number>();

    for (const [monthKey, accountMap] of Object.entries(buckets.expense)) {
      const rates = this.moneyService.getRatesForDate(this.toEomISO(monthKey));

      for (const [accountIdStr, catMap] of Object.entries(accountMap)) {
        const accountId = Number(accountIdStr);
        const currencyTicker = accountCurrencyTicker.get(accountId);

        for (const [catIdStr, nativeAmt] of Object.entries(catMap)) {
          const catId = Number(catIdStr);
          const converted =
            currencyTicker && rates ? convertAmount(nativeAmt, currencyTicker, targetTicker, rates) : nativeAmt;

          if (catId === -1) {
            monthUncategorized.set(monthKey, (monthUncategorized.get(monthKey) ?? 0) + converted);
            continue;
          }
          if (excludedRootIds.has(getRootCategoryId(catId))) continue;

          uniqueDisplayCategoryIds.add(catId);
          if (!monthAmounts.has(monthKey)) monthAmounts.set(monthKey, new Map());
          const monthCats = monthAmounts.get(monthKey)!;
          monthCats.set(catId, (monthCats.get(catId) ?? 0) + converted);
        }
      }
    }

    const expenseCategories: ExpenseCategory[] = Array.from(uniqueDisplayCategoryIds)
      .map((id) => ({ id, name: categoryMap.get(id)?.name ?? 'Other' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const allMonths = new Set([...monthAmounts.keys(), ...monthUncategorized.keys()]);
    const monthRows = Array.from(allMonths)
      .sort()
      .map((period) => {
        const catsMap = monthAmounts.get(period);
        const categoryAmounts: Record<number, number> = {};
        let total = 0;
        catsMap?.forEach((amount, catId) => {
          categoryAmounts[catId] = amount;
          total += amount;
        });
        const uncategorizedAmount = monthUncategorized.get(period) ?? 0;
        total += uncategorizedAmount;
        return { period, categoryAmounts, total, uncategorizedAmount };
      });

    return { categories: expenseCategories, monthRows };
  }

  // ── FIFO position lots ────────────────────────────────────────────────────

  private buildPositionLotRows(
    trades: InvestAssetTrade[],
    accounts: Account[],
    currencies: Currency[],
    targetTicker: string,
  ): PositionLotRow[] {
    if (!trades.length) return [];

    const currencyById = new Map(currencies.map((c) => [c.id, c]));
    const accountCurrencyTicker = new Map<number, string>();
    accounts.forEach((a) => {
      if (!a.id) return;
      const currency = currencyById.get(a.currencyId);
      if (currency) accountCurrencyTicker.set(a.id, currency.ticker);
    });

    const today = new Date();
    const currentMonthISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentDateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const groupMap = new Map<string, InvestAssetTrade[]>();
    trades.forEach((trade) => {
      if (!trade.assetId) return;
      const key = `${trade.accountId}:${trade.assetId}`;
      (groupMap.get(key) ?? groupMap.set(key, []).get(key)!).push(trade);
    });

    const result: PositionLotRow[] = [];
    const currentRates = this.moneyService.getRatesForDate(currentDateISO);

    groupMap.forEach((tradesInGroup) => {
      const firstTrade = tradesInGroup[0];
      const ticker = firstTrade.assetTicker ?? '?';
      const currencyTicker = accountCurrencyTicker.get(firstTrade.accountId);

      const buys = tradesInGroup
        .filter((t) => t.kind === TransactionKind.INVEST_BUY)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id - b.id);
      const sells = tradesInGroup
        .filter((t) => t.kind === TransactionKind.INVEST_SELL)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id - b.id);

      const lotQueue = buys.map((trade) => {
        const details = this.parseDetails(trade.detailsJSON);
        const qty = this.toPositiveNumber(details?.quantity) ?? 0;
        const rates = this.moneyService.getRatesForDate(trade.dateISO);
        const amount =
          currencyTicker && rates ? convertAmount(trade.amount, currencyTicker, targetTicker, rates) : trade.amount;
        return { trade, qty, amount, remaining: qty };
      });

      for (const sell of sells) {
        const sellDetails = this.parseDetails(sell.detailsJSON);
        const sellQty = this.toPositiveNumber(sellDetails?.quantity) ?? 0;
        const sellRates = this.moneyService.getRatesForDate(sell.dateISO);
        const sellAmount =
          currencyTicker && sellRates
            ? convertAmount(sell.amount, currencyTicker, targetTicker, sellRates)
            : sell.amount;

        let remainingToMatch = sellQty;
        for (const lot of lotQueue) {
          if (remainingToMatch <= 0) break;
          if (lot.remaining <= 0) continue;

          const matchedQty = Math.min(lot.remaining, remainingToMatch);
          const cost = lot.qty > 0 ? lot.amount * (matchedQty / lot.qty) : 0;
          const proceeds = sellQty > 0 ? sellAmount * (matchedQty / sellQty) : 0;

          result.push({
            status: 'closed',
            assetType: firstTrade.assetType ?? null,
            buyDateISO: lot.trade.dateISO,
            sellDateISO: sell.dateISO,
            pnl: proceeds - cost,
            openMonths: this.generateMonthRange(lot.trade.dateISO.substring(0, 7), sell.dateISO.substring(0, 7)),
          });

          lot.remaining -= matchedQty;
          remainingToMatch -= matchedQty;
        }
      }

      for (const lot of lotQueue) {
        if (lot.remaining <= 0) continue;
        const cost = lot.qty > 0 ? lot.amount * (lot.remaining / lot.qty) : 0;

        let currentValue: number | null = null;
        if (currentRates && ticker !== '?') {
          const quoteUsd = currentRates[ticker];
          if (typeof quoteUsd === 'number' && quoteUsd > 0) {
            currentValue = convertAmount(lot.remaining * quoteUsd, 'USD', targetTicker, currentRates);
          }
        }

        result.push({
          status: 'open',
          assetType: firstTrade.assetType ?? null,
          buyDateISO: lot.trade.dateISO,
          sellDateISO: null,
          pnl: currentValue !== null ? currentValue - cost : null,
          openMonths: this.generateMonthRange(lot.trade.dateISO.substring(0, 7), currentMonthISO),
        });
      }
    });

    result.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'closed' ? -1 : 1;
      const dateA = a.sellDateISO ?? a.buyDateISO;
      const dateB = b.sellDateISO ?? b.buyDateISO;
      return dateB.localeCompare(dateA);
    });

    return result;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getTxCashDelta(tx: Transaction): number {
    const { kind, amount } = tx;
    if (kind === TransactionKind.INCOME) return amount;
    if (kind === TransactionKind.EXPENSE) return -amount;
    if (kind === TransactionKind.INVEST_BUY) return -amount;
    if (kind === TransactionKind.INVEST_SELL || kind === TransactionKind.INVEST_DIVIDEND) return amount;
    if (kind !== TransactionKind.TRANSFER) return 0;

    const details = this.parseDetails(tx.detailsJSON);
    const direction = details?.direction;
    if (direction === 'out') return -amount;
    if (direction === 'in') return amount;
    return 0;
  }

  private toEomISO(monthKey: string): string {
    const [yr, mo] = monthKey.split('-').map(Number);
    const eomDay = new Date(yr, mo, 0).getDate();
    return `${yr}-${String(mo).padStart(2, '0')}-${String(eomDay).padStart(2, '0')}`;
  }

  private generateEomDates(firstMonthISO: string, lastMonthISO: string): string[] {
    const months: string[] = [];
    const [startYear, startMonth] = firstMonthISO.split('-').map(Number);
    const [endYear, endMonth] = lastMonthISO.split('-').map(Number);
    let y = startYear,
      m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      months.push(this.toEomISO(`${y}-${String(m).padStart(2, '0')}`));
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }

  private expandMonthRange(sortedMonths: string[]): string[] {
    if (!sortedMonths.length) return [];
    const [startYear, startMonth] = sortedMonths[0].split('-').map(Number);
    const [endYear, endMonth] = sortedMonths[sortedMonths.length - 1].split('-').map(Number);
    const months: string[] = [];
    let y = startYear,
      m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }

  private generateMonthRange(fromMonthISO: string, toMonthISO: string): string[] {
    const months: string[] = [];
    const [fromYear, fromMonth] = fromMonthISO.split('-').map(Number);
    const [toYear, toMonth] = toMonthISO.split('-').map(Number);
    let y = fromYear,
      m = fromMonth;
    while (y < toYear || (y === toYear && m <= toMonth)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return months;
  }

  private parseDetails(detailsJSON: any): any {
    if (!detailsJSON) return null;
    if (typeof detailsJSON === 'object') return detailsJSON;
    try {
      return JSON.parse(detailsJSON);
    } catch {
      return null;
    }
  }

  private toPositiveNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
