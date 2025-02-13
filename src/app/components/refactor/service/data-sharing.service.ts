import { Injectable } from '@angular/core';
import { EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DataSharingService {
  dataChanged$: EventEmitter<void> = new EventEmitter<void>();

  currencyClicked$: EventEmitter<number> = new EventEmitter<number>();
  bankClicked$: EventEmitter<number> = new EventEmitter<number>();
  accountClicked$: EventEmitter<number> = new EventEmitter<number>();
  categoryClicked$: EventEmitter<number> = new EventEmitter<number>();
}
