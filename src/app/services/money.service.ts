import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Account, Category, Currency, ServerResponseBasic } from '../shared/interfaces';

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

interface CreateCurrencyResponse extends DataResponse<{ id: number }> {}

interface CreateCategoryResponse extends DataResponse<{ id: number }> {}

interface CreateAccountResponse extends DataResponse<{ id: number }> {}

interface BasicResponse extends MessageResponse {}

@Injectable({
  providedIn: 'root',
})
export class MoneyService {
  public currencies$$: WritableSignal<Currency[]> = signal([]);
  public categories$$: WritableSignal<Category[]> = signal([]);
  public accounts$$: WritableSignal<Account[]> = signal([]);

  public postRequestResult$ = new Subject<ServerResponseBasic>();

  constructor(private http: HttpClient) {
    // effect(() => { console.log('CURRENCIES have been updated:', this.currencies$$()) });
  }

  //                                                                                                          CURRENCIES

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
        this.postRequestResult$.next({ result: false });
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
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating currency:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateCurrency(currencyData: Currency): Observable<boolean> {
    if (!currencyData.id) {
      console.error('Currency ID is required for update');
      this.postRequestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/currencies/${currencyData.id}`, currencyData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateCurrencyInState(currencyData);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating currency:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteCurrency(currencyId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/currencies/${currencyId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeCurrencyFromState(currencyId);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting currency:', error);
        this.postRequestResult$.next({ result: false });
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

  //                                                                                                          CATEGORIES

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
        this.postRequestResult$.next({ result: false });
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
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating category:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateCategory(categoryData: Category): Observable<boolean> {
    if (!categoryData.id) {
      console.error('Category ID is required for update');
      this.postRequestResult$.next({ result: false });
      return of(false);
    }

    return this.http.put<BasicResponse>(`/api/money/categories/${categoryData.id}`, categoryData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateCategoryInState(categoryData);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating category:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteCategory(categoryId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/categories/${categoryId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeCategoryFromState(categoryId);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting category:', error);
        this.postRequestResult$.next({ result: false });
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

  //                                                                                                            ACCOUNTS

  public getAccounts(): Observable<Account[]> {
    return this.http.get<AccountsResponse>('/api/money/accounts').pipe(
      map((response: AccountsResponse) => {
        if (response.success && response.data) {
          const accounts = response.data.map((account: any) => ({
            ...account,
            categoryIds: account.categoryIds ? JSON.parse(account.categoryIds) : [],
          }));
          this.accounts$$.set(accounts);
          return accounts;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching accounts:', error);
        this.postRequestResult$.next({ result: false });
        return of([]);
      }),
    );
  }

  public createAccount(accountData: Account): Observable<boolean> {
    const requestData = {
      ...accountData,
      categoryIds: accountData.categoryIds || [],
    };

    return this.http.post<CreateAccountResponse>('/api/money/accounts', requestData).pipe(
      map((response: CreateAccountResponse) => {
        if (response.success && response.data?.id) {
          const newAccount: Account = {
            id: response.data.id,
            ...accountData,
          };
          this.addAccountToState(newAccount);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error creating account:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public updateAccount(accountData: Account): Observable<boolean> {
    if (!accountData.id) {
      console.error('Account ID is required for update');
      this.postRequestResult$.next({ result: false });
      return of(false);
    }

    const requestData = {
      ...accountData,
      categoryIds: accountData.categoryIds || [],
    };

    return this.http.put<BasicResponse>(`/api/money/accounts/${accountData.id}`, requestData).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.updateAccountInState(accountData);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error updating account:', error);
        this.postRequestResult$.next({ result: false });
        return of(false);
      }),
    );
  }

  public deleteAccount(accountId: number): Observable<boolean> {
    return this.http.delete<BasicResponse>(`/api/money/accounts/${accountId}`).pipe(
      map((response: BasicResponse) => {
        if (response.success) {
          this.removeAccountFromState(accountId);
          this.postRequestResult$.next({ result: true });
          return true;
        }
        this.postRequestResult$.next({ result: false });
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting account:', error);
        this.postRequestResult$.next({ result: false });
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
}
