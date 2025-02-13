import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';

@Component({
  selector: 'app-money-bank',
  templateUrl: './money-bank.component.html',
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*', minHeight: '*' })),
      transition('expanded <=> collapsed', animate('100ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class MoneyBankComponent implements OnInit {
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  constructor(
    private dataSharingService: DataSharingService,
    public moneyService: MoneyService,
  ) {}

  closeAllPanels() {
    this.accordion.closeAll();
  }

  bankExpanded(bankId: number) {
    this.dataSharingService.bankClicked$.emit(bankId);
  }

  ngOnInit(): void {
    this.dataSharingService.dataChanged$.subscribe(() => {
      this.closeAllPanels();
    });
  }
}
