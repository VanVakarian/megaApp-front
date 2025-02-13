import { NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { firstValueFrom } from 'rxjs';

import { FoodService } from '@app/services/food.service';
import { SettingsService } from '@app/services/settings.service';
import { CatalogueEntry } from '@app/shared/interfaces';

export function uniqueCatalogueNameValidator(foodService: FoodService, isNewForm: boolean): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!isNewForm) return null; // Пропускаем валидацию, если это не новая форма

    const name = control?.value?.trim().toLowerCase();
    const catalogue = foodService.catalogue$$();
    const isDuplicate = Object.values(catalogue).some((entry) => entry.name.trim().toLowerCase() === name);
    return isDuplicate ? { duplicateName: { value: control.value } } : null;
  };
}

@Component({
  selector: 'app-food-catalogue-form',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './food-catalogue-form.component.html',
})
export class FoodCatalogueFormComponent implements OnInit, OnChanges {
  @Input() categoryEntry?: CatalogueEntry;
  @Input() formRole: string = '';
  // @Output() ownershipChanged = new EventEmitter<number>();

  catalogueEntry: CatalogueEntry = {} as CatalogueEntry;
  initialValues: CatalogueEntry = {} as CatalogueEntry;
  queryPending: boolean = false;

  public foodForm: FormGroup = new FormGroup([]);

  constructor(
    public foodService: FoodService,
    private settingsService: SettingsService,
    private cd: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(): void {
    if (this.categoryEntry) {
      this.foodForm.patchValue(this.categoryEntry as CatalogueEntry);
      this.initialValues = { ...this.categoryEntry };
    }
    this.foodForm
      .get('name')
      ?.setValidators([Validators.required, uniqueCatalogueNameValidator(this.foodService, this.formRole === 'new')]);
    this.foodForm.get('name')?.updateValueAndValidity();
  }

  private initForm(): void {
    this.foodForm = new FormGroup({
      id: new FormControl(0),
      name: new FormControl('', [
        Validators.required,
        uniqueCatalogueNameValidator(this.foodService, this.formRole === 'new'),
      ]),
      kcals: new FormControl({ value: 0, disabled: !this.isAdmin }, [
        Validators.required,
        Validators.pattern(/^\d+$/), // Только цифры
      ]),
    });

    if (this.categoryEntry) {
      this.foodForm.patchValue(this.categoryEntry);
      this.initialValues = { ...this.categoryEntry };
    }

    this.foodForm.updateValueAndValidity();
  }

  public get isAdmin(): boolean {
    const isAdmin = this.settingsService.settings$$()?.isUserAdmin;
    return Boolean(isAdmin);
  }

  public isFormValid(): boolean {
    return this.foodForm.valid && this.checkIfFormChanged();
  }

  private checkIfFormChanged(): boolean {
    const oldName = this.initialValues.name;
    const newName = this.foodForm.value.name;
    const oldKcals = this.initialValues.kcals ? this.initialValues.kcals.toString() : '';
    const newKcals = this.foodForm.value.kcals ? this.foodForm.value.kcals.toString() : '';
    return oldName !== newName || oldKcals !== newKcals;
  }

  public async onSubmit(): Promise<void> {
    this.foodForm.disable();
    this.queryPending = true;

    const foodName = this.foodForm.value.name as string;
    const foodKcals = this.foodForm.value.kcals as number;
    if (this.formRole === 'new') {
      await firstValueFrom(this.foodService.createNewCatalogueEntry(foodName, foodKcals));
      this.initForm();
    } else if (this.formRole === 'edit') {
      const foodId = this.foodForm.value.id as number;
      const isSuccess = await firstValueFrom(this.foodService.editCatalogueEntry(foodId, foodName, foodKcals));
      if (!isSuccess) this.foodForm.patchValue(this.initialValues);
    }

    this.foodForm.enable();
    this.queryPending = false;
  }

  // USERS CATALOGUE
  public get isCatalogueEntryPicked(): boolean {
    if (this.categoryEntry && this.foodService.catalogueMyIds$$().includes(this.categoryEntry.id)) {
      return true;
    }
    return false;
  }

  public async switchOwnership(): Promise<void> {
    this.queryPending = true;
    const selectedFoodId = this.foodForm.value.id as number;
    if (selectedFoodId) {
      if (this.isCatalogueEntryPicked) {
        const isSuccess = await firstValueFrom(this.foodService.dismissUserFoodId(selectedFoodId));
        // if (isSuccess) this.ownershipChanged.emit(selectedFoodId);
      } else {
        const isSuccess = await firstValueFrom(this.foodService.pickUserFoodId(selectedFoodId));
        // if (isSuccess) this.ownershipChanged.emit(selectedFoodId);
      }
    }
    this.queryPending = false;
  }
}
