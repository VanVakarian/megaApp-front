import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ui-showcase',
  templateUrl: './ui-showcase.html',
  styleUrl: './ui-showcase.scss',
  imports: [RouterOutlet],
})
export class UiShowcase {}
