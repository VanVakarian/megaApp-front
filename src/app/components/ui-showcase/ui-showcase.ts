import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OuterShadowDirective } from '@app/shared/ui-kit/shadow.directive';
import { Navbar } from './navbar/navbar';

@Component({
  selector: 'ui-showcase',
  templateUrl: './ui-showcase.html',
  styleUrl: './ui-showcase.css',
  imports: [Navbar, RouterOutlet, OuterShadowDirective],
})
export class UiShowcase {
  constructor() {}
}
