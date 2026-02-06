import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
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
  imports: [CurrenciesList, CategoriesList, AccountsList, TransactionsList, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoneyScreen implements OnInit {
  protected readonly Icon = IconName;
  protected readonly MoneyTab = MoneyTab;
  protected readonly activeTab$$ = signal<MoneyTab>(MoneyTab.Transactions);

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    firstValueFrom(this.moneyService.getCurrencies());
    firstValueFrom(this.moneyService.getCategories());
    firstValueFrom(this.moneyService.getAccounts());
    firstValueFrom(this.moneyService.getTransactions());
  }

  protected setActiveTab(tab: MoneyTab): void {
    this.activeTab$$.set(tab);
  }
}
