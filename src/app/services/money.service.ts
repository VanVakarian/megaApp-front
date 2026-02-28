import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Account,
  Asset,
  Category,
  Currency,
  InvestAssetTrade,
  MoneyRateHistory,
  ServerResponseBasic,
  Transaction,
  TransactionKind,
} from '../shared/types';

interface BaseResponse {
  success: boolean;
}

interface DataResponse<T> extends BaseResponse {
  data: T;
}

interface MessageResponse extends BaseResponse {
  message?: string;
}

interface CurrenciesResponse extends DataResponse<Currency[]> {}

interface CategoriesResponse extends DataResponse<Category[]> {}

interface AccountsResponse extends DataResponse<Account[]> {}

interface AssetsResponse extends DataResponse<Asset[]> {}

interface InvestAssetTradesResponse extends DataResponse<InvestAssetTrade[]> {}

interface AccountApi extends Omit<Account, 'isInvest'> {
  isInvest?: boolean | number | string;
}

interface TransactionsResponse extends DataResponse<Transaction[]> {}

interface RateHistoryResponse extends DataResponse<MoneyRateHistory[]> {}

interface CreateCurrencyResponse extends DataResponse<{ id: number }> {}

interface CreateCategoryResponse extends DataResponse<{ id: number }> {}

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
  public readonly accounts$$: WritableSignal<Account[]> = signal([]);
  public readonly assets$$: WritableSignal<Asset[]> = signal([]);
  public readonly investAssetTrades$$: WritableSignal<InvestAssetTrade[]> = signal([]);
  public readonly transactions$$: WritableSignal<Transaction[]> = signal([]);
  public readonly rateHistory$$: WritableSignal<MoneyRateHistory[]> = signal([]);

  public readonly requestResult$ = new Subject<ServerResponseBasic>();

  constructor(private http: HttpClient) {
    // effect(() => { console.log('CURRENCIES:', this.currencies$$()) }); // prettier-ignore
    // effect(() => { console.log('CATEGORIES:', this.categories$$()) }); // prettier-ignore
    // effect(() => { console.log('ACCOUNTS:', this.accounts$$()) }); // prettier-ignore
    // effect(() => { console.log('TRANSACTIONS:', this.transactions$$()) }); // prettier-ignore
    // effect(() => { console.log('RATE HISTORY:', this.rateHistory$$()) }); // prettier-ignore
  }

  //                                                          ~~~ CURRENCIES ~~~

  public getCurrencies(): Observable<Currency[]> {
    return this.http.get<CurrenciesResponse>('/api/money/currencies').pipe(
      map((response: CurrenciesResponse) => {
        if (response.success && response.data) {
          this.currencies$$.set(response.data);
          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching currencies:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

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

  public getCategories(): Observable<Category[]> {
    return this.http.get<CategoriesResponse>('/api/money/categories').pipe(
      map((response: CategoriesResponse) => {
        if (response.success && response.data) {
          this.categories$$.set(response.data);
          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching categories:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

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

  //                                                            ~~~ ACCOUNTS ~~~

  public getAccounts(): Observable<Account[]> {
    return this.http.get<AccountsResponse>('/api/money/accounts').pipe(
      map((response: AccountsResponse) => {
        if (response.success && response.data) {
          const normalizedAccounts = response.data.map((account) => this.normalizeAccount(account as AccountApi));
          this.accounts$$.set(normalizedAccounts);
          return normalizedAccounts;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching accounts:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

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
      kind: account.kind,
    };
  }

  private toAccountApiPayload(accountData: Account): AccountApi {
    return {
      id: accountData.id,
      title: accountData.title,
      currencyId: accountData.currencyId,
      isInvest: this.toBoolean(accountData.isInvest),
      kind: accountData.kind,
    };
  }

  private toBoolean(value: boolean | number | string | undefined): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  //                                                              ~~~ ASSETS ~~~

  public getAssets(): Observable<Asset[]> {
    return this.http.get<AssetsResponse>('/api/money/assets').pipe(
      map((response: AssetsResponse) => {
        if (response.success && response.data) {
          this.assets$$.set(response.data);
          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching assets:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

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

  public getInvestAssetTrades(): Observable<InvestAssetTrade[]> {
    return this.http.get<InvestAssetTradesResponse>('/api/money/trades').pipe(
      map((response: InvestAssetTradesResponse) => {
        if (response.success && response.data) {
          this.investAssetTrades$$.set(response.data);
          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching invest asset trades:', error);
        this.requestResult$.next({ result: false });
        return of([]);
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

  public getTransactions(): Observable<Transaction[]> {
    return this.http.get<TransactionsResponse>('/api/money/transactions').pipe(
      map((response: TransactionsResponse) => {
        if (response.success && response.data) {
          this.transactions$$.set(response.data);
          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching transactions:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

  public getRateHistory(): Observable<MoneyRateHistory[]> {
    return this.http.get<RateHistoryResponse>('/api/money/rate-history').pipe(
      map((response: RateHistoryResponse | null) => {
        if (!response || !response.success || !Array.isArray(response.data)) {
          this.rateHistory$$.set([]);
          return [];
        }

        const parsed = response.data.map((item) => ({
          ...item,
          ratesJson: this.parseRatesJson(item.ratesJson),
        }));
        this.rateHistory$$.set(parsed);
        return parsed;
      }),
      catchError((error) => {
        console.error('Error fetching money rate history:', error);
        this.requestResult$.next({ result: false });
        return of([]);
      }),
    );
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

  public createTransaction(transactionData: Transaction): Observable<boolean> {
    return this.http.post<CreateTransactionResponse>('/api/money/transactions', transactionData).pipe(
      map((response: CreateTransactionResponse) => {
        if (response.success && response.data?.id) {
          const newTransaction: Transaction = {
            id: response.data.id,
            ...transactionData,
          };
          this.addTransactionToState(newTransaction);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating transaction:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateTransaction(transactionData: Transaction): Observable<boolean> {
    if (!transactionData.id) {
      console.error('Transaction ID is required for update');
      this.requestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/transactions/${transactionData.id}`, transactionData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateTransactionInState(transactionData);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating transaction:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteTransaction(transactionId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/transactions/${transactionId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeTransactionPairFromState(transactionId);
          this.requestResult$.next({ result: true });
          return true;
        }
        this.requestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting transaction:', error);
        this.requestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public createTransfer(transferData: {
    dateISO: string;
    accountId: number;
    amount: number;
    twinAccountId: number;
    twinAmount: number;
    notes?: string;
  }): Observable<boolean> {
    return this.http
      .post<CreateTransactionResponse>('/api/money/transactions', {
        ...transferData,
        kind: TransactionKind.TRANSFER,
        isGift: false,
        categoryId: null,
      })
      .pipe(
        map((response: CreateTransactionResponse) => {
          if (response.success && response.data?.id && response.data?.twinId) {
            const fromTransaction: Transaction = {
              id: response.data.id,
              dateISO: transferData.dateISO,
              accountId: transferData.accountId,
              amount: transferData.amount,
              categoryId: null,
              kind: TransactionKind.TRANSFER,
              isGift: false,
              notes: transferData.notes,
              detailsJSON: JSON.stringify({ direction: 'out' }),
              twinId: response.data.twinId,
            };

            const toTransaction: Transaction = {
              id: response.data.twinId,
              dateISO: transferData.dateISO,
              accountId: transferData.twinAccountId,
              amount: transferData.twinAmount,
              categoryId: null,
              kind: TransactionKind.TRANSFER,
              isGift: false,
              notes: transferData.notes,
              detailsJSON: JSON.stringify({ direction: 'in' }),
              twinId: response.data.id,
            };

            this.transactions$$.update((transactions: Transaction[]) => [
              fromTransaction,
              toTransaction,
              ...transactions,
            ]);
            this.requestResult$.next({ result: true });
            return true;
          }
          this.requestResult$.next({ result: false });
          return false;
        }),
        catchError((error) => {
          console.error('Error creating transfer:', error);
          this.requestResult$.next({ result: false });
          return of(false);
        }),
      );
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
    return this.http
      .put<BasicResponse>(`/api/money/transactions/${transferData.id}`, {
        dateISO: transferData.dateISO,
        accountId: transferData.accountId,
        amount: transferData.amount,
        twinAccountId: transferData.twinAccountId,
        twinAmount: transferData.twinAmount,
        kind: TransactionKind.TRANSFER,
        isGift: false,
        categoryId: null,
        notes: transferData.notes,
      })
      .pipe(
        map((response: BasicResponse) => {
          if (response.success) {
            this.updateTransferInState(transferData);
            this.requestResult$.next({ result: true });
            return true;
          }
          this.requestResult$.next({ result: false });
          return false;
        }),
        catchError((error) => {
          console.error('Error updating transfer:', error);
          this.requestResult$.next({ result: false });
          return of(false);
        }),
      );
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
}
