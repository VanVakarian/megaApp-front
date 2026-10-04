import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartThemeService } from '@app/services/chart-theme.service';
import { MoneyService } from '@app/services/money.service';
import { hueToColor } from '@app/shared/categorical-palette';
import { Category, CategoryType } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VSlider } from '@ui-kit/components/v-slider/v-slider';

const HUE_GRADIENT_STOPS = [0, 60, 120, 180, 240, 300, 360];

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  imports: [FormsModule, VButton, VCheckbox, VDropdown, VInput, VSlider],
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
  protected readonly hiddenOnCharts$$ = signal(false);
  // null: the chart picks the color automatically.
  protected readonly hue$$ = signal<number | null>(null);

  private readonly chartThemeService = inject(ChartThemeService);

  // A category that transactions use keeps its type: the server rejects a change.
  protected readonly isTypeLocked$$ = computed(() => {
    const categoryId = this.categoryInput()?.id;
    return categoryId !== undefined && this.moneyService.transactions$$().some((tx) => tx.categoryId === categoryId);
  });

  protected readonly hueSwatchColor$$ = computed(() => {
    const hue = this.hue$$();
    return hue === null ? null : hueToColor(hue, this.chartThemeService.colors$$());
  });
  protected readonly hueTrackGradient$$ = computed(() => {
    const colors = this.chartThemeService.colors$$();
    return `linear-gradient(to right, ${HUE_GRADIENT_STOPS.map((hue) => hueToColor(hue, colors)).join(', ')})`;
  });

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
      hiddenOnCharts: this.hiddenOnCharts$$(),
      hue: this.hue$$(),
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

  // The server stores a whole-degree hue; a drag can land between degrees.
  protected onHueChange(value: number): void {
    this.hue$$.set(Math.round(value));
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
    this.hiddenOnCharts$$.set(Boolean(category.hiddenOnCharts));
    this.hue$$.set(category.hue ?? null);
  }

  private resetForm(): void {
    this.name$$.set('');
    this.categoryType$$.set(CategoryType.EXPENSE);
    this.parentId$$.set(null);
    this.hiddenOnCharts$$.set(false);
    this.hue$$.set(null);
  }
}
