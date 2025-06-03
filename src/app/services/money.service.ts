import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Currency, ServerResponseBasic } from '../shared/interfaces';

interface CurrenciesResponse {
  success: boolean;
  data: Currency[];
}

interface CreateCurrencyResponse {
  success: boolean;
  data: { id: number };
}

interface BasicResponse {
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MoneyService {
  // Currencies
  public currencies$$: WritableSignal<Currency[]> = signal([]);

  // Subjects for notifications
  public postRequestResult$ = new Subject<ServerResponseBasic>();

  constructor(private http: HttpClient) {
    // effect(() => { console.log('CURRENCIES have been updated:', this.currencies$$()) });
  }

  //                                                                                                                INIT

  public initializeData(): void {
    this.getCurrencies().subscribe();
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
}
