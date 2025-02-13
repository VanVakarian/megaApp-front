import { Component, Inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface DialogData {
  question: string;
}

@Component({
  selector: 'app-mat-dialog-modal',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './mat-dialog-modal.component.html',
})
export class ConfirmationDialogModalComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: DialogData,
    public dialogRef: MatDialogRef<ConfirmationDialogModalComponent>,
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onYesClick(): void {
    this.dialogRef.close(true);
  }
}
