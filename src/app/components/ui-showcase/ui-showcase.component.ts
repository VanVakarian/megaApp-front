import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { VCard } from '@app/shared/ui/v-card/v-card';
import { VInput } from '@app/shared/ui/v-input/v-input';

@Component({
  selector: 'app-ui-showcase',
  templateUrl: './ui-showcase.component.html',
  styleUrl: './ui-showcase.component.css',
  standalone: true,
  imports: [VCard, VInput],
})
export class UiShowcaseComponent implements AfterViewInit, OnInit {
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
