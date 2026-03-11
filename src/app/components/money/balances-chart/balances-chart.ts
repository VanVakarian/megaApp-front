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
import { BALANCE_ACCOUNT_PALETTE, BALANCE_CHART_CONFIG, CHART_COLORS } from '@app/shared/chart-config';
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

  protected readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  protected readonly chart$$ = signal<Chart | null>(null);
  protected readonly showByAccount$$ = signal(false);
  protected readonly suspensionFilter$$ = signal<'all' | 'exclude' | 'only'>('all');
  protected readonly enabledAccountIds$$ = signal<Set<number>>(new Set());

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
    const chart = this.chart$$();
    if (!chart) return;
    this.rebuildChartDatasets(chart, data, showByAccount, activeSeries, suspensionFilter);
  });

  public ngAfterViewInit(): void {
    const ctx = this.chartCanvas().nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart$$.set(new Chart(ctx, BALANCE_CHART_CONFIG));
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
    { id: 'exclude', label: 'Excl. Suspended' },
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
  ): void {
    const labels = data.dates.map((d) => this.formatDateLabel(d));

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
          borderColor: CHART_COLORS.main,
          backgroundColor: CHART_COLORS.mainAlpha,
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
      const colorAlpha = color + '99';

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

  private formatDateLabel(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}.${year}`;
  }
}
