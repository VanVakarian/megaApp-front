import { Component, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';

@Component({
  selector: 'app-money-currency',
  templateUrl: './money-currency.component.html',
})
export class MoneyCurrencyComponent implements OnInit {
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  constructor(
    private dataSharingService: DataSharingService,
    public moneyService: MoneyService,
  ) {}

  closeAllPanels() {
    this.accordion.closeAll();
  }

  currencyExpanded(currencyId: number) {
    this.dataSharingService.currencyClicked$.emit(currencyId);
  }

  ngOnInit(): void {
    this.dataSharingService.dataChanged$.subscribe(() => {
      this.closeAllPanels();
    });
  }
}
