import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { InputType, VInput } from '@app/shared/ui-kit/v-input/v-input';

@Component({
  selector: 'other',
  templateUrl: './other.html',
  styleUrl: './other.css',
  imports: [VCard, VInput, VButton, ReactiveFormsModule],
})
export class Other implements AfterViewInit, OnInit {
  @ViewChild('testInput')
  protected inputComponent!: VInput;
  protected InputType = InputType;
  protected form = new FormGroup({
    testInput: new FormControl(''),
    username: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', Validators.required),
    disabled: new FormControl({ value: '', disabled: true }),
    error: new FormControl('', Validators.required),
  });

  constructor() {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.inputComponent.writeValue('Some value');
    });
  }
}
