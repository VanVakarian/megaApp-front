import { CommonModule } from '@angular/common';
import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '../../../../../services/money.service';
import { Category, UsedFor } from '../../../../../shared/interfaces';

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class CategoryForm implements OnInit {
  public readonly category = input<Category | null>(null);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  // Form fields
  protected name = '';
  protected usedFor: UsedFor = UsedFor.TRANSACTION;
  protected groupKey = '';

  protected UsedFor = UsedFor;

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    const currentCategory = this.category();
    if (currentCategory) {
      this.fillForm(currentCategory);
    }
  }

  private fillForm(category: Category): void {
    this.name = category.name;
    this.usedFor = category.usedFor;
    this.groupKey = category.groupKey || '';
  }

  protected save(): void {
    if (!this.name || !this.usedFor) return;

    const categoryData: Category = {
      name: this.name,
      usedFor: this.usedFor,
      groupKey: this.groupKey || null,
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
    return !!this.category()?.id;
  }

  protected getUsedForValues(): UsedFor[] {
    return Object.values(UsedFor);
  }
}
