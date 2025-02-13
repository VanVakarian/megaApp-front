import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';

import { AuthService } from '@app/components/refactor/service/auth/auth.service';
import { NotificationsService } from '@app/components/refactor/service/notifications.service';
import { Account, Bank, Category, Currency, Transaction } from '@app/shared/interfaces';
import { dateToIsoNoTimeNoTZ } from '@app/shared/utils';
import { DataSharingService } from './data-sharing.service';

enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

type PayloadType = Currency | Bank | Account | Category | Transaction | null;
type ResultType = Currency | Bank | Account | Category | Transaction;

interface TransactionsByDay {
  [date: string]: {
    [kind: string]: Transaction[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class MoneyService {
  token = this.auth.getToken();
  currentDay: string = '';

  currencies$$: WritableSignal<{ [id: number]: Currency }> = signal({});
  banks$$: WritableSignal<{ [id: number]: Bank }> = signal({});
  accounts$$: WritableSignal<{ [id: number]: Account }> = signal({});
  categories$$: WritableSignal<{ [id: number]: Category }> = signal({});
  transactions$$: WritableSignal<{ [id: number]: Transaction }> = signal({});
  transactionsByDay$$: Signal<TransactionsByDay> = computed(() => this.groupByDayAndKind());

  constructor(
    private auth: AuthService,
    private http: HttpClient,
    private notificationsService: NotificationsService,
    private dataSharingService: DataSharingService,
  ) {
    // effect(() => { console.log('CURRENCIES have been updated:', this.currencies$$()); }); // prettier-ignore
    // effect(() => { console.log('BANKS have been updated:', this.banks$$()); }); // prettier-ignore
    // effect(() => { console.log('ACCOUNTS have been updated:', this.accounts$$()); }); // prettier-ignore
    // effect(() => { console.log('CATEGORIES have been updated:', this.categories$$()); }); // prettier-ignore
    // effect(() => { console.log('TRANSACTIONS have been updated:', this.transactions$$()); }); // prettier-ignore
    // effect(() => { console.log('TRANSACTIONS BY DAY have been updated:', this.transactionsByDay$$()); }); // prettier-ignore
  }

  groupByDayAndKind(): TransactionsByDay {
    const transactionIds = Object.keys(this.transactions$$()).map(Number);
    const startDate = new Date(this.transactions$$()[transactionIds[0]]?.date + 'T00:00');
    const endDate = new Date();
    let transactionsByDay: TransactionsByDay = {};

    for (let day = startDate; day <= endDate; day.setDate(day.getDate() + 1)) {
      const isoDate = dateToIsoNoTimeNoTZ(day.getTime());
      transactionsByDay[isoDate] = {};

      transactionIds.forEach((id) => {
        if (this.transactions$$()[id].date === isoDate) {
          const kind = this.transactions$$()[id].kind;

          if (!transactionsByDay[isoDate][kind]) {
            transactionsByDay[isoDate][kind] = [];
          }
          transactionsByDay[isoDate][kind].push(this.transactions$$()[id]);
        }
      });
    }
    return transactionsByDay;
  }

  performRequest(
    method: HttpMethod,
    url: string,
    payload: PayloadType,
    resultVariableSignal: WritableSignal<{ [key: number]: ResultType }> | null,
    responsePropertyName: string | null,
    successMessage: string,
    errorMessage: string,
    callback?: () => void,
  ): void {
    if (!this.token) {
      // this.notificationsService.addNotification('Токен не найден. Пользователь не авторизован.', 'error');
      return;
    }

    this.http
      .request(method, url, {
        body: payload,
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .subscribe({
        next: (response: any) => {
          // TODO: 'any' is not the most elegant solution, refactor to a better one

          if (response && resultVariableSignal && responsePropertyName && response[responsePropertyName]) {
            resultVariableSignal.set(this.listToObj(response[responsePropertyName]));
          }

          switch (method) {
            case 'GET':
              // console.log(successMessage, response);
              // this.notificationsService.addNotification(successMessage, 'success');
              break;
            default:
              // console.log(successMessage, response);
              this.notificationsService.addNotification(successMessage, 'success');
          }

          if (callback) {
            callback();
          }
        },
        error: (error) => {
          console.log(errorMessage, error);
          this.notificationsService.addNotification(errorMessage, 'error');
        },
      });
  }

  private listToObj<T extends ResultType>(list: T[]): { [id: number]: T } {
    let obj: { [id: number]: T } = {};
    list.forEach((currentValue) => {
      obj[currentValue.id] = currentValue;
    });
    return obj;
  }

  // CURRENCIES ////////////////////////////////////////////////////////////////////////////////////////////////////////

  getCurrencies(): void {
    this.performRequest(
      HttpMethod.GET,
      '/api/money/currency',
      null,
      this.currencies$$,
      'currencies_list',
      'Валюты получены',
      'Ошибка при запросе валют',
    );
  }

  createCurrency(currency: Currency) {
    this.performRequest(
      HttpMethod.POST,
      '/api/money/currency',
      currency,
      null,
      null,
      'Валюта успешно cоздана',
      'Ошибка при создании валюты',
      this.currenciesChanged.bind(this),
    );
  }

  updateCurrency(currency: Currency): void {
    this.performRequest(
      HttpMethod.PUT,
      `/api/money/currency/${currency.id}`,
      currency,
      null,
      null,
      'Валюта успешно изменена',
      'Ошибка при изменении валюты',
      this.currenciesChanged.bind(this),
    );
  }

  deleteCurrency(currencyId: number): void {
    this.performRequest(
      HttpMethod.DELETE,
      `/api/money/currency/${currencyId}`,
      null,
      null,
      null,
      'Валюта успешно удалена',
      'Ошибка при удалении валюты',
      this.currenciesChanged.bind(this),
    );
  }

  currenciesChanged(): void {
    this.dataSharingService.dataChanged$.emit();
    this.getCurrencies();
  }

  // BANKS /////////////////////////////////////////////////////////////////////////////////////////////////////////////

  getBanks(): void {
    this.performRequest(
      HttpMethod.GET,
      '/api/money/bank',
      null,
      this.banks$$,
      'banks_list',
      'Банки получены',
      'Ошибка при запросе банков',
    );
  }

  createBank(bank: Bank): void {
    this.performRequest(
      HttpMethod.POST,
      '/api/money/bank',
      bank,
      null,
      null,
      'Банк успешно cоздан',
      'Ошибка при создании банка',
      this.banksChanged.bind(this),
    );
  }

  updateBank(bank: Bank): void {
    this.performRequest(
      HttpMethod.PUT,
      `/api/money/bank/${bank.id}`,
      bank,
      null,
      null,
      'Банк успешно изменён',
      'Ошибка при изменении банка',
      this.banksChanged.bind(this),
    );
  }

  deleteBank(bankId: number): void {
    this.performRequest(
      HttpMethod.DELETE,
      `/api/money/bank/${bankId}`,
      null,
      null,
      null,
      'Банк успешно удалён',
      'Ошибка при удалении валюты',
      this.banksChanged.bind(this),
    );
  }

  banksChanged(): void {
    this.dataSharingService.dataChanged$.emit();
    this.getBanks();
  }

  // ACCOUNTS //////////////////////////////////////////////////////////////////////////////////////////////////////////

  getAccounts(): void {
    this.performRequest(
      HttpMethod.GET,
      '/api/money/account',
      null,
      this.accounts$$,
      'accounts_list',
      'Счета получены',
      'Ошибка при запросе счетов',
    );
  }

  createAccount(account: Account): void {
    this.performRequest(
      HttpMethod.POST,
      '/api/money/account',
      account,
      null,
      null,
      'Счёт успешно cоздан',
      'Ошибка при создании счёта',
      this.accountsChanged.bind(this),
    );
  }

  updateAccount(account: Account): void {
    this.performRequest(
      HttpMethod.PUT,
      `/api/money/account/${account.id}`,
      account,
      null,
      null,
      'Счёт успешно изменён',
      'Ошибка при изменении счёта',
      this.accountsChanged.bind(this),
    );
  }

  deleteAccount(accountId: number): void {
    this.performRequest(
      HttpMethod.DELETE,
      `/api/money/account/${accountId}`,
      null,
      null,
      null,
      'Счёт успешно удалён',
      'Ошибка при удалении счёта',
      this.accountsChanged.bind(this),
    );
  }

  accountsChanged(): void {
    this.dataSharingService.dataChanged$.emit();
    this.getAccounts();
  }

  // CATEGORIES ////////////////////////////////////////////////////////////////////////////////////////////////////////

  getCategories(): void {
    this.performRequest(
      HttpMethod.GET,
      '/api/money/category',
      null,
      this.categories$$,
      'categories_list',
      'Категории получены',
      'Ошибка при запросе категорий',
    );
  }

  createCategory(category: Category): void {
    this.performRequest(
      HttpMethod.POST,
      '/api/money/category',
      category,
      null,
      null,
      'Категория успешно cоздана',
      'Ошибка при создании категории',
      this.categoriesChanged.bind(this),
    );
  }

  updateCategory(category: Category): void {
    this.performRequest(
      HttpMethod.PUT,
      `/api/money/category/${category.id}`,
      category,
      null,
      null,
      'Категория успешно изменена',
      'Ошибка при изменении категории',
      this.categoriesChanged.bind(this),
    );
  }

  deleteCategory(categoryId: number): void {
    this.performRequest(
      HttpMethod.DELETE,
      `/api/money/category/${categoryId}`,
      null,
      null,
      null,
      'Категория успешно удаленa',
      'Ошибка при удалении категории',
      this.categoriesChanged.bind(this),
    );
  }

  categoriesChanged(): void {
    this.dataSharingService.dataChanged$.emit();
    this.getCategories();
  }

  // TRANSACTIONS //////////////////////////////////////////////////////////////////////////////////////////////////////

  getTransactions(day?: string): void {
    this.performRequest(
      HttpMethod.GET,
      `/api/money/transaction/${day ?? dateToIsoNoTimeNoTZ(new Date().getTime())}`,
      null,
      this.transactions$$,
      'transactions_list',
      'Транзакции получены',
      'Ошибка при запросе транзакций',
    );
  }

  createTransaction(transaction: Transaction): void {
    this.performRequest(
      HttpMethod.POST,
      '/api/money/transaction',
      transaction,
      null,
      null,
      'Транзакция успешно cоздана',
      'Ошибка при создании транзакции',
      this.transactionsChanged.bind(this),
    );
  }

  updateTransaction(transaction: Transaction): void {
    this.performRequest(
      HttpMethod.PUT,
      `/api/money/transaction/${transaction.id}`,
      transaction,
      null,
      null,
      'Транзакция успешно изменена',
      'Ошибка при изменении транзакции',
      this.transactionsChanged.bind(this),
    );
  }

  deleteTransaction(transactionId: number): void {
    this.performRequest(
      HttpMethod.DELETE,
      `/api/money/transaction/${transactionId}`,
      null,
      null,
      null,
      'Транзакция успешно удаленa',
      'Ошибка при удалении транзакции',
      this.transactionsChanged.bind(this),
    );
  }

  transactionsChanged(): void {
    this.dataSharingService.dataChanged$.emit();
    this.getTransactions(this.currentDay);
  }
}
