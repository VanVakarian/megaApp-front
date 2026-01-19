import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DeviceInfoService } from '@app/services/device-info.service';
import { FoodStatsService } from '@app/services/food/food-stats.service';
import { KCALS_CHART_SETTINGS, WEIGHT_CHART_SETTINGS } from '@app/shared/const';
import { StatsChartData } from '@app/shared/interfaces';
import { formatDateTicks, getRuDeclension } from '@app/shared/utils';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCard } from '@ui-kit/components/v-card/v-card';
import { VSlider, VSliderRangeValue } from '@ui-kit/components/v-slider/v-slider';
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

const CHART_UPDATES_PER_SECOND = 10;
const CHART_UPDATE_INTERVAL_MS = Math.round(1000 / CHART_UPDATES_PER_SECOND);

/**
 * Food stats charts flow:
 * - Raw daily stats are loaded into a service and transformed into full and clipped datasets.
 * - The slider range and range buttons update start/end indices immediately; labels and day count are derived from those indices.
 * - Slider positions are based on the date index list to snap selection to existing days.
 * - Charts are updated from clipped datasets; updates are throttled with a trailing flush so the final fast-drag state is rendered.
 * - Lite mode only toggles kcal axis ticks and tooltip visibility, without changing data.
 * - Charts are created once and then kept in sync through reactive updates.
 */
@Component({
  selector: 'food-stats',
  templateUrl: './food-stats.html',
  imports: [VButton, VCard, VSlider],
})
export class FoodStats implements OnInit, AfterViewInit {
  protected readonly weightChartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('weightChartCanvas');
  protected readonly kcalsChartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('kcalsChartCanvas');

  protected readonly weightChart$$ = signal<Chart | null>(null);
  protected readonly kcalsChart$$ = signal<Chart | null>(null);

  private readonly dates$$ = computed(() => this.foodStatsService.statsChartData$$().dates);

  private readonly selectedRangeInfo$$ = computed(() => {
    const dates = this.dates$$();
    const startIdx = this.foodStatsService.selectedDateIdxStart$$();
    const endIdx = this.foodStatsService.selectedDateIdxEnd$$();

    if (dates.length === 0 || startIdx < 0 || endIdx < 0 || startIdx >= dates.length || endIdx >= dates.length) {
      return { startLabel: '', endLabel: '', rangeLabel: '' };
    }

    const selectedLowDate = dates[startIdx];
    const selectedHighDate = dates[endIdx];
    if (!selectedLowDate || !selectedHighDate) return { startLabel: '', endLabel: '', rangeLabel: '' };

    const selectedDaysCount = endIdx - startIdx + 1;

    return {
      startLabel: formatDateTicks(selectedLowDate),
      endLabel: formatDateTicks(selectedHighDate),
      rangeLabel: this.formatSelectedRange(selectedDaysCount),
    };
  });

  protected readonly sliderStartLabel$$ = computed(() => this.selectedRangeInfo$$().startLabel);
  protected readonly sliderEndLabel$$ = computed(() => this.selectedRangeInfo$$().endLabel);
  protected readonly selectedRangeLabel$$ = computed(() => this.selectedRangeInfo$$().rangeLabel);

  protected readonly sliderValueList$$ = computed(() => {
    return this.dates$$().map((_, index) => index);
  });

  protected readonly selectedRange$$ = computed(() => {
    return [
      this.foodStatsService.selectedDateIdxStart$$(),
      this.foodStatsService.selectedDateIdxEnd$$(),
    ] as VSliderRangeValue;
  });

  protected readonly maxSliderValue$$ = computed(() => {
    return this.dates$$().length - 1;
  });

  protected readonly deviceInfoService = inject(DeviceInfoService);
  private readonly foodStatsService = inject(FoodStatsService);

  private readonly throttledUpdate = this.createThrottledChartUpdater();

  private readonly chartsUpdateEffect = effect(() => {
    const data = this.foodStatsService.statsChartDataClipped$$();
    this.throttledUpdate(data);
  });

  public async ngOnInit(): Promise<void> {
    this.foodStatsService.getStats();

    this.initializeCharts();
  }

  public ngAfterViewInit(): void {
    const weightContext = this.weightChartCanvas().nativeElement.getContext('2d');
    if (weightContext) {
      weightContext.canvas.height = 250;
    }

    const kcalsContext = this.kcalsChartCanvas().nativeElement.getContext('2d');
    if (kcalsContext) {
      kcalsContext.canvas.height = 250;
    }
  }

  protected onRangeChange(range: VSliderRangeValue): void {
    const [start, end] = range;
    if (end <= start) return;
    this.foodStatsService.selectedDateIdxStart$$.set(start);
    this.foodStatsService.selectedDateIdxEnd$$.set(end);
  }

  protected clipDateRange(daysAmtToShow: number): void {
    this.foodStatsService.clipDateRange(daysAmtToShow);
  }

  private updateWeightChart(data: StatsChartData) {
    const chart = this.weightChart$$();
    if (chart?.data) {
      chart.data.labels = data.dates;
      chart.data.datasets[0].data = data.weights;
      chart.data.datasets[1].data = data.weightsAvg;
      chart.update('none');
    }
  }

  private updateKcalsChart(data: StatsChartData) {
    const chart = this.kcalsChart$$();
    if (chart?.data) {
      chart.data.labels = data.dates;
      chart.data.datasets[0].data = data.kcals;
      chart.data.datasets[1].data = data.kcalsTarget;
      chart.update('none');
    }
  }

  private createThrottledChartUpdater() {
    return this.throttleLatest(CHART_UPDATE_INTERVAL_MS, (data) => {
      this.updateWeightChart(data);
      this.updateKcalsChart(data);
    });
  }

  private formatSelectedRange(selectedDaysCount: number): string {
    const DAYS_IN_YEAR = 365;
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

  private initializeCharts(): void {
    this.weightChart$$.set(new Chart('WeightChart', WEIGHT_CHART_SETTINGS));
    this.kcalsChart$$.set(new Chart('KcalsChart', KCALS_CHART_SETTINGS));
  }

  private throttleLatest(delay: number, fn: (data: StatsChartData) => void): (data: StatsChartData) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingData: StatsChartData | null = null;

    return (data: StatsChartData) => {
      const now = Date.now();
      pendingData = data;
      const elapsed = now - lastCall;

      if (elapsed >= delay) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        lastCall = now;
        fn(data);
        return;
      }

      if (!timeoutId) {
        const remaining = delay - elapsed;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (!pendingData) return;
          lastCall = Date.now();
          fn(pendingData);
        }, remaining);
      }
    };
  }
}
