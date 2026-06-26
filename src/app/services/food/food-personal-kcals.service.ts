import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { AuthService, AuthSessionState } from '@app/services/auth.service';
import { exhaustRequest } from '@app/shared/decorators/exhaust-request.decorator';
import { PersonalKcals, ServerResponseWithData } from '@app/shared/types';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../local-storage.service';
import { NetworkService } from '../network.service';
import { SyncQueueService } from '../sync-queue.service';
import { BaseFoodService } from './food-base.service';

@Injectable({
  providedIn: 'root',
})
export class FoodPersonalKcalsService extends BaseFoodService {
  private readonly PERSONAL_KCALS_STORAGE_KEY = 'food_personal_kcals';

  public readonly personalKcals$$: WritableSignal<PersonalKcals> = signal({});

  protected getStorageKey(): string {
    return this.PERSONAL_KCALS_STORAGE_KEY;
  }

  private readonly authService = inject(AuthService);

  private readonly resetOnAuthLossEffect$$ = effect(() => {
    if (this.authService.sessionState$$() === AuthSessionState.Guest) {
      this.reset();
    }
  });

  constructor(
    http: HttpClient,
    localStorageService: LocalStorageService,
    networkService: NetworkService,
    syncQueueService: SyncQueueService,
  ) {
    super(http, localStorageService, networkService, syncQueueService);
    this.loadPersonalKcalsFromLocalStorage();
  }

  public reset(): void {
    this.personalKcals$$.set({});
  }

  @exhaustRequest()
  public async getPersonalKcals(): Promise<PersonalKcals> {
    try {
      const response = await firstValueFrom(
        this.http.get<ServerResponseWithData<PersonalKcals>>('/api/food/personal-kcals'),
      );

      this.personalKcals$$.set(response.data);
      this.saveToLocalStorage(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed fetching personal kcals:', error);
      return {};
    }
  }

  private loadPersonalKcalsFromLocalStorage(): void {
    const savedPersonalKcals = this.loadFromLocalStorage<PersonalKcals>();
    if (savedPersonalKcals) {
      this.personalKcals$$.set(savedPersonalKcals);
    }
  }
}
