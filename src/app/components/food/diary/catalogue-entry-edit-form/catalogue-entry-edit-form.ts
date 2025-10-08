import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';

@Component({
  selector: 'catalogue-entry-edit-form',
  templateUrl: './catalogue-entry-edit-form.html',
  imports: [ReactiveFormsModule, VButton, VIcon],
})
export class CatalogueEntryEditFormComponent {
  protected readonly Icon = IconName;

  protected catalogueEditForm: FormGroup = new FormGroup({
    foodWeight: new FormControl<number | null>(null, [Validators.required, Validators.pattern(/^\d+$/)]),
  });

  protected isFormValid(): boolean {
    return this.catalogueEditForm.valid;
  }

  protected submitForm(): void {
    // throw new Error('Method not implemented.');
  }

  protected goBack(): void {
    // throw new Error('Method not implemented.');
  }
}
