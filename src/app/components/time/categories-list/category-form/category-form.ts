import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeCatalogueService } from '@app/services/time/time-catalogue.service';
import { TimeCategory, TimeCategoryKind, TimeImpact } from '@app/shared/time-types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VColorPicker } from '@ui-kit/components/v-color-picker/v-color-picker';
import { DropdownItem, VDropdown } from '@ui-kit/components/v-dropdown/v-dropdown';
import { VInput } from '@ui-kit/components/v-input/v-input';

const NO_IMPACT_VALUE = '';

@Component({
  selector: 'category-form',
  templateUrl: './category-form.html',
  imports: [FormsModule, VButton, VCheckbox, VColorPicker, VDropdown, VInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryForm {
  public readonly categoryInput = input<TimeCategory | null>(null);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  protected readonly name$$ = signal('');
  protected readonly isArea$$ = signal(false);
  protected readonly color$$ = signal<string | null>(null);
  protected readonly impact$$ = signal<string>(NO_IMPACT_VALUE);

  constructor(private readonly timeCatalogueService: TimeCatalogueService) {
    effect(() => {
      const category = this.categoryInput();
      if (category) {
        this.fillForm(category);
      } else {
        this.resetForm();
      }
    });
  }

  protected readonly impactItems: DropdownItem[] = [
    { value: NO_IMPACT_VALUE, label: 'Not set' },
    { value: TimeImpact.Useful, label: 'Useful' },
    { value: TimeImpact.Neutral, label: 'Neutral' },
    { value: TimeImpact.Wasteful, label: 'Wasteful' },
  ];

  protected save(): void {
    if (!this.name$$()) return;

    const input = {
      name: this.name$$(),
      kind: this.isArea$$() ? TimeCategoryKind.Area : null,
      color: this.color$$(),
      impact: this.impact$$() ? (this.impact$$() as TimeImpact) : null,
    };

    const current = this.categoryInput();
    if (current) {
      this.timeCatalogueService.updateCategory(current.id, input);
    } else {
      this.timeCatalogueService.createCategory(input);
    }
    this.savedOutput.emit();
  }

  protected cancel(): void {
    this.cancelledOutput.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.categoryInput());
  }

  private fillForm(category: TimeCategory): void {
    this.name$$.set(category.name);
    this.isArea$$.set(category.kind === TimeCategoryKind.Area);
    this.color$$.set(category.color);
    this.impact$$.set(category.impact ?? NO_IMPACT_VALUE);
  }

  private resetForm(): void {
    this.name$$.set('');
    this.isArea$$.set(false);
    this.color$$.set(null);
    this.impact$$.set(NO_IMPACT_VALUE);
  }
}
