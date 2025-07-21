import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MoneyService } from '../../services/money.service';
import { AccountsList } from './accounts-list/accounts-list';
import { CategoriesList } from './categories-list/categories-list';
import { CurrenciesList } from './currencies-list/currencies-list';
import { TransactionsList } from './transactions-list/transactions-list';

enum MoneyTab {
  Currencies = 'currencies',
  Categories = 'categories',
  Accounts = 'accounts',
  Transactions = 'transactions',
}

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  standalone: true,
  imports: [CurrenciesList, CategoriesList, AccountsList, TransactionsList],
})
export class MoneyScreen implements OnInit {
  public readonly MoneyTab = MoneyTab;
  public activeTab: MoneyTab = MoneyTab.Transactions;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    firstValueFrom(this.moneyService.getCurrencies());
    firstValueFrom(this.moneyService.getCategories());
    firstValueFrom(this.moneyService.getAccounts());
    firstValueFrom(this.moneyService.getTransactions());
  }

  public setActiveTab(tab: MoneyTab): void {
    this.activeTab = tab;
  }
}
