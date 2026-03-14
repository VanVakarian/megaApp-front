import { Injectable, signal, WritableSignal } from '@angular/core';
import { CatalogueEntry } from '@app/shared/types';

export enum ModalState {
  CLOSED = 'CLOSED',
  SEARCH = 'SEARCH',
  ADD_DIARY_ENTRY = 'ADD_DIARY_ENTRY',
  CREATE_NEW_PRODUCT = 'CREATE_NEW_PRODUCT',
  EDIT_PRODUCT = 'EDIT_PRODUCT',
  CAMERA_PREVIEW = 'CAMERA_PREVIEW',
}

enum ModalEvent {
  OPEN,
  CLOSE,
  SELECT_PRODUCT,
  ADD_PRODUCT,
  EDIT_PRODUCT,
  GO_BACK,
  SUBMIT_SUCCESS,
  TAKE_PHOTO,
}

interface ModalContext {
  from: ModalState;
  to: ModalState;
  payload?: any;
}

type StateTransitionMap = {
  [state in ModalState]?: {
    [event in ModalEvent]?: ModalState;
  };
};

@Injectable({
  providedIn: 'root',
})
export class FoodAddModalService {
  public readonly currentState$$: WritableSignal<ModalState> = signal(ModalState.CLOSED);

  public readonly searchQuery$$: WritableSignal<string> = signal('');

  public readonly selectedProduct$$: WritableSignal<CatalogueEntry | null> = signal(null);

  private readonly stateTransitions: StateTransitionMap = {
    [ModalState.CLOSED]: {
      [ModalEvent.OPEN]: ModalState.SEARCH,
    },
    [ModalState.SEARCH]: {
      [ModalEvent.SELECT_PRODUCT]: ModalState.ADD_DIARY_ENTRY,
      [ModalEvent.ADD_PRODUCT]: ModalState.CREATE_NEW_PRODUCT,
      [ModalEvent.TAKE_PHOTO]: ModalState.CAMERA_PREVIEW,
      [ModalEvent.SUBMIT_SUCCESS]: ModalState.CLOSED,
      [ModalEvent.CLOSE]: ModalState.CLOSED,
    },
    [ModalState.ADD_DIARY_ENTRY]: {
      [ModalEvent.GO_BACK]: ModalState.SEARCH,
      [ModalEvent.EDIT_PRODUCT]: ModalState.EDIT_PRODUCT,
      [ModalEvent.SUBMIT_SUCCESS]: ModalState.CLOSED,
      [ModalEvent.CLOSE]: ModalState.CLOSED,
    },
    [ModalState.CREATE_NEW_PRODUCT]: {
      [ModalEvent.GO_BACK]: ModalState.SEARCH,
      [ModalEvent.SUBMIT_SUCCESS]: ModalState.ADD_DIARY_ENTRY,
      [ModalEvent.CLOSE]: ModalState.CLOSED,
    },
    [ModalState.EDIT_PRODUCT]: {
      [ModalEvent.GO_BACK]: ModalState.ADD_DIARY_ENTRY,
      [ModalEvent.SUBMIT_SUCCESS]: ModalState.ADD_DIARY_ENTRY,
      [ModalEvent.CLOSE]: ModalState.CLOSED,
    },
    [ModalState.CAMERA_PREVIEW]: {
      [ModalEvent.GO_BACK]: ModalState.SEARCH,
      [ModalEvent.SUBMIT_SUCCESS]: ModalState.SEARCH,
      [ModalEvent.CLOSE]: ModalState.CLOSED,
    },
  };

  public transition(event: ModalEvent, payload?: any): void {
    const currentState = this.currentState$$();
    const nextState = this.stateTransitions[currentState]?.[event];

    if (!nextState) {
      console.warn(`[FoodAddModalService] Invalid transition: ${currentState} + ${event}`);
      return;
    }

    const context: ModalContext = {
      from: currentState,
      to: nextState,
      payload,
    };

    this.executeTransitionSideEffects(context);
    this.currentState$$.set(nextState);
  }

  private executeTransitionSideEffects(context: ModalContext): void {
    const { from, to, payload } = context;

    switch (to) {
      case ModalState.SEARCH:
        if (from === ModalState.CLOSED) {
          this.searchQuery$$.set('');
        }
        if (from === ModalState.ADD_DIARY_ENTRY || from === ModalState.CREATE_NEW_PRODUCT) {
          this.selectedProduct$$.set(null);
        }
        break;

      case ModalState.ADD_DIARY_ENTRY:
        if (payload) {
          this.selectedProduct$$.set(payload);
        }
        break;

      case ModalState.CLOSED:
        this.searchQuery$$.set('');
        this.selectedProduct$$.set(null);
        break;
    }
  }

  public openModal(): void {
    this.transition(ModalEvent.OPEN);
  }

  public closeModal(): void {
    this.transition(ModalEvent.CLOSE);
  }

  public selectProduct(product: CatalogueEntry): void {
    this.transition(ModalEvent.SELECT_PRODUCT, product);
  }

  public goBackToSearch(): void {
    this.transition(ModalEvent.GO_BACK);
  }

  public addProduct(): void {
    this.transition(ModalEvent.ADD_PRODUCT);
  }

  public takePhoto(): void {
    this.transition(ModalEvent.TAKE_PHOTO);
  }

  public submitSuccess(): void {
    this.transition(ModalEvent.SUBMIT_SUCCESS);
  }

  public editProduct(product: CatalogueEntry): void {
    this.transition(ModalEvent.EDIT_PRODUCT, product);
  }
}
