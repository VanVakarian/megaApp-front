import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AccordionService {
  private readonly openedIds = signal<Map<string, string | null>>(new Map());
  private readonly registry = new Map<string, Map<string, () => void>>(new Map());

  public register(groupId: string, id: string, closeFn: () => void) {
    if (!this.registry.has(groupId)) {
      this.registry.set(groupId, new Map());
    }
    this.registry.get(groupId)!.set(id, closeFn);
  }

  public unregister(groupId: string, id: string) {
    const group = this.registry.get(groupId);
    if (group) {
      group.delete(id);
      if (group.size === 0) {
        this.registry.delete(groupId);
      }
    }
  }

  public toggle(groupId: string, id: string) {
    const openedIds = this.openedIds();
    const currentOpenedId = openedIds.get(groupId);

    if (currentOpenedId === id) {
      openedIds.set(groupId, null);
    } else {
      openedIds.set(groupId, id);
      const group = this.registry.get(groupId);
      if (group) {
        for (const [key, closeFn] of group.entries()) {
          if (key !== id) closeFn();
        }
      }
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
