import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyService } from '@app/services/money.service';
import { DefaultModal } from '@app/shared/components/default-modal/default-modal';
import { Account, Asset, AssetType, Transaction, TransactionKind } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { IconName, VIcon } from '@ui-kit/components/v-icon/v-icon';
import { VInput } from '@ui-kit/components/v-input/v-input';
import { VToggle } from '@ui-kit/components/v-toggle/v-toggle';

interface OpenedPosition {
  accountId: number;
  accountTitle: string;
  assetId: number;
  assetTitle: string;
  assetTicker: string;
  openedAtISO: string;
  openQuantity: number;
}

@Component({
  selector: 'assets-list',
  templateUrl: './assets-list.html',
  imports: [FormsModule, DefaultModal, VButton, VCard, VIcon, VInput, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsList {
  protected readonly Icon = IconName;

  private readonly moneyService = inject(MoneyService);

  protected readonly assets$$ = computed(() => this.moneyService.assets$$());
  protected readonly openedPositions$$ = computed(() => this.buildOpenedPositions());

  private readonly accounts$$ = computed(() => this.moneyService.accounts$$());
  private readonly transactions$$ = computed(() => this.moneyService.transactions$$());

  protected readonly showForm$$ = signal(false);
  protected readonly editingAsset$$ = signal<Asset | null>(null);
  protected readonly title$$ = signal('');
  protected readonly ticker$$ = signal('');
  protected readonly type$$ = signal<AssetType>(AssetType.STOCK);
  protected readonly isDeleteConfirmOpen$$ = signal(false);

  private readonly pendingDeleteId$$ = signal<number | null>(null);

  protected showCreateForm(): void {
    this.editingAsset$$.set(null);
    this.resetForm();
    this.showForm$$.set(true);
  }

  protected editAsset(asset: Asset): void {
    this.editingAsset$$.set(asset);
    this.fillForm(asset);
    this.showForm$$.set(true);
  }

  protected saveAsset(): void {
    if (!this.title$$() || !this.ticker$$() || !this.type$$()) return;

    const assetData: Asset = {
      title: this.title$$(),
      ticker: this.ticker$$(),
      type: this.type$$(),
    };

    const currentAsset = this.editingAsset$$();
    if (currentAsset?.id) {
      assetData.id = currentAsset.id;
      this.moneyService.updateAsset(assetData).subscribe((success) => {
        if (success) {
          this.onSaved();
        }
      });
      return;
    }

    this.moneyService.createAsset(assetData).subscribe((success) => {
      if (success) {
        this.onSaved();
      }
    });
  }

  protected deleteAsset(id: number): void {
    if (!this.canDeleteAsset(id)) return;
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
    if (!this.canDeleteAsset(id)) return;
    this.moneyService.deleteAsset(id).subscribe((success) => {});
  }

  protected onSaved(): void {
    this.showForm$$.set(false);
    this.editingAsset$$.set(null);
    this.resetForm();
  }

  protected onCancelled(): void {
    this.showForm$$.set(false);
    this.editingAsset$$.set(null);
    this.resetForm();
  }

  protected isEditing(): boolean {
    return Boolean(this.editingAsset$$()?.id);
  }

  protected typeToggleItems(): { id: string; label: string }[] {
    return [
      { id: AssetType.STOCK, label: 'Stock' },
      { id: AssetType.BOND, label: 'Bond' },
    ];
  }

  protected typeToggleValue(): string[] {
    return [this.type$$()];
  }

  protected onTypeToggleChange(value: string[]): void {
    const nextType = value[0] as AssetType | undefined;
    this.type$$.set(nextType ?? AssetType.STOCK);
  }

  protected getAssetTypeLabel(type: AssetType): string {
    switch (type) {
      case AssetType.STOCK:
        return 'Stock';
      case AssetType.BOND:
        return 'Bond';
      default:
        return type;
    }
  }

  protected canDeleteAsset(assetId: number): boolean {
    return !this.transactions$$().some((transaction: Transaction) =>
      this.isAssetLinkedToTransaction(assetId, transaction),
    );
  }

  private isAssetLinkedToTransaction(assetId: number, transaction: Transaction): boolean {
    const detailsJSON = transaction.detailsJSON;
    if (!detailsJSON) return false;

    let parsed: any = detailsJSON;
    if (typeof detailsJSON === 'string') {
      try {
        parsed = JSON.parse(detailsJSON);
      } catch {
        return false;
      }
    }

    return Number(parsed?.assetId) === Number(assetId);
  }

  private fillForm(asset: Asset): void {
    this.title$$.set(asset.title);
    this.ticker$$.set(asset.ticker);
    this.type$$.set(asset.type);
  }

  private resetForm(): void {
    this.title$$.set('');
    this.ticker$$.set('');
    this.type$$.set(AssetType.STOCK);
  }

  protected formatOpenedDate(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  protected formatQuantity(quantity: number): string {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(quantity);
  }

  private buildOpenedPositions(): OpenedPosition[] {
    const accountsById = new Map<number, Account>(this.accounts$$().map((account) => [account.id!, account]));
    const assetsById = new Map<number, Asset>(this.assets$$().map((asset) => [asset.id!, asset]));

    const trades = this.transactions$$()
      .filter((transaction) => {
        return transaction.kind === TransactionKind.INVEST_BUY || transaction.kind === TransactionKind.INVEST_SELL;
      })
      .sort((first, second) => {
        const dateCompare = first.dateISO.localeCompare(second.dateISO);
        if (dateCompare !== 0) return dateCompare;
        return (first.id ?? 0) - (second.id ?? 0);
      });

    const stateByKey = new Map<
      string,
      { accountId: number; assetId: number; openedAtISO: string | null; quantity: number }
    >();

    trades.forEach((trade) => {
      const details = this.parseDetails(trade.detailsJSON);
      const assetId = this.toPositiveNumber(details?.assetId);
      const quantity = this.toPositiveNumber(details?.quantity);

      if (assetId == null || quantity == null) return;

      const key = `${trade.accountId}:${assetId}`;
      const current = stateByKey.get(key) ?? {
        accountId: trade.accountId,
        assetId,
        openedAtISO: null,
        quantity: 0,
      };

      if (trade.kind === TransactionKind.INVEST_BUY) {
        if (current.quantity <= 0) {
          current.openedAtISO = trade.dateISO;
        }
        current.quantity += quantity;
      }

      if (trade.kind === TransactionKind.INVEST_SELL) {
        current.quantity -= quantity;
        if (current.quantity <= 0) {
          current.quantity = 0;
          current.openedAtISO = null;
        }
      }

      stateByKey.set(key, current);
    });

    return Array.from(stateByKey.values())
      .filter((item) => item.quantity > 0 && item.openedAtISO)
      .map((item) => {
        const account = accountsById.get(item.accountId);
        const asset = assetsById.get(item.assetId);

        return {
          accountId: item.accountId,
          accountTitle: account?.title ?? `Account #${item.accountId}`,
          assetId: item.assetId,
          assetTitle: asset?.title ?? `Asset #${item.assetId}`,
          assetTicker: asset?.ticker ?? '',
          openedAtISO: item.openedAtISO!,
          openQuantity: item.quantity,
        };
      })
      .sort((first, second) => first.openedAtISO.localeCompare(second.openedAtISO));
  }

  private parseDetails(detailsJSON: any): any {
    if (!detailsJSON) return null;

    if (typeof detailsJSON === 'object') {
      return detailsJSON;
    }

    if (typeof detailsJSON === 'string') {
      try {
        return JSON.parse(detailsJSON);
      } catch {
        return null;
      }
    }

    return null;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
    return numberValue;
  }
}
