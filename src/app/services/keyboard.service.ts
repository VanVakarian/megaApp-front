import { Injectable } from '@angular/core';

import { combineLatest, fromEvent, Observable, Subject } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class KeyboardService {
  private inputFocusSubject = new Subject<boolean>();
  private keyboardEvents$ = fromEvent<KeyboardEvent>(document, 'keydown');

  public inputIsInFocus$ = this.inputFocusSubject.asObservable().pipe(startWith(false));

  constructor() { }

  setInputFocus(isInFocus: boolean) {
    this.inputFocusSubject.next(isInFocus);
  }

  getKeyboardEvents$(): Observable<KeyboardEvent> {
    return combineLatest([this.keyboardEvents$, this.inputIsInFocus$]).pipe(
      filter(([event, isInputFocused]) => !isInputFocused),
      map(([event]) => event),
    );
  }
}
