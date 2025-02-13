import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { MoneyService } from '@app/components/refactor/service/money.service';
import { ConfirmationDialogModalService } from '@app/shared/dialog-modal/mat-dialog-modal.service';
import { Account, Transaction } from '@app/shared/interfaces';

@Component({
  selector: 'app-transaction-expense-income-form',
  templateUrl: './transaction-expense-income-form.component.html',
})
export class TransactionExpenseIncomeForm implements OnInit, OnDestroy {
  @Input() transaction!: Transaction;
  @Input() formRole: string = '';
  @Input() transactionKind: string = '';
  @Input() transactionDate: string = '';

  chosenAccount!: Account;
  chosenCurrencyId: number = 0;
  chosenAccountsCurrencySymbol = '';
  chosenAccountsCurrencyPosition = '';

  public transactionForm = new FormGroup({
    id: new FormControl(0),
    date: new FormControl(''),
    amount: new FormControl(
      this.transaction ? this.transaction.amount : null,
      // a negaitve or a positive number with or without a decimal part, with one or two digits after a dot (or a comma)
      [Validators.required, Validators.pattern(/^[-+]?\d+([.,]\d{1,2})?$/)],
    ),
    account_id: new FormControl(0, [Validators.min(1)]),
    category_id: new FormControl(0, [Validators.min(1)]),
    kind: new FormControl(''),
    is_gift: new FormControl(false),
    notes: new FormControl(''),
  });

  constructor(
    private confirmModal: ConfirmationDialogModalService,
    public moneyService: MoneyService,
  ) {}

  updateChosenCurrencyId(isUserInput: boolean, account: Account) {
    if (isUserInput) {
      const currencyId = account.currency_id;
      this.chosenAccountsCurrencySymbol = this.moneyService.currencies$$()?.[currencyId].symbol;
      this.chosenAccountsCurrencyPosition = this.moneyService.currencies$$()?.[currencyId].symbol_pos;
    }
  }

  onSubmit() {
    this.transactionForm.value.kind = this.transactionKind;
    this.transactionForm.value.date = this.transactionDate;

    if (this.transactionForm.value.amount) {
      this.transactionForm.value.amount = Math.abs(this.transactionForm.value.amount);
    }

    this.moneyService.currentDay = this.transactionDate;

    if (this.formRole === 'new') {
      this.moneyService.createTransaction(this.transactionForm.value as Transaction);
      this.clearForm();
    } else if (this.formRole === 'edit') {
      this.moneyService.updateTransaction(this.transactionForm.value as Transaction);
    }
  }

  openConfirmationModal(actionQuestion: string): void {
    this.confirmModal.openModal(actionQuestion).subscribe((result) => {
      if (result) {
        this.moneyService.currentDay = this.transactionDate;
        this.moneyService.deleteTransaction(this.transactionForm.value.id as number);
      }
    });
  }

  isFormValid(): boolean {
    return this.transactionForm.valid;
  }

  clearForm() {
    this.transactionForm.reset();
  }

  ngOnInit(): void {}

  ngOnChanges(): void {
    if (this.transaction) {
      this.transactionForm.patchValue(this.transaction as Transaction);

      const accountId = this.transaction.account_id;
      const currencyId = this.moneyService.accounts$$()?.[accountId].currency_id;
      this.chosenAccountsCurrencySymbol = this.moneyService.currencies$$()?.[currencyId].symbol;
      this.chosenAccountsCurrencyPosition = this.moneyService.currencies$$()?.[currencyId].symbol_pos;
    }
  }

  ngOnDestroy(): void {}
}
