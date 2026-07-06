import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TimeCatalogueService } from '@app/services/time/time-catalogue.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { FormModal } from '@app/shared/components/form-modal/form-modal';
import { TimeCategory } from '@app/shared/time-types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ICON_BUTTON } from '../time.const';
import { CategoryForm } from './category-form/category-form';

@Component({
  selector: 'categories-list',
  templateUrl: './categories-list.html',
  imports: [CategoryForm, DefaultModal, FormModal, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesList {
  protected readonly Icon = IconName;
  protected readonly iconButton = ICON_BUTTON;

  private readonly timeCatalogueService = inject(TimeCatalogueService);

  protected readonly categories$$ = computed(() => this.timeCatalogueService.categories$$());

  protected readonly showForm$$ = signal(false);
  protected readonly editingCategory$$ = signal<TimeCategory | null>(null);
  protected readonly isDeleteConfirmOpen$$ = signal(false);

  private readonly pendingDeleteId$$ = signal<number | null>(null);

  protected showCreateForm(): void {
    this.editingCategory$$.set(null);
    this.showForm$$.set(true);
  }

  protected editCategory(category: TimeCategory): void {
    this.editingCategory$$.set(category);
    this.showForm$$.set(true);
  }

  protected deleteCategory(id: number): void {
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
    this.timeCatalogueService.deleteCategory(id);
  }

  protected onSaved(): void {
    this.showForm$$.set(false);
    this.editingCategory$$.set(null);
  }

  protected onCancelled(): void {
    this.showForm$$.set(false);
    this.editingCategory$$.set(null);
  }

  protected categoryLabel(category: TimeCategory): string {
    return category.kind === 'area' ? `${category.name} · area` : category.name;
  }
}
