import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VCard } from '@app/shared/ui-kit/v-card/v-card';
import { VInput } from '@app/shared/ui-kit/v-input/v-input';

@Component({
  selector: 'other',
  templateUrl: './other.html',
  styleUrl: './other.css',
  imports: [VCard, VInput, VButton],
})
export class Other implements AfterViewInit, OnInit {
  @ViewChild('testInput')
  protected inputComponent!: VInput;

  constructor() {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.inputComponent.writeValue('Some value');
    });
  }
}
