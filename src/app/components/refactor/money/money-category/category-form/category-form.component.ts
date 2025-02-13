import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { DataSharingService } from '@app/components/refactor/service/data-sharing.service';
import { MoneyService } from '@app/components/refactor/service/money.service';
import { UtilsService } from '@app/components/refactor/service/utils.service';
import { ConfirmationDialogModalService } from '@app/shared/dialog-modal/mat-dialog-modal.service';
import { Category } from '@app/shared/interfaces';

@Component({
  selector: 'app-category-form',
  templateUrl: './category-form.component.html',
})
export class CategoryFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() formRole: string = '';
  @Input() categoryKind: string = '';
  @Input() categoryData!: Category;

  @ViewChild('inputTitle') inputTitleElem!: ElementRef;

  categoryForm: FormGroup = new FormGroup({
    id: new FormControl(0),
    title: new FormControl('', Validators.required),
    kind: new FormControl(''),
  });

  private categoryClickedSubscription: Subscription;

  constructor(
    private dataSharingService: DataSharingService,
    private confirmModal: ConfirmationDialogModalService,
    private utils: UtilsService,
    public moneyService: MoneyService,
  ) {
    this.categoryClickedSubscription = this.dataSharingService.categoryClicked$.subscribe(async (categoryId) => {
      if (this.categoryForm.value.id === categoryId) {
        await this.setFocusOnInput();
      }
    });
  }

  async setFocusOnInput() {
    await this.utils.sleep(100); // await is the duration of the panel expansion animation, otherwise focus messes with it.
    this.inputTitleElem.nativeElement.focus();
  }

  clearForm(): void {
    this.categoryForm.reset();
  }

  onSubmit(): void {
    if (this.formRole === 'new') {
      this.moneyService.createCategory(this.categoryForm.value as Category);
      this.clearForm();
    } else if (this.formRole === 'edit') {
      this.moneyService.updateCategory(this.categoryForm.value as Category);
    }
  }

  openConfirmationModal(actionQuestion: string): void {
    this.confirmModal.openModal(actionQuestion).subscribe((result) => {
      if (result) {
        this.moneyService.deleteCategory(this.categoryForm.value.id as number);
      }
    });
  }

  isFormValid(): boolean {
    return this.categoryForm.valid;
  }

  ngOnInit(): void {}

  ngOnChanges(): void {
    if (this.categoryData) {
      this.categoryForm.patchValue(this.categoryData);
    }

    if (this.categoryKind) {
      this.categoryForm.patchValue({ kind: this.categoryKind });
    }
  }

  ngOnDestroy(): void {
    this.categoryClickedSubscription.unsubscribe();
  }
}
