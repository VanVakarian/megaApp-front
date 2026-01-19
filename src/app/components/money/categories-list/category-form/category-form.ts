import { Component, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { Category, UsedFor } from '@app/shared/interfaces';

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  standalone: true,
  imports: [FormsModule],
})
export class CategoryForm implements OnInit {
  public readonly category = input<Category | null>(null);

  public readonly saved = output<void>();
  public readonly cancelled = output<void>();

  protected name = '';
  protected usedFor: UsedFor = UsedFor.TRANSACTION;
  protected groupKey = '';

  constructor(private moneyService: MoneyService) {}

  public ngOnInit(): void {
    const currentCategory = this.category();
    if (currentCategory) {
      this.fillForm(currentCategory);
    }
  }

  protected save(): void {
    if (!this.name || !this.usedFor) return;

    const categoryData: Category = {
      name: this.name,
      usedFor: this.usedFor,
      groupKey: this.groupKey,
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

  protected getUsedForValues(): UsedFor[] {
    return Object.values(UsedFor);
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
        return usedFor;
    }
  }

  private fillForm(category: Category): void {
    this.name = category.name;
    this.usedFor = category.usedFor;
    this.groupKey = category.groupKey || '';
  }
}
