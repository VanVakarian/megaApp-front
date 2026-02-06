import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'assets-list',
  templateUrl: './assets-list.html',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsList {}
