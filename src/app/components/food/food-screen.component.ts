import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { FoodCatalogueComponent } from '@app/components/food/catalogue/food-catalogue.component';
import { FoodDiaryComponent } from '@app/components/food/diary/food-diary.component';
import { FoodStatsComponent } from '@app/components/food/stats/food-stats.component';
import { FoodService } from '@app/services/food.service';
import { SettingsService } from '@app/services/settings.service';

@Component({
  selector: 'app-food-screen',
  standalone: true,
  imports: [CommonModule, FoodStatsComponent, FoodDiaryComponent, FoodCatalogueComponent],
  templateUrl: './food-screen.component.html',
})
export class FoodScreenComponent implements OnInit {
  section: string;
  largeScreen: boolean;
  private mediaQueryList: MediaQueryList;

  constructor(
    private route: ActivatedRoute,
    private foodService: FoodService,
    private settingsService: SettingsService,
  ) {
    this.section = '';
    this.largeScreen = false;
    this.mediaQueryList = window.matchMedia('(min-width: 1024px)');
  }

  ngOnInit() {
    firstValueFrom(this.foodService.getFoodDiaryFullUpdateRange());
    firstValueFrom(this.foodService.getCatalogueEntries());
    firstValueFrom(this.foodService.getMyCatalogueEntries());

    if (this.settingsService.USE_COEFFICIENTS_TEMP) {
      firstValueFrom(this.foodService.getCoefficients());
    }

    this.updateScreenSize();
    this.mediaQueryList.addEventListener('change', this.updateScreenSize.bind(this));

    this.route.params.subscribe((params) => {
      this.section = params['section'] || 'diary';
    });
  }

  ngOnDestroy() {
    this.mediaQueryList.removeEventListener('change', this.updateScreenSize.bind(this));
  }

  private updateScreenSize(event?: MediaQueryListEvent) {
    this.largeScreen = event ? event.matches : this.mediaQueryList.matches;
  }
}
