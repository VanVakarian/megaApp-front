import { Injectable } from '@angular/core';
import { combineLatest, fromEvent, Observable, Subject } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class KeyboardService {
  private readonly inputFocusSubject = new Subject<boolean>();

  private readonly keyboardEvents$ = fromEvent<KeyboardEvent>(document, 'keydown');

  public readonly inputIsInFocus$ = this.inputFocusSubject.asObservable().pipe(startWith(false));

  private setInputFocus(isInFocus: boolean) {
    this.inputFocusSubject.next(isInFocus);
  }

  private getKeyboardEvents$(): Observable<KeyboardEvent> {
    return combineLatest([this.keyboardEvents$, this.inputIsInFocus$]).pipe(
      filter(([event, isInputFocused]) => !isInputFocused),
      map(([event]) => event),
    );
  }
}
