import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  computed,
  effect,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { SettingsService } from '@app/services/settings.service';
import {
  BALANCE_ACCOUNT_PALETTE,
  BALANCE_CHART_CONFIG,
  ChartColors,
  CHART_COLORS_DARK,
  CHART_COLORS_LIGHT,
  formatMonthYearLabel,
} from '@app/shared/chart-config';
import { BalanceChartAccountSeries, BalanceChartData } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import { VToggle, VToggleItem } from '@ui-kit/components/v-toggle/v-toggle';
import {
  CategoryScale,
  Chart,
  ChartDataset,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  Plugin,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler);

@Component({
  selector: 'balances-chart',
  templateUrl: './balances-chart.html',
  imports: [VButton, VCheckbox, VToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalancesChart implements AfterViewInit, OnDestroy {
  readonly dataInput = input.required<BalanceChartData>();
  readonly currencySymbolInput = input<string>('₽');

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly showByAccount$$ = signal(false);
  protected readonly suspensionFilter$$ = signal<'all' | 'exclude' | 'only'>('all');
  protected readonly enabledAccountIds$$ = signal<Set<number>>(new Set());

  private readonly settingsService = inject(SettingsService);
  private readonly chartColors$$ = computed(() =>
    this.settingsService.settings$$().darkTheme ? CHART_COLORS_DARK : CHART_COLORS_LIGHT,
  );

  private yearBoundaries: { year: string; startIdx: number; endIdx: number }[] = [];

  private readonly crosshairPlugin: Plugin = {
    id: 'balanceCrosshair',
    afterDraw: (chart) => {
      const active = chart.tooltip?.getActiveElements();
      if (!active?.length) return;

      const { top, bottom, left, right } = chart.chartArea;
      const x = active[0].element.x;
      if (x < left || x > right) return;

      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    },
  };

  private readonly yearSeparatorPlugin: Plugin = {
    id: 'balanceYearSeparator',
    afterDraw: (chart) => {
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

  protected readonly activeAccountSeries$$ = computed(() => {
    const series = this.dataInput().accountSeries;
    const enabled = this.enabledAccountIds$$();
    return series.filter((s) => enabled.has(s.accountId));
  });

  private readonly syncEnabledAccountsEffect = effect(() => {
    const series = this.dataInput().accountSeries;
    untracked(() => {
      const current = this.enabledAccountIds$$();
      const newIds = series.map((s) => s.accountId).filter((id) => !current.has(id));
      if (newIds.length > 0) {
        const updated = new Set(current);
        newIds.forEach((id) => updated.add(id));
        this.enabledAccountIds$$.set(updated);
      }
    });
  });

  private readonly chartUpdateEffect = effect(() => {
    const data = this.dataInput();
    const showByAccount = this.showByAccount$$();
    const activeSeries = this.activeAccountSeries$$();
    const suspensionFilter = this.suspensionFilter$$();
    const colors = this.chartColors$$();
    const chart = this.chart$$();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, showByAccount, activeSeries, suspensionFilter, colors);
  });

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvas().nativeElement.getContext('2d');
    if (!ctx) return;
    const chart = new Chart(ctx, {
      ...BALANCE_CHART_CONFIG,
      plugins: [this.yearSeparatorPlugin, this.crosshairPlugin],
    });
    if (chart.options.plugins?.tooltip?.callbacks) {
      chart.options.plugins.tooltip.callbacks.label = (ctx) => {
        const raw = (ctx.dataset as any)['_rawValues'];
        const value = raw ? raw[ctx.dataIndex] : ctx.parsed.y;
        return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ${this.currencySymbolInput()}`;
      };
      chart.options.plugins.tooltip.callbacks.footer = (items) => {
        if (items.length < 2) return [];
        const sum = items.reduce((acc, item) => {
          const raw = (item.dataset as any)['_rawValues'];
          const value = raw ? raw[item.dataIndex] : item.parsed.y;
          return acc + value;
        }, 0);
        return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(sum)} ${this.currencySymbolInput()}`;
      };
    }
    this.chart$$.set(chart);
  }

  public ngOnDestroy(): void {
    this.chart$$()?.destroy();
  }

  protected readonly viewToggleItems: VToggleItem[] = [
    { id: 'aggregated', label: 'Aggregated' },
    { id: 'by-account', label: 'By Account' },
  ];

  protected readonly suspensionToggleItems: VToggleItem[] = [
    { id: 'all', label: 'All' },
    { id: 'exclude', label: 'Exclude Suspended' },
    { id: 'only', label: 'Only Suspended' },
  ];

  protected viewToggleValue(): string[] {
    return this.showByAccount$$() ? ['by-account'] : ['aggregated'];
  }

  protected onViewToggleChange(value: string[]): void {
    this.showByAccount$$.set(value[0] === 'by-account');
  }

  protected suspensionToggleValue(): string[] {
    return [this.suspensionFilter$$()];
  }

  protected onSuspensionToggleChange(value: string[]): void {
    this.suspensionFilter$$.set((value[0] ?? 'all') as 'all' | 'exclude' | 'only');
  }

  protected isAccountEnabled(accountId: number): boolean {
    return this.enabledAccountIds$$().has(accountId);
  }

  protected readonly allEnabled$$ = computed(() => {
    const series = this.dataInput().accountSeries;
    const enabled = this.enabledAccountIds$$();
    return series.every((s) => enabled.has(s.accountId));
  });

  protected readonly allNoneLabel$$ = computed(() => (this.allEnabled$$() ? 'None' : 'All'));

  protected toggleAll(): void {
    const series = this.dataInput().accountSeries;
    if (this.allEnabled$$()) {
      this.enabledAccountIds$$.set(new Set());
    } else {
      this.enabledAccountIds$$.set(new Set(series.map((s) => s.accountId)));
    }
  }

  protected toggleAccount(accountId: number, checked: boolean): void {
    const current = this.enabledAccountIds$$();
    const updated = new Set(current);
    if (checked) {
      updated.add(accountId);
    } else {
      updated.delete(accountId);
    }
    this.enabledAccountIds$$.set(updated);
  }

  protected getAccountColor(accountId: number): string {
    const index = this.dataInput().accountSeries.findIndex((s) => s.accountId === accountId);
    return BALANCE_ACCOUNT_PALETTE[index % BALANCE_ACCOUNT_PALETTE.length];
  }

  private rebuildChartDatasets(
    chart: Chart,
    data: BalanceChartData,
    showByAccount: boolean,
    activeSeries: BalanceChartAccountSeries[],
    suspensionFilter: 'all' | 'exclude' | 'only',
    colors: ChartColors,
  ): void {
    const labels = data.dates.map((d) => formatMonthYearLabel(d));

    this.yearBoundaries = [];
    const yearMap = new Map<string, { startIdx: number; endIdx: number }>();
    data.dates.forEach((d, i) => {
      const year = d.substring(0, 4);
      const existing = yearMap.get(year);
      if (!existing) {
        yearMap.set(year, { startIdx: i, endIdx: i });
      } else {
        existing.endIdx = i;
      }
    });
    yearMap.forEach((bounds, year) => this.yearBoundaries.push({ year, ...bounds }));

    const getEffectiveValue = (s: BalanceChartAccountSeries, i: number): number => {
      if (suspensionFilter === 'only') return Math.max(0, s.suspendedValues[i] ?? 0);
      if (suspensionFilter === 'exclude') return Math.max(0, (s.values[i] ?? 0) - (s.suspendedValues[i] ?? 0));
      return Math.max(0, s.values[i] ?? 0);
    };

    if (!showByAccount) {
      const filteredTotals = data.dates.map((_, i) =>
        activeSeries.reduce((sum, s) => sum + getEffectiveValue(s, i), 0),
      );
      chart.data.labels = labels;
      chart.data.datasets = [
        {
          label: 'Баланс',
          data: filteredTotals,
          fill: true,
          borderColor: colors.main,
          backgroundColor: colors.mainAlpha,
        },
      ];
      chart.update('none');
      return;
    }

    const datasets: ChartDataset<'line'>[] = [];
    const accumulated: number[] = new Array(data.dates.length).fill(0);
    const allSeries = data.accountSeries;

    activeSeries.forEach((series, localIdx) => {
      const globalIdx = allSeries.findIndex((s) => s.accountId === series.accountId);
      const color = BALANCE_ACCOUNT_PALETTE[globalIdx % BALANCE_ACCOUNT_PALETTE.length];
      const colorAlpha = color.replace('rgb(', 'rgba(').replace(')', ', 0.6)');

      const rawValues = series.values.map((_, i) => getEffectiveValue(series, i));
      const cumulativeData = rawValues.map((v, i) => {
        accumulated[i] += v;
        return accumulated[i];
      });

      datasets.push({
        label: series.accountTitle,
        data: cumulativeData,
        fill: localIdx === 0 ? 'origin' : '-1',
        borderColor: color,
        backgroundColor: colorAlpha,
        _rawValues: rawValues,
      } as unknown as ChartDataset<'line'>);
    });

    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update('none');
  }
}
