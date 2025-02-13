import { Injectable, signal } from '@angular/core';

interface iBanksDivsState {
  [key: number]: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StateService {
  clickedBankId$$ = signal<number>(0);
}
