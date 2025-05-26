import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { VCardComponent } from '@app/shared/ui/v-card/v-card.component';
import { VInputComponent } from '@app/shared/ui/v-input/v-input.component';

@Component({
  selector: 'app-ui-showcase',
  templateUrl: './ui-showcase.component.html',
  styleUrl: './ui-showcase.component.css',
  standalone: true,
  imports: [VCardComponent, VInputComponent],
})
export class UiShowcaseComponent implements AfterViewInit, OnInit {
  @ViewChild('testInput')
  protected inputComponent!: VInputComponent;

  constructor() {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.inputComponent.writeValue('Some value');
    });
  }
}
