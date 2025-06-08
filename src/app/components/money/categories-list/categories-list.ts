import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MoneyService } from '@app/services/money.service';
import { Category } from '@app/shared/interfaces';
import { CategoryForm } from './category-form/category-form';

@Component({
  selector: 'categories-list',
  templateUrl: './categories-list.html',
  standalone: true,
  imports: [CommonModule, CategoryForm],
})
export class CategoriesList implements OnInit {
  protected categories: Category[] = [];
  protected showForm = false;
  protected editingCategory: Category | null = null;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.moneyService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  protected showCreateForm(): void {
    this.editingCategory = null;
    this.showForm = true;
  }

  protected editCategory(category: Category): void {
    this.editingCategory = category;
    this.showForm = true;
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingCategory = null;
    this.loadCategories();
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingCategory = null;
  }

  protected deleteCategory(id: number): void {
    this.moneyService.deleteCategory(id).subscribe((success) => {
      if (success) {
        this.loadCategories();
      }
    });
  }

  protected getUsedForDisplayName(usedFor: string): string {
    return usedFor.charAt(0).toUpperCase() + usedFor.slice(1);
  }
}
