import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AccordionService {
  private readonly openedId = signal<string | null>(null);
  private readonly registry = new Map<string, () => void>();

  // private readonly currentOpenedId = computed(() => this.openedId());

  public register(id: string, closeFn: () => void) {
    this.registry.set(id, closeFn);
  }

  public unregister(id: string) {
    this.registry.delete(id);
  }

  public toggle(id: string) {
    if (this.openedId() === id) {
      this.openedId.set(null);
    } else {
      this.openedId.set(id);
      for (const [key, closeFn] of this.registry.entries()) {
        if (key !== id) closeFn();
      }
    }
  }

  public isOpen(id: string): boolean {
    return this.openedId() === id;
  }

  public open(id: string) {
    this.toggle(id);
  }

  public close(id: string) {
    if (this.openedId() === id) {
      this.openedId.set(null);
    }
  }

  public closeAll() {
    this.openedId.set(null);
  }
}
