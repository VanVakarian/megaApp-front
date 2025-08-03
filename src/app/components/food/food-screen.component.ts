import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FoodCatalogueComponent } from '@app/components/food/catalogue/food-catalogue.component';
import { FoodDiaryComponent } from '@app/components/food/diary/food-diary.component';
import { FoodStatsComponent } from '@app/components/food/stats/food-stats.component';
import { FoodCatalogueService } from '@app/services/food/food-catalogue.service';
import { FoodCoefficientsService } from '@app/services/food/food-coefficients.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';

@Component({
  selector: 'app-food-screen',
  templateUrl: './food-screen.component.html',
  imports: [CommonModule, FoodStatsComponent, FoodDiaryComponent, FoodCatalogueComponent],
})
export class FoodScreenComponent implements OnInit {
  public section: string;
  public largeScreen: boolean;
  private mediaQueryList: MediaQueryList;

  constructor(
    private route: ActivatedRoute,
    private foodDiaryService: FoodDiaryService,
    private foodCatalogueService: FoodCatalogueService,
    private foodCoefficientsService: FoodCoefficientsService,
    private foodStatsService: FoodStatsService,
  ) {
    this.section = '';
    this.largeScreen = false;
    this.mediaQueryList = window.matchMedia('(min-width: 1024px)');
  }

  public ngOnInit() {
    this.foodDiaryService.getFoodDiaryFullUpdateRange();
    this.foodCatalogueService.getCatalogueEntries();
    this.foodCatalogueService.getCatalogueEntriesSelected();
    this.foodCoefficientsService.getCoefficients();
    this.foodStatsService.getStats();

    this.updateScreenSize();
    this.mediaQueryList.addEventListener('change', this.updateScreenSize.bind(this));

    this.route.params.subscribe((params) => {
      this.section = params['section'] || 'diary';
    });
  }

  public ngOnDestroy() {
    this.mediaQueryList.removeEventListener('change', this.updateScreenSize.bind(this));
  }

  private updateScreenSize(event?: MediaQueryListEvent) {
    this.largeScreen = event ? event.matches : this.mediaQueryList.matches;
  }
}
