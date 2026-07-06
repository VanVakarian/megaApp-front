import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TimeCatalogueService } from '@app/services/time/time-catalogue.service';
import { FormModal } from '@app/shared/components/form-modal/form-modal';
import { TimeActivity } from '@app/shared/time-types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { ICON_BUTTON } from '../time.const';
import { ActivityForm } from './activity-form/activity-form';

@Component({
  selector: 'activities-list',
  templateUrl: './activities-list.html',
  imports: [ActivityForm, FormModal, VButton, VCard, VIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesList {
  protected readonly Icon = IconName;
  protected readonly iconButton = ICON_BUTTON;

  private readonly timeCatalogueService = inject(TimeCatalogueService);

  protected readonly activities$$ = computed(() =>
    [...this.timeCatalogueService.activities$$()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly showForm$$ = signal(false);
  protected readonly editingActivity$$ = signal<TimeActivity | null>(null);

  protected showCreateForm(): void {
    this.editingActivity$$.set(null);
    this.showForm$$.set(true);
  }

  protected editActivity(activity: TimeActivity): void {
    this.editingActivity$$.set(activity);
    this.showForm$$.set(true);
  }

  protected onSaved(): void {
    this.showForm$$.set(false);
    this.editingActivity$$.set(null);
  }

  protected onCancelled(): void {
    this.showForm$$.set(false);
    this.editingActivity$$.set(null);
  }
}
