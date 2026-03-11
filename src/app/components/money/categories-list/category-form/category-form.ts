import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Category, CategoryType } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { VInput } from '@ui-kit/components/v-input/v-input';

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  imports: [FormsModule, VButton, VDropdown, VInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryForm {
  public readonly categoryInput = input<Category | null>(null);
  public readonly categoriesInput = input<Category[]>([]);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  protected readonly name$$ = signal('');
  protected readonly categoryType$$ = signal<CategoryType>(CategoryType.EXPENSE);
  protected readonly parentId$$ = signal<string | null>(null);

  constructor(private moneyService: MoneyService) {
    effect(() => {
      const currentCategory = this.categoryInput();
      if (currentCategory) {
        this.fillForm(currentCategory);
      } else {
        this.resetForm();
      }
    });
  }

  protected save(): void {
    if (!this.name$$() || !this.categoryType$$()) return;

    const categoryData: Category = {
      name: this.name$$(),
      categoryType: this.categoryType$$(),
      parentId: this.parentId$$() ? Number(this.parentId$$()) : null,
    };

    const currentCategory = this.categoryInput();
    if (currentCategory?.id) {
      categoryData.id = currentCategory.id;
      this.moneyService.updateCategory(categoryData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    } else {
      this.moneyService.createCategory(categoryData).subscribe((success) => {
        if (success) {
          this.savedOutput.emit();
        }
      });
    }
  }

  protected cancel(): void {
    this.cancelledOutput.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.categoryInput()?.id);
  }

  private getCategoryTypeValues(): CategoryType[] {
    return Object.values(CategoryType);
  }

  protected categoryTypeItems(): DropdownItem[] {
    return this.getCategoryTypeValues().map((value) => ({
      value,
      label: this.getCategoryTypeDisplayName(value),
    }));
  }

  private getCategoryTypeDisplayName(categoryType: CategoryType): string {
    switch (categoryType) {
      case CategoryType.INCOME:
        return 'Income';
      case CategoryType.EXPENSE:
        return 'Expense';
      default:
        return categoryType;
    }
  }

  private getParentCategories(): Category[] {
    const currentId = this.categoryInput()?.id;
    return this.categoriesInput()
      .filter((category) => category.categoryType === this.categoryType$$() && category.id !== currentId)
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
    const parentId = this.parentId$$() ? Number(this.parentId$$()) : null;
    if (!parentId) return;
    const parentCategory = this.categoriesInput().find((category) => category.id === parentId);
    if (!parentCategory || parentCategory.categoryType !== this.categoryType$$()) {
      this.parentId$$.set(null);
    }
  }

  private fillForm(category: Category): void {
    this.name$$.set(category.name);
    this.categoryType$$.set(category.categoryType);
    this.parentId$$.set(category.parentId ? String(category.parentId) : null);
  }

  private resetForm(): void {
    this.name$$.set('');
    this.categoryType$$.set(CategoryType.EXPENSE);
    this.parentId$$.set(null);
  }
}
