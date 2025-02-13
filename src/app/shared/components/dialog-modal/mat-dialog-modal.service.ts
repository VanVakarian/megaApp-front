import { Injectable } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { Observable } from 'rxjs';

import { ConfirmationDialogModalComponent } from '@app/shared/components/dialog-modal/mat-dialog-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ConfirmationDialogModalService {
  constructor(private dialog: MatDialog) {}

  openModal(question: string): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogModalComponent, {
      // width: '90%',
      data: { question },
    });

    return dialogRef.afterClosed();
  }
}
