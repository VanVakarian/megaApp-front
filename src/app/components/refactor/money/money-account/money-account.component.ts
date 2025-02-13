import { Component, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';

@Component({
  selector: 'app-money-account',
  templateUrl: './money-account.component.html',
})
export class MoneyAccountComponent implements OnInit {
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  constructor(
    private dataSharingService: DataSharingService,
    public moneyService: MoneyService,
  ) {}

  accountExpanded(accountId: number) {
    this.dataSharingService.accountClicked$.emit(accountId);
  }

  closeAllPanels() {
    this.accordion.closeAll();
  }

  ngOnInit(): void {
    this.dataSharingService.dataChanged$.subscribe(() => {
      this.closeAllPanels();
    });
  }
}
