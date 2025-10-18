import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FoodDiary } from '@app/components/food/diary/food-diary';
import { FoodStats } from '@app/components/food/stats/food-stats';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodDiaryService } from '@app/services/food/food-diary.service';

@Component({
  selector: 'food-screen',
  templateUrl: './food-screen.html',
  imports: [CommonModule, FoodStats, FoodDiary],
})
export class FoodScreen implements OnInit {
  protected selectedFoodSection = '';

  protected readonly deviceInfoService = inject(DeviceInfoService);
  private readonly route = inject(ActivatedRoute);
  private readonly foodDiaryService = inject(FoodDiaryService);

  public ngOnInit() {
    this.foodDiaryService.loadAllFoodData();
    this.subscribeToRouteParams();
  }

  private subscribeToRouteParams() {
    this.route.params.subscribe((params) => {
      this.selectedFoodSection = params['section'] || 'diary';
    });
  }
}
