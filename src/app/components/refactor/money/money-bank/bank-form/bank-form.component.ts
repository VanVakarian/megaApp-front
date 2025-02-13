import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';
import { UtilsService } from '@app/components/refactor/service/utils.service';
import { ConfirmationDialogModalService } from '@app/shared/dialog-modal/mat-dialog-modal.service';
import { Bank } from '@app/shared/interfaces';

@Component({
  selector: 'app-bank-form',
  templateUrl: './bank-form.component.html',
})
export class BankFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() bankData!: Bank;
  @Input() formRole: string = '';

  @ViewChild('inputTitle') inputTitleElem!: ElementRef;

  public bankForm: FormGroup = new FormGroup({
    id: new FormControl(0),
    title: new FormControl('', Validators.required),
  });

  private bankClickedSubscription: Subscription;

  constructor(
    private dataSharingService: DataSharingService,
    private confirmModal: ConfirmationDialogModalService,
    private utils: UtilsService,
    public moneyService: MoneyService,
  ) {
    this.bankClickedSubscription = this.dataSharingService.bankClicked$.subscribe(async (bankId) => {
      if (this.bankForm.value.id === bankId) {
        await this.setFocusOnInput();
      }
    });
  }

  async setFocusOnInput() {
    await this.utils.sleep(100); // await is the duration of the panel expansion animation, otherwise focus messes with it.
    this.inputTitleElem.nativeElement.focus();
  }

  clearForm(): void {
    this.bankForm.reset();
  }

  onSubmit(): void {
    if (this.formRole === 'new') {
      this.moneyService.createBank(this.bankForm.value as Bank);
      this.clearForm();
    } else if (this.formRole === 'edit') {
      this.moneyService.updateBank(this.bankForm.value as Bank);
    }
  }

  openConfirmationModal(actionQuestion: string): void {
    this.confirmModal.openModal(actionQuestion).subscribe((result) => {
      if (result) {
        this.moneyService.deleteBank(this.bankForm.value.id as number);
      }
    });
  }

  isFormValid(): boolean {
    return this.bankForm.valid;
  }

  ngOnInit(): void {}

  ngOnChanges(): void {
    if (this.bankData) {
      this.bankForm.patchValue(this.bankData);
    }
  }

  ngOnDestroy(): void {
    this.bankClickedSubscription.unsubscribe();
  }
}
