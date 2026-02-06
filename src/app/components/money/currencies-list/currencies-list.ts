import { Component, computed } from '@angular/core';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { MoneyService } from '../../../services/money.service';
import { DefaultModal } from '../../../shared/components/default-modal/default-modal';
import { Currency } from '../../../shared/types';
import { CurrencyForm } from './currency-form/currency-form';

@Component({
  selector: 'currencies-list',
  templateUrl: './currencies-list.html',
  standalone: true,
  imports: [CurrencyForm, DefaultModal, VButton, VCard],
})
export class CurrenciesList {
  protected currencies$$ = computed(() => this.moneyService.currencies$$());
  protected showForm = false;
  protected editingCurrency: Currency | null = null;
  protected isDeleteConfirmOpen = false;
  protected pendingDeleteId: number | null = null;

  constructor(private moneyService: MoneyService) {}

  protected showCreateForm(): void {
    this.editingCurrency = null;
    this.showForm = true;
  }

  protected editCurrency(currency: Currency): void {
    this.editingCurrency = currency;
    this.showForm = true;
  }

  protected onSaved(): void {
    this.showForm = false;
    this.editingCurrency = null;
  }

  protected onCancelled(): void {
    this.showForm = false;
    this.editingCurrency = null;
  }

  protected deleteCurrency(id: number): void {
    this.openConfirmationModal(id);
  }

  protected openConfirmationModal(id: number): void {
    this.pendingDeleteId = id;
    this.isDeleteConfirmOpen = true;
  }

  protected closeConfirmationModal(): void {
    this.isDeleteConfirmOpen = false;
    this.pendingDeleteId = null;
  }

  protected onDeleteConfirmed(): void {
    const id = this.pendingDeleteId;
    this.isDeleteConfirmOpen = false;
    this.pendingDeleteId = null;
    if (!id) return;
    this.moneyService.deleteCurrency(id).subscribe((success) => {});
  }
}
