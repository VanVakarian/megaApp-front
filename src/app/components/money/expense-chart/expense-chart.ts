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
import { EXPENSE_CATEGORY_CONFIG, EXPENSE_CHART_CONFIG, getExpenseCategoryColor } from '@app/shared/chart-config';
import { ExpenseChartData } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VInput } from '@ui-kit/components/v-input/v-input';
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

interface ExpenseChartSeries {
  categoryId: number | null;
  categoryName: string;
}

@Component({
  selector: 'expense-chart',
  templateUrl: './expense-chart.html',
  imports: [VButton, VCheckbox, VInput, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseChart implements AfterViewInit, OnDestroy {
  readonly dataInput = input.required<ExpenseChartData>();

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly enabledCategoryIds$$ = signal<Set<number | null>>(new Set());
  protected readonly yearlyMode$$ = signal(false);
  protected readonly yMaxInput$$ = signal<string>(localStorage.getItem('expense-chart-y-max') ?? '');

  private yearBoundaries: { year: string; startIdx: number; endIdx: number }[] = [];

  protected readonly viewToggleItems: VToggleItem[] = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  protected readonly allSeriesList$$ = computed((): ExpenseChartSeries[] => {
    const categories = this.dataInput().categories;
    const series: ExpenseChartSeries[] = categories.map((cat) => ({ categoryId: cat.id, categoryName: cat.name }));
    if (this.dataInput().monthRows.some((r) => r.uncategorizedAmount > 0)) {
      series.push({ categoryId: null, categoryName: 'Uncategorized' });
    }
    const configOrder = new Map(EXPENSE_CATEGORY_CONFIG.map((c, i) => [c.name, i]));
    series.sort((a, b) => {
      const ia = configOrder.get(a.categoryName) ?? Number.MAX_SAFE_INTEGER;
      const ib = configOrder.get(b.categoryName) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
    return series;
  });

  protected readonly activeSeries$$ = computed(() => {
    const series = this.allSeriesList$$();
    const enabled = this.enabledCategoryIds$$();
    return series.filter((s) => enabled.has(s.categoryId));
  });

  private readonly syncEnabledCategoriesEffect = effect(() => {
    const series = this.allSeriesList$$();
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
    const activeSeries = this.activeSeries$$();
    const allSeries = this.allSeriesList$$();
    const chart = this.chart$$();
    const yearly = this.yearlyMode$$();
    const ymax = this.yMaxInput$$();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, activeSeries, allSeries, yearly, ymax);
  });

  private readonly yearSeparatorPlugin: Plugin = {
    id: 'expenseYearSeparator',
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
    this.chart$$.set(new Chart(ctx, { ...EXPENSE_CHART_CONFIG, plugins: [this.yearSeparatorPlugin] }));
  }

  public ngOnDestroy(): void {
    this.chart$$()?.destroy();
  }

  protected readonly allEnabled$$ = computed(() => {
    const series = this.allSeriesList$$();
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

  protected onYMaxChange(value: string): void {
    this.yMaxInput$$.set(value);
    localStorage.setItem('expense-chart-y-max', value);
  }

  protected toggleAll(): void {
    const series = this.allSeriesList$$();
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

  protected getCategoryColor(categoryId: number | null, allSeries: ExpenseChartSeries[]): string {
    const series = allSeries.find((s) => s.categoryId === categoryId);
    const fallbackIndex = allSeries.findIndex((s) => s.categoryId === categoryId);
    return getExpenseCategoryColor(series?.categoryName ?? '', fallbackIndex);
  }

  private rebuildChartDatasets(
    chart: Chart,
    data: ExpenseChartData,
    activeSeries: ExpenseChartSeries[],
    allSeries: ExpenseChartSeries[],
    yearly: boolean,
    yMaxRaw: string,
  ): void {
    const months = data.monthRows.map((r) => r.period);
    let labels: string[];
    let yearlyValues: Map<number | null, number[]> | null = null;

    if (yearly) {
      const yearLabels: string[] = [];
      const yearIndexMap = new Map<string, number>();
      months.forEach((m) => {
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
        months.forEach((m, i) => {
          const year = m.substring(0, 4);
          const val =
            s.categoryId === null
              ? data.monthRows[i].uncategorizedAmount
              : (data.monthRows[i].categoryAmounts[s.categoryId] ?? 0);
          yearVals[yearIndexMap.get(year)!] += val;
        });
        yearlyValues!.set(s.categoryId, yearVals);
      });
    } else {
      this.yearBoundaries = [];
      const yearMap = new Map<string, { startIdx: number; endIdx: number }>();
      months.forEach((m, i) => {
        const year = m.substring(0, 4);
        const existing = yearMap.get(year);
        if (!existing) {
          yearMap.set(year, { startIdx: i, endIdx: i });
        } else {
          existing.endIdx = i;
        }
      });
      yearMap.forEach((bounds, year) => this.yearBoundaries.push({ year, ...bounds }));
      labels = months.map(() => '');
    }

    (chart.options.scales!['x']!.ticks as any).callback = yearly
      ? (value: unknown, index: number) => labels[index]
      : () => '';

    const datasets: ChartDataset<'bar'>[] = activeSeries.map((series) => {
      const fallbackIndex = allSeries.findIndex((s) => s.categoryId === series.categoryId);
      const color = getExpenseCategoryColor(series.categoryName, fallbackIndex);
      const seriesValues: number[] = yearly
        ? yearlyValues!.get(series.categoryId)!
        : months.map((_, i) =>
            series.categoryId === null
              ? data.monthRows[i].uncategorizedAmount
              : (data.monthRows[i].categoryAmounts[series.categoryId!] ?? 0),
          );
      return {
        label: series.categoryName,
        data: seriesValues,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        stack: 'expense',
      };
    });
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    const parsedMax = parseInt(yMaxRaw, 10);
    const maxStackedValue = labels.reduce((max, _, i) => {
      const barTotal = datasets.reduce((sum, ds) => sum + ((ds.data[i] as number) ?? 0), 0);
      return Math.max(max, barTotal);
    }, 0);
    chart.options.scales!['y']!.max =
      !yearly && parsedMax > 0 && !isNaN(parsedMax) && maxStackedValue > parsedMax ? parsedMax : undefined;
    chart.update('none');
  }
}
