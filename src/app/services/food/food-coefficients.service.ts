import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { Coefficients, ServerResponseWithData } from '@app/shared/interfaces';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SettingsService } from '../settings.service';
import { SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';

@Injectable({
  providedIn: 'root',
})
export class FoodCoefficientsService extends BaseFoodService {
  private readonly COEFFICIENTS_STORAGE_KEY = 'food_coefficients';

  public readonly coefficients$$: WritableSignal<Coefficients> = signal({});

  protected getStorageKey(): string {
    return this.COEFFICIENTS_STORAGE_KEY;
  }

  private readonly settingsService = inject(SettingsService);

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadCoefficientsFromLocalStorage();
  }

  @exhaustRequest()
  public async getCoefficients(): Promise<Coefficients> {
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
