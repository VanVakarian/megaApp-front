import { HttpClient } from '@angular/common/http';
import { Injectable, effect } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { NetworkMonitor } from '@app/services/network-monitor.service';

type ActionQueue = {
  [key: string | number]: {
    ['actionType']: 'foodAdd';
    ['payload']: {
      ['foodId']: number;
      ['foodWeight']: number | null;
      ['ver']: number;
    };
  };
};

// type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type ActionDataTypes = any;

type ActionData = {
  ['data']: any;
};

@Injectable({
  providedIn: 'root',
})
export class ActionService {
  // private actionQueue$$: WritableSignal<ActionQueue> = signal({});
  private actionQueue: ActionQueue = {
    999999998: { actionType: 'foodAdd', payload: { foodId: 999999998, foodWeight: 665, ver: 0 } },
    999999999: { actionType: 'foodAdd', payload: { foodId: 999999999, foodWeight: 666, ver: 0 } },
  };

  private requestOptions = {
    foodAdd: {
      method: 'POST',
      url: '/api/food',
    },
  };

  constructor(
    private networkMonitor: NetworkMonitor,
    private http: HttpClient,
  ) {
    effect(async () => {
      await this.startSendingRequests();
    });
  }

  public async startSendingRequests() {
    // const isOnline = this.networkMonitor.isOnline$$();
    if (!this.networkMonitor.isOnline$$()) return;
    if (!Object.keys(this.actionQueue).length) return;

    while (Object.keys(this.actionQueue).length) {
      const actionKey = Object.keys(this.actionQueue)[0];
      const action = this.actionQueue[actionKey];
      const method = this.requestOptions[action.actionType].method;
      const url = this.requestOptions[action.actionType].url;

      // console.log('Sending...');
      try {
        const res = await this.performRequest(method, url, action.payload);
        console.log('Received response: ', res);
        delete this.actionQueue[actionKey];
      } catch (error) {
        console.error('Request failed: ', error);
        break;
      }
    }
  }

  private async performRequest(method: string, url: string, payload: any | null): Promise<any> {
    return firstValueFrom(this.http.request(method, url, { body: payload }));
  }

  public initService() {} // refactor later
}
