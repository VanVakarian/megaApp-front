import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeCatalogueService } from '@app/services/time/time-catalogue.service';
import { TimeActivity } from '@app/shared/time-types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VInput } from '@ui-kit/components/v-input/v-input';

@Component({
  selector: 'activity-form',
  templateUrl: './activity-form.html',
  imports: [FormsModule, VButton, VCheckbox, VInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityForm {
  public readonly activityInput = input<TimeActivity | null>(null);

  public readonly savedOutput = output<void>();
  public readonly cancelledOutput = output<void>();

  private readonly timeCatalogueService = inject(TimeCatalogueService);

  protected readonly categories$$ = computed(() => this.timeCatalogueService.categories$$());

  protected readonly name$$ = signal('');
  protected readonly isArchived$$ = signal(false);
  protected readonly selectedCategoryIds$$ = signal<number[]>([]);

  constructor() {
    effect(() => {
      const activity = this.activityInput();
      if (activity) {
        this.fillForm(activity);
      } else {
        this.resetForm();
      }
    });
  }

  protected isCategorySelected(categoryId: number): boolean {
    return this.selectedCategoryIds$$().includes(categoryId);
  }

  protected toggleCategory(categoryId: number, isSelected: boolean): void {
    this.selectedCategoryIds$$.update((ids) =>
      isSelected ? [...ids, categoryId] : ids.filter((id) => id !== categoryId),
    );
  }

  protected save(): void {
    if (!this.name$$()) return;

    const input = {
      name: this.name$$(),
      isArchived: this.isArchived$$(),
      categoryIds: this.selectedCategoryIds$$(),
    };

    const current = this.activityInput();
    if (current) {
      this.timeCatalogueService.updateActivity(current.id, input);
    } else {
      this.timeCatalogueService.createActivity(input);
    }
    this.savedOutput.emit();
  }

  protected cancel(): void {
    this.cancelledOutput.emit();
  }

  protected isEditing(): boolean {
    return Boolean(this.activityInput());
  }

  private fillForm(activity: TimeActivity): void {
    this.name$$.set(activity.name);
    this.isArchived$$.set(activity.isArchived);
    this.selectedCategoryIds$$.set([...activity.categoryIds]);
  }

  private resetForm(): void {
    this.name$$.set('');
    this.isArchived$$.set(false);
    this.selectedCategoryIds$$.set([]);
  }
}
