import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { Category, CategoryType } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { CategoryForm } from './category-form/category-form';

@Component({
  selector: 'categories-list',
  templateUrl: './categories-list.html',
  imports: [CategoryForm, DefaultModal, VButton, VCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesList {
  protected readonly categories$$ = computed(() => this.moneyService.categories$$());
  protected readonly showForm$$ = signal(false);
  protected readonly editingCategory$$ = signal<Category | null>(null);
  protected readonly isDeleteConfirmOpen$$ = signal(false);
  private readonly pendingDeleteId$$ = signal<number | null>(null);

  constructor(private moneyService: MoneyService) {}

  protected showCreateForm(): void {
    this.editingCategory$$.set(null);
    this.showForm$$.set(true);
  }

  protected editCategory(category: Category): void {
    this.editingCategory$$.set(category);
    this.showForm$$.set(true);
  }

  protected deleteCategory(id: number): void {
    this.openConfirmationModal(id);
  }

  private openConfirmationModal(id: number): void {
    this.pendingDeleteId$$.set(id);
    this.isDeleteConfirmOpen$$.set(true);
  }

  protected closeConfirmationModal(): void {
    this.isDeleteConfirmOpen$$.set(false);
    this.pendingDeleteId$$.set(null);
  }

  protected onDeleteConfirmed(): void {
    const id = this.pendingDeleteId$$();
    this.isDeleteConfirmOpen$$.set(false);
    this.pendingDeleteId$$.set(null);
    if (!id) return;
    this.moneyService.deleteCategory(id).subscribe((success) => {});
  }

  protected onSaved(): void {
    this.showForm$$.set(false);
    this.editingCategory$$.set(null);
  }

  protected onCancelled(): void {
    this.showForm$$.set(false);
    this.editingCategory$$.set(null);
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
