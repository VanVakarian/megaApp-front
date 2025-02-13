import { Component, OnInit, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';

@Component({
  selector: 'app-money-category',
  templateUrl: './money-category.component.html',
})
export class MoneyCategoryComponent implements OnInit {
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  public categoryKind = [
    { key: 'expense', title: 'Расход' },
    { key: 'income', title: 'Доход' },
    { key: 'transfer', title: 'Перевод' },
  ];
  public activeCategoryKindKey = 'expense';

  constructor(
    private dataSharingService: DataSharingService,
    public moneyService: MoneyService,
  ) {}

  categoryExpanded(categoryId: number) {
    this.dataSharingService.categoryClicked$.emit(categoryId);
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
