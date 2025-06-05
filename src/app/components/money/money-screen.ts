import { Component, OnInit } from '@angular/core';
import { MoneyService } from '../../services/money.service';
import { CategoriesList } from './currency-list/categories-list/categories-list';
import { CurrencyList } from './currency-list/currency-list';

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  standalone: true,
  imports: [CurrencyList, CategoriesList],
})
export class MoneyScreen implements OnInit {
  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.moneyService.initializeData();
  }
}
