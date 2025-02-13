import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';

import { firstValueFrom } from 'rxjs';

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

import { FoodStatsService } from '@app/services/food-stats.service';
import { KCALS_CHART_SETTINGS, WEIGHT_CHART_SETTINGS } from '@app/shared/const';
import { debounce, formatDateTicks, getRuDeclension, throttle } from '@app/shared/utils';

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarController,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface StatsChartData {
  dates: string[];
  weights: number[];
  weightsAvg: number[];
  kcals: number[];
  kcalsTarget: number[];
}

@Component({
  selector: 'app-food-stats',
  templateUrl: './food-stats.component.html',
  styleUrl: './food-stats.component.scss',
  imports: [CommonModule, MatCardModule, MatSliderModule, FormsModule, MatButtonModule],
  standalone: true,
})
export class FoodStatsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('weightChartCanvas')
  public weightChartCanvas!: ElementRef;

  @ViewChild('kcalsChartCanvas')
  public kcalsChartCanvas!: ElementRef;

  public weightChart!: Chart;
  public kcalsChart!: Chart;

  public selectedDateIdxStart: number = 0;
  public selectedDateIdxEnd: number = Infinity;

  public sliderStartLabel: string = '';
  public sliderEndLabel: string = '';
  public selectedRangeLabel: string = '';

  public get maxSliderValue(): number {
    return this.foodStatsService.statsChartData$$().dates.length - 1;
  }

  constructor(private foodStatsService: FoodStatsService) {
    const throttledUpdate = this.createThrottledChartUpdater();
    const debouncedUpdate = this.createDebouncedChartUpdater();

    effect(() => {
      const dates = this.foodStatsService.statsChartData$$().dates;
      const selectedLowDate = dates[this.foodStatsService.selectedDateIdxStart$$()];
      const selectedHighDate = dates[this.foodStatsService.selectedDateIdxEnd$$()];
      this.sliderStartLabel = formatDateTicks(selectedLowDate);
      this.sliderEndLabel = formatDateTicks(selectedHighDate);
      this.selectedRangeLabel = this.formatSelectedRange();
    });

    effect(() => {
      this.selectedDateIdxStart = this.foodStatsService.selectedDateIdxStart$$();
      this.selectedDateIdxEnd = this.foodStatsService.selectedDateIdxEnd$$();
    });

    effect(() => {
      const data = this.foodStatsService.StatsChartDataClipped$$();
      throttledUpdate(data);
      debouncedUpdate(data);
    });
  }

  public async ngOnInit(): Promise<void> {
    if (!Object.keys(this.foodStatsService.stats$$()).length) {
      await firstValueFrom(this.foodStatsService.getStats());
    }

    this.weightChart = new Chart('WeightChart', WEIGHT_CHART_SETTINGS);
    this.kcalsChart = new Chart('KcalsChart', KCALS_CHART_SETTINGS);
  }

  public ngAfterViewInit(): void {
    if (this.weightChartCanvas) {
      this.weightChartCanvas.nativeElement.getContext('2d').canvas.height = 250;
    }
    if (this.kcalsChartCanvas) {
      this.kcalsChartCanvas.nativeElement.getContext('2d').canvas.height = 250;
    }
  }

  public ngOnDestroy(): void {}

  public sliderChangeStart(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valueInt = parseInt(input.value);
    const delta = this.foodStatsService.selectedDateIdxEnd$$() - valueInt;
    if (delta > 0) {
      this.foodStatsService.selectedDateIdxStart$$.set(valueInt);
    }
  }

  public sliderChangeEnd(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valueInt = parseInt(input.value);
    const delta = valueInt - this.foodStatsService.selectedDateIdxStart$$();
    if (delta > 0) {
      this.foodStatsService.selectedDateIdxEnd$$.set(valueInt);
    }
  }

  public clipDateRange(daysAmtToShow: number): void {
    this.foodStatsService.clipDateRange(daysAmtToShow);
  }

  private updateWeightChart(data: StatsChartData, chartUpdateMode: 'none' | undefined = undefined) {
    if (this.weightChart?.data) {
      this.weightChart.data.labels = data.dates;
      this.weightChart.data.datasets[0].data = data.weights;
      this.weightChart.data.datasets[1].data = data.weightsAvg;
      this.weightChart.update(chartUpdateMode);
    }
  }

  private updateKcalsChart(data: StatsChartData, chartUpdateMode: 'none' | undefined = undefined) {
    if (this.kcalsChart?.data) {
      this.kcalsChart.data.labels = data.dates;
      this.kcalsChart.data.datasets[0].data = data.kcals;
      this.kcalsChart.data.datasets[1].data = data.kcalsTarget;
      this.kcalsChart.update(chartUpdateMode);
    }
  }

  private createThrottledChartUpdater() {
    return throttle((data: StatsChartData) => {
      this.updateWeightChart(data, 'none');
      this.updateKcalsChart(data, 'none');
    }, 100);
  }

  private createDebouncedChartUpdater() {
    return debounce((data: StatsChartData) => {
      this.updateWeightChart(data);
      this.updateKcalsChart(data);
    }, 100);
  }

  private formatSelectedRange(): string {
    // caluclating total selected days
    const firstSelectedDay = this.foodStatsService.selectedDateIdxStart$$();
    const lastSelectedDay = this.foodStatsService.selectedDateIdxEnd$$();
    const selectedDaysCount = lastSelectedDay - firstSelectedDay + 1;

    const DAYS_IN_YEAR = 360;
    const DAYS_IN_MONTH = 30;

    // converting days to years, months and days
    const years = Math.floor(selectedDaysCount / DAYS_IN_YEAR);
    const remainingDaysAfterYears = selectedDaysCount % DAYS_IN_YEAR;
    const months = Math.floor(remainingDaysAfterYears / DAYS_IN_MONTH);
    const remainingDays = remainingDaysAfterYears % DAYS_IN_MONTH;

    const parts: string[] = [];

    // building human readable description
    if (years > 0) {
      const yearText = `${years} ${getRuDeclension(years, 'год', 'года', 'лет')}`;
      const hasRemainingUnits = months > 0 || remainingDays > 0;
      parts.push(yearText + (hasRemainingUnits ? ',' : ''));
    }

    if (months > 0) {
      const monthText = `${months} ${getRuDeclension(months, 'месяц', 'месяца', 'месяцев')}`;
      const hasRemainingDays = remainingDays > 0;
      parts.push(monthText + (hasRemainingDays ? ',' : ''));
    }

    if (remainingDays > 0) {
      parts.push(`${remainingDays} ${getRuDeclension(remainingDays, 'день', 'дня', 'дней')}`);
    }

    return parts.join(' ');
  }
}
