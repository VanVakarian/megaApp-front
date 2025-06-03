import { Component, OnInit } from '@angular/core';
import { CurrencyList } from './currency-list/currency-list';

@Component({
  selector: 'money-screen',
  templateUrl: './money-screen.html',
  standalone: true,
  imports: [CurrencyList],
})
export class MoneyScreen implements OnInit {
  public ngOnInit(): void {}
}
