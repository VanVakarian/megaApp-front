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
  ChartConfiguration,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

import { FoodStatsService } from '@app/services/food-stats.service';
import { SettingsService } from '@app/services/settings.service';
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
})
export class FoodStatsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('weightChartCanvas')
  public weightChartCanvas!: ElementRef;

  @ViewChild('kcalsChartCanvas')
  public kcalsChartCanvas!: ElementRef;

  public weightChart!: Chart;
  public kcalsChart!: Chart;

  public selectedDateIdxStart: number = 0;
  public selectedDateIdxEnd: number = 0;

  public sliderStartLabel: string = '';
  public sliderEndLabel: string = '';
  public selectedRangeLabel: string = '';

  public get maxSliderValue(): number {
    return this.foodStatsService.statsChartData$$().dates.length - 1;
  }

  constructor(
    private foodStatsService: FoodStatsService,
    private settingsService: SettingsService,
  ) {
    const throttledUpdate = this.createThrottledChartUpdater();
    const debouncedUpdate = this.createDebouncedChartUpdater();

    effect(() => {
      // Generating labels
      const dates = this.foodStatsService.statsChartData$$().dates;
      const startIdx = this.foodStatsService.selectedDateIdxStart$$();
      const endIdx = this.foodStatsService.selectedDateIdxEnd$$();

      if (dates.length === 0 || startIdx < 0 || endIdx < 0 || startIdx >= dates.length || endIdx >= dates.length) {
        this.sliderStartLabel = '';
        this.sliderEndLabel = '';
        this.selectedRangeLabel = '';
        return;
      }

      const selectedLowDate = dates[startIdx];
      const selectedHighDate = dates[endIdx];
      if (!selectedLowDate || !selectedHighDate) return;

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

    effect(() => {
      const isLiteVersion = this.settingsService.settings$$()?.liteVersion;
      this.updateKcalsChartAxisVisibility(isLiteVersion);
    });
  }

  public async ngOnInit(): Promise<void> {
    if (!Object.keys(this.foodStatsService.stats$$()).length) {
      await firstValueFrom(this.foodStatsService.getStats());
    }

    const isLiteVersion = this.settingsService.settings$$()?.liteVersion;
    this.initializeCharts(isLiteVersion);
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

  private initializeCharts(isLiteVersion: boolean): void {
    this.weightChart = new Chart('WeightChart', WEIGHT_CHART_SETTINGS);

    const kcalsSettings = this.createKcalsChartSettings(isLiteVersion);
    this.kcalsChart = new Chart('KcalsChart', kcalsSettings);
  }

  private createKcalsChartSettings(isLiteVersion: boolean): ChartConfiguration {
    const settings = { ...KCALS_CHART_SETTINGS };
    if (settings.options?.scales?.['y']) {
      settings.options.scales['y'].ticks = {
        ...settings.options.scales['y'].ticks,
        display: !isLiteVersion,
        stepSize: 500,
      };
    }

    if (!settings.options) {
      settings.options = {};
    }
    if (!settings.options.plugins) {
      settings.options.plugins = {};
    }
    settings.options.plugins.tooltip = {
      ...settings.options.plugins.tooltip,
      enabled: !isLiteVersion,
    };

    return settings;
  }

  private updateKcalsChartAxisVisibility(isLiteVersion: boolean): void {
    if (this.kcalsChart?.options?.scales) {
      const yScale = this.kcalsChart.options.scales['y'];
      if (yScale?.ticks) {
        yScale.ticks = {
          ...yScale.ticks,
          display: !isLiteVersion,
        };
      }

      if (!this.kcalsChart.options.plugins) {
        this.kcalsChart.options.plugins = {};
      }
      this.kcalsChart.options.plugins.tooltip = {
        ...this.kcalsChart.options.plugins.tooltip,
        enabled: !isLiteVersion,
      };

      this.kcalsChart.update();
    }
  }
}
