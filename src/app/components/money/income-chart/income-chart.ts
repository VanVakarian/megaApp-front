import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { INCOME_CHART_CONFIG, INCOME_SERIES_PALETTE } from '@app/shared/chart-config';
import { IncomeChartCategorySeries, IncomeChartData } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartDataset,
  Legend,
  LinearScale,
  Plugin,
  Tooltip,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'income-chart',
  templateUrl: './income-chart.html',
  imports: [VButton, VCheckbox, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeChart implements AfterViewInit, OnDestroy {
  readonly dataInput = input.required<IncomeChartData>();

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly enabledCategoryIds$$ = signal<Set<number | null>>(new Set());
  protected readonly yearlyMode$$ = signal(false);

  protected readonly viewToggleItems: VToggleItem[] = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  protected readonly activeCategorySeries$$ = computed(() => {
    const series = this.dataInput().categorySeries;
    const enabled = this.enabledCategoryIds$$();
    return series.filter((s) => enabled.has(s.categoryId));
  });

  private readonly syncEnabledCategoriesEffect = effect(() => {
    const series = this.dataInput().categorySeries;
    untracked(() => {
      const current = this.enabledCategoryIds$$();
      const newIds = series.map((s) => s.categoryId).filter((id) => !current.has(id));
      if (newIds.length > 0) {
        const updated = new Set(current);
        newIds.forEach((id) => updated.add(id));
        this.enabledCategoryIds$$.set(updated);
      }
    });
  });

  private readonly chartUpdateEffect = effect(() => {
    const data = this.dataInput();
    const activeSeries = this.activeCategorySeries$$();
    const chart = this.chart$$();
    const yearly = this.yearlyMode$$();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, activeSeries, yearly);
  });

  private readonly yearSeparatorPlugin: Plugin = {
    id: 'incomeYearSeparator',
    afterDraw: (chart) => {
      if (this.yearlyMode$$()) return;
      const labels = chart.data.labels;
      if (!labels || labels.length < 2) return;
      const xScale = chart.scales['x'];
      if (!xScale) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i < labels.length; i++) {
        if (/^\d{4}$/.test(labels[i] as string)) {
          const x = Math.round((xScale.getPixelForValue(i - 1) + xScale.getPixelForValue(i)) / 2) + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvas().nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart$$.set(new Chart(ctx, { ...INCOME_CHART_CONFIG, plugins: [this.yearSeparatorPlugin] }));
  }

  public ngOnDestroy(): void {
    this.chart$$()?.destroy();
  }

  protected readonly allEnabled$$ = computed(() => {
    const series = this.dataInput().categorySeries;
    const enabled = this.enabledCategoryIds$$();
    return series.every((s) => enabled.has(s.categoryId));
  });

  protected readonly allNoneLabel$$ = computed(() => (this.allEnabled$$() ? 'None' : 'All'));

  protected viewToggleValue(): string[] {
    return this.yearlyMode$$() ? ['yearly'] : ['monthly'];
  }

  protected onViewToggleChange(value: string[]): void {
    this.yearlyMode$$.set(value[0] === 'yearly');
  }

  protected toggleAll(): void {
    const series = this.dataInput().categorySeries;
    if (this.allEnabled$$()) {
      this.enabledCategoryIds$$.set(new Set());
    } else {
      this.enabledCategoryIds$$.set(new Set(series.map((s) => s.categoryId)));
    }
  }

  protected toggleCategory(categoryId: number | null, checked: boolean): void {
    const current = this.enabledCategoryIds$$();
    const updated = new Set(current);
    if (checked) {
      updated.add(categoryId);
    } else {
      updated.delete(categoryId);
    }
    this.enabledCategoryIds$$.set(updated);
  }

  protected isCategoryEnabled(categoryId: number | null): boolean {
    return this.enabledCategoryIds$$().has(categoryId);
  }

  protected getCategoryColor(categoryId: number | null): string {
    const index = this.dataInput().categorySeries.findIndex((s) => s.categoryId === categoryId);
    return INCOME_SERIES_PALETTE[index % INCOME_SERIES_PALETTE.length];
  }

  private formatDateLabel(monthEndISO: string): string {
    const date = new Date(monthEndISO + 'T00:00:00');
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month === 0) return String(year);
    return `${String(month + 1).padStart(2, '0')}.${year}`;
  }

  private rebuildChartDatasets(
    chart: Chart,
    data: IncomeChartData,
    activeSeries: IncomeChartCategorySeries[],
    yearly: boolean,
  ): void {
    let labels: string[];
    let yearlyValues: Map<number | null, number[]> | null = null;

    if (yearly) {
      const yearLabels: string[] = [];
      const yearIndexMap = new Map<string, number>();
      data.months.forEach((m) => {
        const year = m.substring(0, 4);
        if (!yearIndexMap.has(year)) {
          yearIndexMap.set(year, yearLabels.length);
          yearLabels.push(year);
        }
      });
      labels = yearLabels;
      yearlyValues = new Map();
      activeSeries.forEach((s) => {
        const yearVals = new Array(yearLabels.length).fill(0);
        data.months.forEach((m, i) => {
          const year = m.substring(0, 4);
          yearVals[yearIndexMap.get(year)!] += s.values[i];
        });
        yearlyValues!.set(s.categoryId, yearVals);
      });
    } else {
      labels = data.months.map((m) => this.formatDateLabel(m));
    }

    const datasets: ChartDataset<'bar'>[] = activeSeries.map((series) => {
      const index = data.categorySeries.findIndex((s) => s.categoryId === series.categoryId);
      const color = INCOME_SERIES_PALETTE[index % INCOME_SERIES_PALETTE.length];
      return {
        label: series.categoryName,
        data: yearly ? yearlyValues!.get(series.categoryId)! : series.values,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        stack: 'income',
      };
    });
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update('none');
  }
}
