import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AccordionService {
  private readonly openedIds = signal<Map<string, string | null>>(new Map());
  public readonly openedIds$$ = this.openedIds.asReadonly();

  public toggle(groupId: string, id: string) {
    const openedIds = this.openedIds();
    const currentOpenedId = openedIds.get(groupId);

    if (currentOpenedId === id) {
      openedIds.set(groupId, null);
    } else {
      openedIds.set(groupId, id);
    }
    this.openedIds.set(new Map(openedIds));
  }

  public isOpen(groupId: string, id: string): boolean {
    return this.openedIds().get(groupId) === id;
  }

  public open(groupId: string, id: string) {
    this.toggle(groupId, id);
  }

  public close(groupId: string, id: string) {
    const openedIds = this.openedIds();
    if (openedIds.get(groupId) === id) {
      openedIds.set(groupId, null);
      this.openedIds.set(new Map(openedIds));
    }
  }

  public closeGroup(groupId: string) {
    const openedIds = this.openedIds();
    openedIds.set(groupId, null);
    this.openedIds.set(new Map(openedIds));
  }

  public closeAll() {
    this.openedIds.set(new Map());
  }
}
