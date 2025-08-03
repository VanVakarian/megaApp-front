import { HttpClient } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
import { Coefficients, ServerResponseWithData } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SettingsService } from '../settings.service';
import { SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';

const COEFFICIENTS_STORAGE_KEY = 'food_coefficients';

@Injectable({
  providedIn: 'root',
})
export class FoodCoefficientsService extends BaseFoodService {
  private readonly COEFFICIENTS_STORAGE_KEY = 'food_coefficients';

  public coefficients$$: WritableSignal<Coefficients> = signal({});

  protected getStorageKey(): string {
    return this.COEFFICIENTS_STORAGE_KEY;
  }

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
    private settingsService: SettingsService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadCoefficientsFromLocalStorage();

    // effect(() => { console.log('COEFFICIENTS have been updated:', this.coefficients$$()) }); // prettier-ignore
  }

  public async getCoefficients(): Promise<Coefficients> {
    if (!this.settingsService.USE_COEFFICIENTS_TEMP) return {};

    try {
      const response = await firstValueFrom(
        this.http.get<ServerResponseWithData<Coefficients>>('/api/food/coefficients'),
      );

      this.coefficients$$.set(response.data);
      this.saveToLocalStorage(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed fetching coefficients:', error);
      return {};
    }
  }

  private loadCoefficientsFromLocalStorage(): void {
    const savedCoefficients = this.loadFromLocalStorage<Coefficients>();
    if (savedCoefficients) {
      this.coefficients$$.set(savedCoefficients);
    }
  }
}
