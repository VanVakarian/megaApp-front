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
import { CHART_COLORS } from '@app/shared/chart-config';
import { BalanceChartAccountSeries, BalanceChartData } from '@app/shared/types';
import { VButton } from '@ui-kit/components/v-button/v-button';
import { VCheckbox } from '@ui-kit/components/v-checkbox/v-checkbox';
import {
  CategoryScale,
  Chart,
  ChartDataset,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler);

const ACCOUNT_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
  '#d37295',
  '#a0cbe8',
  '#ffbe7d',
  '#86bcb6',
  '#8cd17d',
  '#f1ce63',
];

@Component({
  selector: 'balances-chart',
  templateUrl: './balances-chart.html',
  imports: [VButton, VCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalancesChart implements AfterViewInit, OnDestroy {
  readonly dataInput = input.required<BalanceChartData>();

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly showByAccount$$ = signal(false);
  protected readonly hideSuspended$$ = signal(false);
  protected readonly enabledAccountIds$$ = signal<Set<number>>(new Set());

  protected readonly activeAccountSeries$$ = computed(() => {
    const series = this.dataInput().accountSeries;
    const enabled = this.enabledAccountIds$$();
    const hideSuspended = this.hideSuspended$$();
    return series.filter((s) => {
      if (!enabled.has(s.accountId)) return false;
      if (hideSuspended && s.isSuspended) return false;
      return true;
    });
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
    const chart = this.chart$$();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, showByAccount, activeSeries);
  });

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvas().nativeElement.getContext('2d');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        animation: false,
        elements: { line: { tension: 0.3 } },
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
            filter: (item) => {
              const raw = (item.dataset as any)['_rawValues'];
              if (!raw) return item.parsed.y !== 0;
              return raw[item.dataIndex] !== 0;
            },
            callbacks: {
              label: (ctx) => {
                const raw = (ctx.dataset as any)['_rawValues'];
                const value = raw ? raw[ctx.dataIndex] : ctx.parsed.y;
                return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          },
          y: {
            min: 0,
            ticks: {
              callback: (value) =>
                new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(
                  value as number,
                ),
            },
          },
        },
      },
    });

    this.chart$$.set(chart);
  }

  public ngOnDestroy(): void {
    this.chart$$()?.destroy();
  }

  protected toggleHideSuspended(): void {
    this.hideSuspended$$.set(!this.hideSuspended$$());
  }

  protected setShowByAccount(value: boolean): void {
    this.showByAccount$$.set(value);
  }

  protected isAccountEnabled(accountId: number): boolean {
    return this.enabledAccountIds$$().has(accountId);
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
    return ACCOUNT_PALETTE[index % ACCOUNT_PALETTE.length];
  }

  private rebuildChartDatasets(
    chart: Chart,
    data: BalanceChartData,
    showByAccount: boolean,
    activeSeries: BalanceChartAccountSeries[],
  ): void {
    const labels = data.dates.map((d) => this.formatDateLabel(d));

    if (!showByAccount) {
      chart.data.labels = labels;
      chart.data.datasets = [
        {
          label: 'Баланс',
          data: data.totals,
          fill: true,
          borderColor: CHART_COLORS.main,
          backgroundColor: CHART_COLORS.mainAlpha,
          pointRadius: 2,
          pointHitRadius: 20,
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
      const color = ACCOUNT_PALETTE[globalIdx % ACCOUNT_PALETTE.length];
      const colorAlpha = color + '99';

      const rawValues = series.values.map((v) => Math.max(0, v));
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
        pointRadius: 2,
        pointHitRadius: 20,
        _rawValues: rawValues,
      } as unknown as ChartDataset<'line'>);
    });

    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.update('none');
  }

  private formatDateLabel(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}.${year}`;
  }
}
