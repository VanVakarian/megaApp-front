import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Account,
  Asset,
  Category,
  Currency,
  InvestAssetTrade,
  MoneyRateHistory,
  Organization,
  ServerResponseBasic,
  Transaction,
  TransactionKind,
} from '../shared/types';
import { SyncOperationType, SyncQueueService } from './sync-queue.service';

interface BaseResponse {
  success: boolean;
}

interface DataResponse<T> extends BaseResponse {
  data: T;
}

interface MessageResponse extends BaseResponse {
  message?: string;
}

interface AccountApi extends Omit<Account, 'isInvest' | 'isArchived'> {
  isInvest?: boolean | number | string;
  isArchived?: boolean | number | string;
}

interface MoneySnapshot {
  currencies: Currency[];
  categories: Category[];
  organizations: Organization[];
  accounts: Account[];
  assets: Asset[];
  investAssetTrades: InvestAssetTrade[];
  transactions: Transaction[];
  rateHistory: MoneyRateHistory[];
}

interface SnapshotResponse extends DataResponse<MoneySnapshot> {}

interface CreateCurrencyResponse extends DataResponse<{ id: number }> {}

interface CreateCategoryResponse extends DataResponse<{ id: number }> {}

interface CreateOrganizationResponse extends DataResponse<{ id: number }> {}

interface CreateAccountResponse extends DataResponse<{ id: number }> {}

interface CreateAssetResponse extends DataResponse<{ id: number }> {}

interface CreateTransactionResponse extends DataResponse<{ id: number; twinId?: number }> {}

interface BasicResponse extends MessageResponse {}

@Injectable({
  providedIn: 'root',
})
export class MoneyService {
  public readonly currencies$$: WritableSignal<Currency[]> = signal([]);
  public readonly categories$$: WritableSignal<Category[]> = signal([]);
  public readonly organizations$$: WritableSignal<Organization[]> = signal([]);
  public readonly accounts$$: WritableSignal<Account[]> = signal([]);
  public readonly assets$$: WritableSignal<Asset[]> = signal([]);
  public readonly investAssetTrades$$: WritableSignal<InvestAssetTrade[]> = signal([]);
  public readonly transactions$$: WritableSignal<Transaction[]> = signal([]);
  public readonly rateHistory$$: WritableSignal<MoneyRateHistory[]> = signal([]);
  private readonly rateSnapshots$$: Signal<{ dateISO: string; rates: Record<string, number> }[]> = computed(() => {
    const sorted = [...this.rateHistory$$()].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    let accumulated: Record<string, number> = {};
    return sorted.map((item) => {
      accumulated = { ...accumulated, ...(item.ratesJson as Record<string, number>) };
      return { dateISO: item.dateISO, rates: accumulated };
    });
  });
  public readonly displayCurrency$$: WritableSignal<string> = signal(
    localStorage.getItem('money_display_currency') ?? 'RUB',
  );
  public readonly isDisplayCurrencyChanging$$: WritableSignal<boolean> = signal(false);
  public readonly chartRangeStart$$: WritableSignal<string | null> = signal(
    localStorage.getItem('money_chart_range_start'),
  );
  public readonly chartRangeEnd$$: WritableSignal<string | null> = signal(
    localStorage.getItem('money_chart_range_end'),
  );

  private readonly isDataReady$$: WritableSignal<boolean> = signal(false);
  public readonly isChartDataReady$$ = computed(() => this.isDataReady$$() && !this.isDisplayCurrencyChanging$$());

  public readonly requestResult$ = new Subject<ServerResponseBasic>();

  public setChartRange(start: string | null, end: string | null): void {
    this.chartRangeStart$$.set(start);
    this.chartRangeEnd$$.set(end);
    if (start !== null) localStorage.setItem('money_chart_range_start', start);
    else localStorage.removeItem('money_chart_range_start');
    if (end !== null) localStorage.setItem('money_chart_range_end', end);
    else localStorage.removeItem('money_chart_range_end');
  }

  constructor(
    private http: HttpClient,
    private syncQueue: SyncQueueService,
  ) {
    // effect(() => { console.log('CURRENCIES:', this.currencies$$()) }); // prettier-ignore
    // effect(() => { console.log('CATEGORIES:', this.categories$$()) }); // prettier-ignore
    // effect(() => { console.log('ACCOUNTS:', this.accounts$$()) }); // prettier-ignore
    // effect(() => { console.log('TRANSACTIONS:', this.transactions$$()) }); // prettier-ignore
    // effect(() => { console.log('RATE HISTORY:', this.rateHistory$$()) }); // prettier-ignore
  }

  //                                                            ~~~ BOOTSTRAP ~~~

  public loadData(): void {
    localStorage.removeItem('money_snapshot_v1');

    const cached = localStorage.getItem('money_snapshot');
    if (cached) {
      try {
        this.applySnapshot(JSON.parse(cached), false);
      } catch {
        // ignore corrupted cache
      }
    }

    this.readIDB<MoneyRateHistory[]>('rateHistory').then((rateHistory) => {
      if (rateHistory && !this.isDataReady$$()) {
        this.rateHistory$$.set(
          rateHistory.map((item) => ({ ...item, ratesJson: this.parseRatesJson(item.ratesJson) })),
        );
        this.isDataReady$$.set(true);
      }
    });

    this.fetchSnapshot();
  }

  private fetchSnapshot(): void {
    this.http.get<SnapshotResponse>('/api/money/snapshot').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.applySnapshot(response.data, true);
          this.writeCacheSnapshot();
        }
      },
      error: (error) => {
        console.error('Error fetching money snapshot:', error);
        this.requestResult$.next({ result: false });
      },
    });
  }

  private applySnapshot(data: MoneySnapshot, setReady: boolean): void {
    this.currencies$$.set(data.currencies ?? []);
    this.categories$$.set(data.categories ?? []);
    this.organizations$$.set(data.organizations ?? []);
    this.accounts$$.set((data.accounts ?? []).map((a) => this.normalizeAccount(a as AccountApi)));
    this.assets$$.set(data.assets ?? []);
    this.investAssetTrades$$.set(data.investAssetTrades ?? []);
    this.transactions$$.set(data.transactions ?? []);
    if (data.rateHistory?.length) {
      this.rateHistory$$.set(
        data.rateHistory.map((item) => ({ ...item, ratesJson: this.parseRatesJson(item.ratesJson) })),
      );
    }
    if (setReady) this.isDataReady$$.set(true);
  }

  private writeCacheSnapshot(): void {
    try {
      const snapshot = {
        currencies: this.currencies$$(),
        categories: this.categories$$(),
        organizations: this.organizations$$(),
        accounts: this.accounts$$(),
        assets: this.assets$$(),
        investAssetTrades: this.investAssetTrades$$(),
        transactions: this.transactions$$(),
      };
      localStorage.setItem('money_snapshot', JSON.stringify(snapshot));
    } catch {
      // storage quota exceeded or unavailable
    }
    void this.writeIDB('rateHistory', this.rateHistory$$());
  }

  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('money_cache', 1);
      request.onupgradeneeded = (event) => {
        (event.target as IDBOpenDBRequest).result.createObjectStore('kv');
      };
      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = () => reject(request.error);
    });
  }

  private async readIDB<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openIDB();
      return new Promise((resolve) => {
        const request = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private async writeIDB(key: string, value: unknown): Promise<void> {
    try {
      const db = await this.openIDB();
      return new Promise((resolve) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  private parseRatesJson(ratesJson: Record<string, number> | string): Record<string, number> {
    if (ratesJson && typeof ratesJson === 'object') {
      return ratesJson;
    }

    if (typeof ratesJson === 'string') {
      try {
        const parsed = JSON.parse(ratesJson);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, number>;
        }
      } catch {
        return {};
      }
    }

    return {};
  }

  //                                                          ~~~ CURRENCIES ~~~

  public createCurrency(currencyData: Currency): Observable<boolean> {
    return this.http.post<CreateCurrencyResponse>('/api/money/currencies', currencyData).pipe(
      map((response: CreateCurrencyResponse) => {
        if (response.success && response.data?.id) {
          const newCurrency: Currency = {
            id: response.data.id,
            ...currencyData,
          };
          this.addCurrencyToState(newCurrency);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating currency:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateCurrency(currencyData: Currency): Observable<boolean> {
    if (!currencyData.id) {
      console.error('Currency ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/currencies/${currencyData.id}`, currencyData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateCurrencyInState(currencyData);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating currency:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteCurrency(currencyId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/currencies/${currencyId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeCurrencyFromState(currencyId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting currency:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  private addCurrencyToState(currency: Currency): void {
    this.currencies$$.update((currencies: Currency[]) => [...currencies, currency]);
  }

  private updateCurrencyInState(updatedCurrency: Currency): void {
    this.currencies$$.update((currencies: Currency[]) =>
      currencies.map((currency: Currency) =>
        currency.id === updatedCurrency.id ? { ...currency, ...updatedCurrency } : currency,
      ),
    );
  }

  private removeCurrencyFromState(currencyId: number): void {
    this.currencies$$.update((currencies: Currency[]) =>
      currencies.filter((currency: Currency) => currency.id !== currencyId),
    );
  }

  //                                                          ~~~ CATEGORIES ~~~

  public createCategory(categoryData: Category): Observable<boolean> {
    return this.http.post<CreateCategoryResponse>('/api/money/categories', categoryData).pipe(
      map((response: CreateCategoryResponse) => {
        if (response.success && response.data?.id) {
          const newCategory: Category = {
            id: response.data.id,
            ...categoryData,
          };
          this.addCategoryToState(newCategory);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating category:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateCategory(categoryData: Category): Observable<boolean> {
    if (!categoryData.id) {
      console.error('Category ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/categories/${categoryData.id}`, categoryData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateCategoryInState(categoryData);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating category:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteCategory(categoryId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/categories/${categoryId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeCategoryFromState(categoryId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting category:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  private addCategoryToState(category: Category): void {
    this.categories$$.update((categories: Category[]) => [...categories, category]);
  }

  private updateCategoryInState(updatedCategory: Category): void {
    this.categories$$.update((categories: Category[]) =>
      categories.map((category: Category) =>
        category.id === updatedCategory.id ? { ...category, ...updatedCategory } : category,
      ),
    );
  }

  private removeCategoryFromState(categoryId: number): void {
    this.categories$$.update((categories: Category[]) =>
      categories.filter((category: Category) => category.id !== categoryId),
    );
  }

  //                                                        ~~~ ORGANIZATIONS ~~~

  public createOrganization(organizationData: Organization): Observable<boolean> {
    return this.http.post<CreateOrganizationResponse>('/api/money/organizations', organizationData).pipe(
      map((response: CreateOrganizationResponse) => {
        if (response.success && response.data?.id) {
          const newOrganization: Organization = {
            id: response.data.id,
            ...organizationData,
          };
          this.addOrganizationToState(newOrganization);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating organization:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateOrganization(organizationData: Organization): Observable<boolean> {
    if (!organizationData.id) {
      console.error('Organization ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/organizations/${organizationData.id}`, organizationData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateOrganizationInState(organizationData);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating organization:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteOrganization(organizationId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/organizations/${organizationId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeOrganizationFromState(organizationId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting organization:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  private addOrganizationToState(organization: Organization): void {
    this.organizations$$.update((organizations: Organization[]) => [...organizations, organization]);
  }

  private updateOrganizationInState(updatedOrganization: Organization): void {
    this.organizations$$.update((organizations: Organization[]) =>
      organizations.map((organization: Organization) =>
        organization.id === updatedOrganization.id ? { ...organization, ...updatedOrganization } : organization,
      ),
    );
  }

  private removeOrganizationFromState(organizationId: number): void {
    this.organizations$$.update((organizations: Organization[]) =>
      organizations.filter((organization: Organization) => organization.id !== organizationId),
    );
  }

  //                                                            ~~~ ACCOUNTS ~~~

  public createAccount(accountData: Account): Observable<boolean> {
    return this.http.post<CreateAccountResponse>('/api/money/accounts', this.toAccountApiPayload(accountData)).pipe(
      map((response: CreateAccountResponse) => {
        if (response.success && response.data?.id) {
          const newAccount: Account = {
            id: response.data.id,
            ...accountData,
          };
          this.addAccountToState(newAccount);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating account:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateAccount(accountData: Account): Observable<boolean> {
    if (!accountData.id) {
      console.error('Account ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http
      .put<BasicResponse>(`/api/money/accounts/${accountData.id}`, this.toAccountApiPayload(accountData))
      .pipe(
        map((response: BasicResponse) => {
          if (response.success) {
            this.updateAccountInState(accountData);
            this.requestResult$.next({ result: true });
            return true;
          }
          this.requestResult$.next({ result: false });
          return false;
        }),
        catchError((error) => {
          console.error('Error updating account:', error);
          this.requestResult$.next({ result: false });
          return of(false);
        }),
      );
  }

  public deleteAccount(accountId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/accounts/${accountId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeAccountFromState(accountId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting account:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  private addAccountToState(account: Account): void {
    this.accounts$$.update((accounts: Account[]) => [...accounts, account]);
  }

  private updateAccountInState(updatedAccount: Account): void {
    this.accounts$$.update((accounts: Account[]) =>
      accounts.map((account: Account) =>
        account.id === updatedAccount.id ? { ...account, ...updatedAccount } : account,
      ),
    );
  }

  private removeAccountFromState(accountId: number): void {
    this.accounts$$.update((accounts: Account[]) => accounts.filter((account: Account) => account.id !== accountId));
  }

  private normalizeAccount(account: AccountApi): Account {
    return {
      id: account.id,
      title: account.title,
      currencyId: account.currencyId,
      isInvest: this.toBoolean(account.isInvest),
      isArchived: this.toBoolean(account.isArchived),
      kind: account.kind,
      organizationId: account.organizationId ?? null,
    };
  }

  private toAccountApiPayload(accountData: Account): AccountApi {
    return {
      id: accountData.id,
      title: accountData.title,
      currencyId: accountData.currencyId,
      isInvest: this.toBoolean(accountData.isInvest),
      isArchived: this.toBoolean(accountData.isArchived),
      kind: accountData.kind,
      organizationId: accountData.organizationId ?? null,
    };
  }

  private toBoolean(value: boolean | number | string | undefined): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  //                                                              ~~~ ASSETS ~~~

  public createAsset(assetData: Asset): Observable<boolean> {
    return this.http.post<CreateAssetResponse>('/api/money/assets', assetData).pipe(
      map((response: CreateAssetResponse) => {
        if (response.success && response.data?.id) {
          const newAsset: Asset = {
            id: response.data.id,
            ...assetData,
          };
          this.addAssetToState(newAsset);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating asset:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateAsset(assetData: Asset): Observable<boolean> {
    if (!assetData.id) {
      console.error('Asset ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/assets/${assetData.id}`, assetData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateAssetInState(assetData);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating asset:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteAsset(assetId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/assets/${assetId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeAssetFromState(assetId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting asset:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  private addAssetToState(asset: Asset): void {
    this.assets$$.update((assets: Asset[]) => [...assets, asset]);
  }

  private updateAssetInState(updatedAsset: Asset): void {
    this.assets$$.update((assets: Asset[]) =>
      assets.map((asset: Asset) => (asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset)),
    );
  }

  private removeAssetFromState(assetId: number): void {
    this.assets$$.update((assets: Asset[]) => assets.filter((asset: Asset) => asset.id !== assetId));
  }

  //                                                        ~~~ TRANSACTIONS ~~~

  public createTransaction(transactionData: Transaction): Observable<boolean> {
    const tempId = Date.now();
    const snapshot = this.transactions$$();

    this.addTransactionToState({ ...transactionData, id: tempId });

    this.syncQueue.addOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/money/transactions',
      data: transactionData,
      successCallback: (response: CreateTransactionResponse) => {
        if (response.success && response.data?.id) {
          this.transactions$$.update((txs) =>
            txs.map((tx) => (tx.id === tempId ? { ...tx, id: response.data.id } : tx)),
          );
        }
        this.writeCacheSnapshot();
        this.requestResult$.next({ result: true });
      },
      rollbackCallback: () => {
        this.transactions$$.set(snapshot);
        this.requestResult$.next({ result: false });
      },
    });

    return of(true);
  }

  public updateTransaction(transactionData: Transaction): Observable<boolean> {
    if (!transactionData.id) {
      console.error('Transaction ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    const snapshot = this.transactions$$();
    this.updateTransactionInState(transactionData);

    this.syncQueue.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/money/transactions/${transactionData.id}`,
      data: transactionData,
      successCallback: () => {
        this.writeCacheSnapshot();
        this.requestResult$.next({ result: true });
      },
      rollbackCallback: () => {
        this.transactions$$.set(snapshot);
        this.requestResult$.next({ result: false });
      },
    });

    return of(true);
  }

  public deleteTransaction(transactionId: number): Observable<boolean> {
    const snapshot = this.transactions$$();
    this.removeTransactionPairFromState(transactionId);

    this.syncQueue.addOperation({
      type: SyncOperationType.DELETE,
      endpoint: `/api/money/transactions/${transactionId}`,
      data: null,
      successCallback: () => {
        this.writeCacheSnapshot();
        this.requestResult$.next({ result: true });
      },
      rollbackCallback: () => {
        this.transactions$$.set(snapshot);
        this.requestResult$.next({ result: false });
      },
    });

    return of(true);
  }

  public createTransfer(transferData: {
    dateISO: string;
    accountId: number;
    amount: number;
    twinAccountId: number;
    twinAmount: number;
    notes?: string;
  }): Observable<boolean> {
    const tempId1 = Date.now();
    const tempId2 = tempId1 + 1;
    const snapshot = this.transactions$$();

    this.transactions$$.update((txs) => [
      {
        id: tempId1,
        dateISO: transferData.dateISO,
        accountId: transferData.accountId,
        amount: transferData.amount,
        categoryId: null,
        kind: TransactionKind.TRANSFER,
        isGift: false,
        notes: transferData.notes,
        detailsJSON: JSON.stringify({ direction: 'out' }),
        twinId: tempId2,
      },
      {
        id: tempId2,
        dateISO: transferData.dateISO,
        accountId: transferData.twinAccountId,
        amount: transferData.twinAmount,
        categoryId: null,
        kind: TransactionKind.TRANSFER,
        isGift: false,
        notes: transferData.notes,
        detailsJSON: JSON.stringify({ direction: 'in' }),
        twinId: tempId1,
      },
      ...txs,
    ]);

    this.syncQueue.addOperation({
      type: SyncOperationType.CREATE,
      endpoint: '/api/money/transactions',
      data: { ...transferData, kind: TransactionKind.TRANSFER, isGift: false, categoryId: null },
      successCallback: (response: CreateTransactionResponse) => {
        if (response.success && response.data?.id && response.data?.twinId) {
          this.transactions$$.update((txs) =>
            txs.map((tx) => {
              if (tx.id === tempId1) return { ...tx, id: response.data.id, twinId: response.data.twinId };
              if (tx.id === tempId2) return { ...tx, id: response.data.twinId, twinId: response.data.id };
              return tx;
            }),
          );
        }
        this.writeCacheSnapshot();
        this.requestResult$.next({ result: true });
      },
      rollbackCallback: () => {
        this.transactions$$.set(snapshot);
        this.requestResult$.next({ result: false });
      },
    });

    return of(true);
  }

  public updateTransfer(transferData: {
    id: number;
    twinId: number;
    dateISO: string;
    accountId: number;
    amount: number;
    twinAccountId: number;
    twinAmount: number;
    notes?: string;
  }): Observable<boolean> {
    const snapshot = this.transactions$$();
    this.updateTransferInState(transferData);

    this.syncQueue.addOperation({
      type: SyncOperationType.UPDATE,
      endpoint: `/api/money/transactions/${transferData.id}`,
      data: {
        dateISO: transferData.dateISO,
        accountId: transferData.accountId,
        amount: transferData.amount,
        twinAccountId: transferData.twinAccountId,
        twinAmount: transferData.twinAmount,
        kind: TransactionKind.TRANSFER,
        isGift: false,
        categoryId: null,
        notes: transferData.notes,
      },
      successCallback: () => {
        this.writeCacheSnapshot();
        this.requestResult$.next({ result: true });
      },
      rollbackCallback: () => {
        this.transactions$$.set(snapshot);
        this.requestResult$.next({ result: false });
      },
    });

    return of(true);
  }

  private addTransactionToState(transaction: Transaction): void {
    this.transactions$$.update((transactions: Transaction[]) => [transaction, ...transactions]);
  }

  private updateTransactionInState(updatedTransaction: Transaction): void {
    this.transactions$$.update((transactions: Transaction[]) =>
      transactions.map((transaction: Transaction) =>
        transaction.id === updatedTransaction.id ? { ...transaction, ...updatedTransaction } : transaction,
      ),
    );
  }

  private removeTransactionFromState(transactionId: number): void {
    this.transactions$$.update((transactions: Transaction[]) =>
      transactions.filter((transaction: Transaction) => transaction.id !== transactionId),
    );
  }

  private removeTransactionPairFromState(transactionId: number): void {
    const transactions = this.transactions$$();
    const target = transactions.find((transaction) => transaction.id === transactionId);
    const twinId = target?.twinId;

    this.transactions$$.update((items: Transaction[]) =>
      items.filter((transaction) => transaction.id !== transactionId && transaction.id !== twinId),
    );
  }

  private updateTransferInState(transferData: {
    id: number;
    twinId: number;
    dateISO: string;
    accountId: number;
    amount: number;
    twinAccountId: number;
    twinAmount: number;
    notes?: string;
  }): void {
    this.transactions$$.update((transactions: Transaction[]) =>
      transactions.map((transaction: Transaction) => {
        if (transaction.id === transferData.id) {
          return {
            ...transaction,
            dateISO: transferData.dateISO,
            accountId: transferData.accountId,
            amount: transferData.amount,
            notes: transferData.notes,
          };
        }

        if (transaction.id === transferData.twinId) {
          return {
            ...transaction,
            dateISO: transferData.dateISO,
            accountId: transferData.twinAccountId,
            amount: transferData.twinAmount,
            notes: transferData.notes,
          };
        }

        return transaction;
      }),
    );
  }

  public getRatesForDate(dateISO: string): Record<string, number> | null {
    const snapshots = this.rateSnapshots$$();
    if (!snapshots.length) return null;

    let lo = 0,
      hi = snapshots.length - 1,
      result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (snapshots[mid].dateISO <= dateISO) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result >= 0 ? snapshots[result].rates : null;
  }
}
