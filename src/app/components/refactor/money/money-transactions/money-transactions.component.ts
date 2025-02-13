import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

import { MoneyService } from '@app/components/refactor/service/money.service';
import { slideInOutAnimation } from '@app/shared/animations';
import { Transaction } from '@app/shared/interfaces';
import { dateToIsoNoTimeNoTZ, divideNumberWithWhitespaces, generateDatesList, splitNumber } from '@app/shared/utils';

@Component({
  selector: 'app-money-transactions',
  templateUrl: './money-transactions.component.html',
  styleUrls: ['./money-transactions.component.scss'],
  animations: [slideInOutAnimation],
})
export class MoneyTransactionsComponent implements OnInit {
  direction: string = 'left';
  calendarSelectedDay: FormControl = new FormControl(new Date());
  today: Date = new Date();
  todayDate: number = this.today.setHours(0, 0, 0, 0);
  selectedDateMs: number = this.todayDate;
  selectedDateISO: string = dateToIsoNoTimeNoTZ(this.today.getTime());
  daysList: string[] = [];

  constructor(
    private cdRef: ChangeDetectorRef,
    public moneyService: MoneyService,
  ) {}

  getCategoryTitle(transaction: Transaction) {
    const categoryId = transaction.category_id;
    return this.moneyService.categories$$()?.[categoryId]['title'];
  }

  formatTransactionAmount(transactionId: number | null) {
    if (transactionId) {
      const accountId = this.moneyService.transactions$$()?.[transactionId].account_id;
      const currencyId = this.moneyService.accounts$$()?.[accountId].currency_id;
      const symbol = this.moneyService.currencies$$()?.[currencyId].symbol;
      const symbolPos = this.moneyService.currencies$$()?.[currencyId].symbol_pos;
      const whitespace = this.moneyService.currencies$$()?.[currencyId].whitespace ? ' ' : '';
      const amount = this.moneyService.transactions$$()?.[transactionId].amount;

      const [sign, integer, decimal] = splitNumber(String(amount));
      const integerDivided = divideNumberWithWhitespaces(integer);
      const amountPrepped = `${sign}${integerDivided}${decimal}`;

      return symbolPos == 'prefix'
        ? `${symbol}${whitespace}${amountPrepped}`
        : `${amountPrepped}${whitespace}${symbol}`;
    }
    return '';
  }

  formatTransactionNotes(transaction: Transaction) {
    const notes = transaction.notes;
    return `${notes ? ' (' : ''}${notes}${notes ? ')' : ''}`;
  }

  getOutgoingTransferAccountTitle(transactionId: number) {
    const accountId = this.moneyService.transactions$$()?.[transactionId].account_id;
    return this.moneyService.accounts$$()?.[accountId]['title'];
  }

  getIncomingTransferAccountTitle(incomingTransactionId: number | null) {
    const incomingTransactionAccountId = this.moneyService.transactions$$()?.[incomingTransactionId!].account_id;
    return this.moneyService.accounts$$()?.[incomingTransactionAccountId]['title'];
  }

  onDatePicked(event: MatDatepickerInputEvent<Date>) {
    if (!event.value) {
      return;
    }

    const newDateMs = event.value.getTime();

    if (newDateMs > this.selectedDateMs) {
      this.direction = 'left';
    } else if (newDateMs < this.selectedDateMs) {
      this.direction = 'right';
    }

    this.cdRef.detectChanges();
    this.selectedDateMs = newDateMs;
    this.selectedDateISO = dateToIsoNoTimeNoTZ(newDateMs);

    this.regenerateDaysList();
  }

  next(): void {
    this.direction = 'left';
    this.cdRef.detectChanges();
    this.switchCurrentDay(1);
  }

  previous(): void {
    this.direction = 'right';
    this.cdRef.detectChanges();
    this.switchCurrentDay(-1);
  }

  switchCurrentDay(shift: number) {
    const newDay = new Date(this.selectedDateMs);
    newDay.setDate(newDay.getDate() + shift);
    this.selectedDateMs = newDay.getTime();
    this.selectedDateISO = dateToIsoNoTimeNoTZ(this.selectedDateMs);
    this.calendarSelectedDay.setValue(new Date(this.selectedDateMs));

    this.regenerateDaysList();
  }

  regenerateDaysList() {
    const dayIdx = this.daysList.indexOf(this.selectedDateISO);

    if (dayIdx < 5 || dayIdx > 15) {
      this.daysList = generateDatesList(this.selectedDateISO);
      this.moneyService.getTransactions(this.selectedDateISO);
    }
  }

  isLastDay(): boolean {
    return this.today.getTime() === this.selectedDateMs;
  }

  formatDate(dateIso: string): string {
    const date = new Date(dateIso);
    const result = date.toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' });
    return result.replace(result[0], result[0].toUpperCase());
  }

  ngOnInit(): void {
    this.daysList = generateDatesList(this.selectedDateISO);
  }
}
