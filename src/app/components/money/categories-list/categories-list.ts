import { Component, computed } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Category, CategoryType } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { CategoryForm } from './category-form/category-form';

@Component({
  selector: 'categories-list',
  templateUrl: './categories-list.html',
  standalone: true,
  imports: [CategoryForm, VButton, VCard],
})
export class CategoriesList {
  protected categories$$ = computed(() => this.moneyService.categories$$());
  protected showForm = false;
  protected editingCategory: Category | null = null;

  constructor(private moneyService: MoneyService) {}

  protected showCreateForm(): void {
    this.editingCategory = null;
    this.showForm = true;
  }

  protected editCategory(category: Category): void {
    this.editingCategory = category;
    this.showForm = true;
  }

  protected deleteCategory(id: number): void {
    this.moneyService.deleteCategory(id).subscribe((success) => {});
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingCategory = null;
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingCategory = null;
  }

  protected getCategoryTypes(): CategoryType[] {
    return Object.values(CategoryType);
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

  protected getRootCategories(categoryType: CategoryType): Category[] {
    return this.categories$$()
      .filter((category) => category.categoryType === categoryType && !category.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  protected getChildCategories(parentId: number): Category[] {
    return this.categories$$()
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
