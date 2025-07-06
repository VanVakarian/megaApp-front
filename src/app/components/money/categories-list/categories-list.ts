import { Component, computed } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Category, UsedFor } from '@app/shared/interfaces';
import { CategoryForm } from './category-form/category-form';

interface GroupedCategories {
  [usedFor: string]: {
    [groupKey: string]: Category[];
  };
}

@Component({
  selector: 'categories-list',
  templateUrl: './categories-list.html',
  standalone: true,
  imports: [CategoryForm],
})
export class CategoriesList {
  protected categories$$ = computed(() => this.moneyService.categories$$());
  protected groupedCategories$$ = computed(() => this.groupCategoriesByUsedForAndGroupKey(this.categories$$()));
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

  protected getUsedForKeys(): UsedFor[] {
    return Object.keys(this.groupedCategories$$()) as UsedFor[];
  }

  protected getGroupKeys(usedFor: UsedFor): string[] {
    return Object.keys(this.groupedCategories$$()[usedFor] || {});
  }

  protected getCategoriesOfGroup(usedFor: UsedFor, groupKey: string): Category[] {
    return this.groupedCategories$$()[usedFor]?.[groupKey] || [];
  }

  protected getUsedForDisplayName(usedFor: UsedFor): string {
    switch (usedFor) {
      case UsedFor.TRANSACTION:
        return 'Transactions';
      case UsedFor.ACCOUNT:
        return 'Accounts';
      case UsedFor.ASSET:
        return 'Assets';
      default:
        return String(usedFor).charAt(0).toUpperCase() + String(usedFor).slice(1);
    }
  }

  private groupCategoriesByUsedForAndGroupKey(categories: Category[]): GroupedCategories {
    const groupedCategories: GroupedCategories = {};

    categories.forEach((category) => {
      const usedFor = category.usedFor;
      const groupKey = category.groupKey;

      if (!groupedCategories[usedFor]) {
        groupedCategories[usedFor] = {};
      }
      if (!groupedCategories[usedFor][groupKey]) {
        groupedCategories[usedFor][groupKey] = [];
      }

      groupedCategories[usedFor][groupKey].push(category);
    });

    Object.keys(groupedCategories).forEach((usedFor) => {
      Object.keys(groupedCategories[usedFor]).forEach((groupKey) => {
        groupedCategories[usedFor][groupKey].sort((a, b) => a.name.localeCompare(b.name));
      });
    });

    return groupedCategories;
  }
}
