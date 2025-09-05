import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FoodDiaryComponent } from '@app/components/food/diary/food-diary.component';
import { FoodStatsComponent } from '@app/components/food/stats/food-stats.component';
import { FoodDiaryService } from '@app/services/food/food-diary.service';

@Component({
  selector: 'app-food-screen',
  templateUrl: './food-screen.component.html',
  imports: [CommonModule, FoodStatsComponent, FoodDiaryComponent],
})
export class FoodScreenComponent implements OnInit {
  public section: string;
  public largeScreen: boolean;
  private mediaQueryList: MediaQueryList;

  constructor(
    private route: ActivatedRoute,
    private foodDiaryService: FoodDiaryService,
  ) {
    this.section = '';
    this.largeScreen = false;
    this.mediaQueryList = window.matchMedia('(min-width: 1024px)');
  }

  public ngOnInit() {
    this.foodDiaryService.loadAllFoodData();

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
