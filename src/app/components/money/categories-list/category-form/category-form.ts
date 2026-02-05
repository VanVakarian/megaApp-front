import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Category, CategoryType } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { VInput } from '@ui-kit/components/v-input/v-input';

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  standalone: true,
  imports: [FormsModule, VButton, VCard, VDropdown, VInput],
})
export class CategoryForm implements OnInit {
  public readonly category = input<Category | null>(null);
  public readonly categories = input<Category[]>([]);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  protected name = '';
  protected categoryType: CategoryType = CategoryType.EXPENSE;
  protected parentId: string | null = null;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    const currentCategory = this.category();
    if (currentCategory) {
      this.fillForm(currentCategory);
    }
  }

  protected save(): void {
    if (!this.name || !this.categoryType) return;

    const categoryData: Category = {
      name: this.name,
      categoryType: this.categoryType,
      parentId: this.parentId ? Number(this.parentId) : null,
    };

    const currentCategory = this.category();
    if (currentCategory?.id) {
      categoryData.id = currentCategory.id;
      this.moneyService.updateCategory(categoryData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    } else {
      this.moneyService.createCategory(categoryData).subscribe((success) => {
        if (success) {
          this.saved.emit();
        }
      });
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.category()?.id);
  }

  protected getCategoryTypeValues(): CategoryType[] {
    return Object.values(CategoryType);
  }

  protected categoryTypeItems(): DropdownItem[] {
    return this.getCategoryTypeValues().map((value) => ({
      value,
      label: this.getCategoryTypeDisplayName(value),
    }));
  }

  protected getCategoryTypeDisplayName(categoryType: CategoryType): string {
    switch (categoryType) {
      case CategoryType.INCOME:
        return 'Income';
      case CategoryType.EXPENSE:
        return 'Expense';
      default:
        return categoryType;
    }
  }

  protected getParentCategories(): Category[] {
    const currentId = this.category()?.id;
    return this.categories()
      .filter((category) => category.categoryType === this.categoryType && category.id !== currentId)
      .filter((category) => !category.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  protected parentCategoryItems(): DropdownItem[] {
    return [
      { value: '', label: 'No parent' },
      ...this.getParentCategories().map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    ];
  }

  protected onCategoryTypeChange(): void {
    const parentId = this.parentId ? Number(this.parentId) : null;
    if (!parentId) return;
    const parentCategory = this.categories().find((category) => category.id === parentId);
    if (!parentCategory || parentCategory.categoryType !== this.categoryType) {
      this.parentId = null;
    }
  }

  private fillForm(category: Category): void {
    this.name = category.name;
    this.categoryType = category.categoryType;
    this.parentId = category.parentId ? String(category.parentId) : null;
  }
}
