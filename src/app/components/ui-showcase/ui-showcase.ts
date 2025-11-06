import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';

@Component({
  selector: 'ui-showcase',
  templateUrl: './ui-showcase.html',
  styleUrl: './ui-showcase.scss',
  imports: [Navbar, RouterOutlet],
})
export class UiShowcase {
  constructor() {}
}
