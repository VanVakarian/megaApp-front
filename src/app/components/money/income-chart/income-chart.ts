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
  readonly currencySymbolInput = input<string>('₽');
  readonly monthRangeInput = input<[string, string] | null>(null);

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly enabledCategoryIds$$ = signal<Set<number | null>>(new Set());
  protected readonly yearlyMode$$ = signal(false);

  private yearBoundaries: { year: string; startIdx: number; endIdx: number }[] = [];

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
    const monthRange = this.monthRangeInput();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, activeSeries, yearly, monthRange);
  });

  private readonly yearSeparatorPlugin: Plugin = {
    id: 'incomeYearSeparator',
    afterDraw: (chart) => {
      if (this.yearlyMode$$()) return;
      if (!this.yearBoundaries.length) return;
      const xScale = chart.scales['x'];
      if (!xScale) return;
      const { ctx, chartArea } = chart;
      ctx.save();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i < this.yearBoundaries.length; i++) {
        const x =
          Math.round(
            (xScale.getPixelForValue(this.yearBoundaries[i - 1].endIdx) +
              xScale.getPixelForValue(this.yearBoundaries[i].startIdx)) /
              2,
          ) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }

      const labelY = Math.round((chartArea.bottom + xScale.bottom) / 2);
      const font = Chart.defaults.font;
      ctx.fillStyle = Chart.defaults.color as string;
      ctx.font = `${font.size ?? 12}px ${font.family ?? 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const { year, startIdx, endIdx } of this.yearBoundaries) {
        const centerX = (xScale.getPixelForValue(startIdx) + xScale.getPixelForValue(endIdx)) / 2;
        ctx.fillText(year, centerX, labelY);
      }

      ctx.restore();
    },
  };

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvas().nativeElement.getContext('2d');
    if (!ctx) return;
    const chart = new Chart(ctx, { ...INCOME_CHART_CONFIG, plugins: [this.yearSeparatorPlugin] });
    if (chart.options.plugins?.tooltip?.callbacks) {
      chart.options.plugins.tooltip.callbacks.label = (ctx) => {
        if (ctx.parsed.y === 0) return '';
        return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(ctx.parsed.y)} ${this.currencySymbolInput()}`;
      };
    }
    this.chart$$.set(chart);
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
    monthRange: [string, string] | null,
  ): void {
    const effectiveData: IncomeChartData =
      !yearly && monthRange !== null
        ? (() => {
            const [start, end] = monthRange;
            const indices: number[] = [];
            data.months.forEach((m, i) => {
              const ym = m.substring(0, 7);
              if (ym >= start && ym <= end) indices.push(i);
            });
            return {
              months: indices.map((i) => data.months[i]),
              categorySeries: data.categorySeries.map((s) => ({
                ...s,
                values: indices.map((i) => s.values[i]),
              })),
            };
          })()
        : data;
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
      this.yearBoundaries = [];
      const yearMap = new Map<string, { startIdx: number; endIdx: number }>();
      effectiveData.months.forEach((m, i) => {
        const year = m.substring(0, 4);
        const existing = yearMap.get(year);
        if (!existing) {
          yearMap.set(year, { startIdx: i, endIdx: i });
        } else {
          existing.endIdx = i;
        }
      });
      yearMap.forEach((bounds, year) => this.yearBoundaries.push({ year, ...bounds }));
      labels = effectiveData.months.map(() => '');
    }

    (chart.options.scales!['x']!.ticks as any).callback = yearly
      ? (value: unknown, index: number) => labels[index]
      : () => '';

    const datasets: ChartDataset<'bar'>[] = activeSeries.map((series) => {
      const index = data.categorySeries.findIndex((s) => s.categoryId === series.categoryId);
      const color = INCOME_SERIES_PALETTE[index % INCOME_SERIES_PALETTE.length];
      const monthlyValues =
        effectiveData.categorySeries.find((s) => s.categoryId === series.categoryId)?.values ?? series.values;
      return {
        label: series.categoryName,
        data: yearly ? yearlyValues!.get(series.categoryId)! : monthlyValues,
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
