import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { ProductPreviewData, ProductSaveRequest } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';

enum FormMode {
  Create = 'create',
  Edit = 'edit',
}

@Component({
  selector: 'catalogue-entry-edit-form',
  templateUrl: './catalogue-entry-edit-form.html',
  imports: [CommonModule, ReactiveFormsModule, VButton, VIcon, VInput],
})
export class CatalogueEntryEditForm implements OnInit {
  protected readonly Icon = IconName;

  private readonly foodAddModalService = inject(FoodAddModalService);
  private readonly foodCatalogueService = inject(FoodCatalogueService);

  protected formMode = FormMode;
  protected readonly mode$$ = computed(() => {
    const selectedProduct = this.foodAddModalService.selectedProduct$$();
    return selectedProduct ? this.formMode.Edit : this.formMode.Create;
  });

  protected readonly productToEdit$$ = computed(() => this.foodAddModalService.selectedProduct$$());

  protected readonly isLoadingPreview$$ = signal(false);
  protected readonly isSaving$$ = signal(false);
  protected readonly error$$ = signal<string | null>(null);

  protected readonly searchQuery$$ = computed(() => this.foodAddModalService.searchQuery$$());

  protected catalogueEditForm: FormGroup = new FormGroup({
    name: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]),
    kcals: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(1000)]),
    protein: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    fat: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    carbs: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    fiber: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(50)]),
    description: new FormControl<string>('', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(2000),
    ]),
  });

  public async ngOnInit(): Promise<void> {
    const mode = this.mode$$();

    if (mode === this.formMode.Edit) {
      this.loadExistingProductData();
    } else {
      await this.loadProductPreview();
    }
  }

  private loadExistingProductData(): void {
    const product = this.productToEdit$$();

    console.log('[CatalogueEditForm] Loading existing product data:', product);

    if (!product) {
      this.error$$.set('No product selected for editing');
      return;
    }

    this.catalogueEditForm.patchValue({
      name: product.name,
      kcals: product.kcals,
      protein: product.protein,
      fat: product.fat,
      carbs: product.carbs,
      fiber: product.fiber,
      description: product.description,
    });

    console.log('[CatalogueEditForm] Form values after patching:', this.catalogueEditForm.value);
  }

  private async loadProductPreview(): Promise<void> {
    const query = this.searchQuery$$();

    if (!query || query.trim().length === 0) {
      this.error$$.set('Search query is empty');
      return;
    }

    this.isLoadingPreview$$.set(true);
    this.error$$.set(null);

    try {
      const previewData = await this.foodCatalogueService.generateProductPreview(query);
      this.fillFormWithPreviewData(previewData);
    } catch (error: any) {
      console.error('Failed to load product preview:', error);
      this.error$$.set('Failed to generate product data. Please try again.');
    } finally {
      this.isLoadingPreview$$.set(false);
    }
  }

  private fillFormWithPreviewData(data: ProductPreviewData): void {
    this.catalogueEditForm.patchValue({
      name: data.generalizedName,
      kcals: data.kcals,
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs,
      fiber: data.fiber,
      description: data.description,
    });
  }

  protected isFormValid(): boolean {
    return this.catalogueEditForm.valid;
  }

  protected async submitForm(): Promise<void> {
    if (!this.isFormValid() || this.isSaving$$()) {
      return;
    }

    this.isSaving$$.set(true);
    this.error$$.set(null);

    try {
      const formValue = this.catalogueEditForm.value;
      const mode = this.mode$$();
      const productToEdit = this.productToEdit$$();

      const productData: ProductSaveRequest = {
        name: formValue.name,
        kcals: Number(formValue.kcals) || 0,
        protein: Number(formValue.protein) || 0,
        fat: Number(formValue.fat) || 0,
        carbs: Number(formValue.carbs) || 0,
        fiber: Number(formValue.fiber) || 0,
        description: formValue.description,
      };

      console.log('[CatalogueEditForm] Product data to save:', productData);

      if (mode === this.formMode.Edit && productToEdit) {
        productData.id = productToEdit.id;
      }

      const savedProduct = await this.foodCatalogueService.saveProduct(productData);

      console.log('[CatalogueEditForm] Product saved successfully:', savedProduct);
      console.log('[CatalogueEditForm] Mode:', mode);

      this.foodAddModalService.selectedProduct$$.set(savedProduct);

      if (mode === this.formMode.Create) {
        this.foodCatalogueService.searchProducts(this.searchQuery$$());
      }

      this.foodAddModalService.submitSuccess();
    } catch (error: any) {
      console.error('Failed to save product:', error);

      if (error?.error?.error?.includes('already exists')) {
        this.error$$.set('Product with this name already exists. Please use a different name.');
      } else {
        this.error$$.set('Failed to save product. Please try again.');
      }
    } finally {
      this.isSaving$$.set(false);
    }
  }

  protected goBack(): void {
    this.foodAddModalService.goBackToSearch();
  }
}
