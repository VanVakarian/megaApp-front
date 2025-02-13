import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { MoneyService } from '@app/components/refactor/service/money.service';
import { ConfirmationDialogModalService } from '@app/shared/dialog-modal/mat-dialog-modal.service';
import { Account, Transaction } from '@app/shared/interfaces';

@Component({
  selector: 'app-transaction-transfer-form',
  templateUrl: './transaction-transfer-form.component.html',
})
export class TransactionTransferForm implements OnInit, OnDestroy {
  @Input() sourceTransaction!: Transaction;
  @Input() formRole: string = '';
  @Input() transactionDate: string = '';

  targetTransaction!: Transaction;
  chosenSourceAccountsCurrencySymbol = '';
  chosenSourceAccountsCurrencyPosition = '';
  chosenTargetAccountsCurrencySymbol = '';
  chosenTargetAccountsCurrencyPosition = '';

  constructor(
    private confirmModal: ConfirmationDialogModalService,
    public moneyService: MoneyService,
  ) {}

  transactionForm = new FormGroup({
    id: new FormControl(0),
    date: new FormControl(''),
    amount: new FormControl(
      this.sourceTransaction ? this.sourceTransaction.amount : null,
      // a negaitve or a positive number with or without a decimal part, with one or two digits after a dot (or a comma)
      [Validators.required, Validators.pattern(/^[-+]?\d+([.,]\d{1,2})?$/)],
    ),
    account_id: new FormControl(0, [Validators.min(1)]),
    category_id: new FormControl(0, [Validators.min(1)]),
    kind: new FormControl(''),
    is_gift: new FormControl(false),
    notes: new FormControl(''),
    twin_transaction_id: new FormControl(0),
    target_account_id: new FormControl(0, [Validators.min(1)]),
    target_account_amount: new FormControl(
      this.targetTransaction ? this.targetTransaction.amount : null,
      // a negaitve or a positive number with or without a decimal part, with one or two digits after a dot (or a comma)
      [Validators.required, Validators.pattern(/^[-+]?\d+([.,]\d{1,2})?$/)],
    ),
  });

  updateChosenSourceCurrencyId(isUserInput: boolean, account: Account) {
    if (isUserInput) {
      const sourceCurrencyId = account.currency_id;
      this.chosenSourceAccountsCurrencySymbol = this.moneyService.currencies$$()?.[sourceCurrencyId].symbol;
      this.chosenSourceAccountsCurrencyPosition = this.moneyService.currencies$$()?.[sourceCurrencyId].symbol_pos;
    }
  }

  updateChosenTargetCurrencyId(isUserInput: boolean, account: Account) {
    if (isUserInput) {
      const targetCurrencyId = account.currency_id;
      this.chosenTargetAccountsCurrencySymbol = this.moneyService.currencies$$()?.[targetCurrencyId].symbol;
      this.chosenTargetAccountsCurrencyPosition = this.moneyService.currencies$$()?.[targetCurrencyId].symbol_pos;
    }
  }

  onSubmit() {
    this.transactionForm.value.kind = 'transfer';
    this.transactionForm.value.date = this.transactionDate;
    this.transactionForm.value.amount = Math.abs(this.transactionForm.value.amount!);
    this.transactionForm.value.target_account_amount = Math.abs(this.transactionForm.value.target_account_amount!);
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
    if (this.sourceTransaction) {
      this.targetTransaction = this.moneyService.transactions$$()?.[this.sourceTransaction.twin_transaction_id!];

      this.transactionForm.patchValue(this.sourceTransaction as Transaction);
      this.transactionForm.get('target_account_id')?.setValue(this.targetTransaction.account_id);
      this.transactionForm.get('target_account_amount')?.setValue(this.targetTransaction.amount);

      const sourceAccountId = this.sourceTransaction.account_id;
      const sourceCurrencyId = this.moneyService.accounts$$()?.[sourceAccountId].currency_id;
      this.chosenSourceAccountsCurrencySymbol = this.moneyService.currencies$$()?.[sourceCurrencyId].symbol;
      this.chosenSourceAccountsCurrencyPosition = this.moneyService.currencies$$()?.[sourceCurrencyId].symbol_pos;

      const targetAccountId = this.targetTransaction.account_id;
      const targetCurrencyId = this.moneyService.accounts$$()?.[targetAccountId].currency_id;
      this.chosenTargetAccountsCurrencySymbol = this.moneyService.currencies$$()?.[targetCurrencyId].symbol;
      this.chosenTargetAccountsCurrencyPosition = this.moneyService.currencies$$()?.[targetCurrencyId].symbol_pos;
    }
  }

  ngOnDestroy(): void {}
}
