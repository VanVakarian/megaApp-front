import { Component, OnInit } from '@angular/core';
import { MoneyService } from '../../services/money.service';
import { AccountsList } from './accounts-list/accounts-list';
import { CategoriesList } from './categories-list/categories-list';
import { CurrencyList } from './currency-list/currency-list';

enum MoneyTab {
  Currencies = 'currencies',
  Categories = 'categories',
  Accounts = 'accounts',
}

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  standalone: true,
  imports: [CurrencyList, CategoriesList, AccountsList],
})
export class MoneyScreen implements OnInit {
  public readonly MoneyTab = MoneyTab;
  public activeTab: MoneyTab = MoneyTab.Accounts;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.moneyService.initializeData();
  }

  public setActiveTab(tab: MoneyTab): void {
    this.activeTab = tab;
  }
}
