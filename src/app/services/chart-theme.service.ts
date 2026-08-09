import { computed, inject, Injectable } from '@angular/core';
import {
  CHART_COLORS_DARK,
  CHART_COLORS_LIGHT,
  ChartColors,
  FOOD_STATS_MONTH_LABELS_OPTIONS_DARK,
  FOOD_STATS_MONTH_LABELS_OPTIONS_LIGHT,
  MonthLabelsPluginOptions,
} from '@app/shared/chart-config';
import { Chart } from 'chart.js';
import { SettingsService } from './settings.service';

// Single place every Chart.js-based component reads its theme from — replaces the
// darkTheme ternary that used to be duplicated independently in each chart component.
@Injectable({
  providedIn: 'root',
})
export class ChartThemeService {
  private readonly settingsService = inject(SettingsService);

  public readonly colors$$ = computed<ChartColors>(() => {
    const colors = this.settingsService.darkTheme$$() ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
    // Chart.js resolves grid/tick/legend colors from these defaults on every chart.update()
    // call unless a chart's own options override them. Setting them here, as part of computing
    // colors$$ rather than in a separate effect, guarantees they're current before any chart
    // component's own theme-reactive update effect (which also reads colors$$) runs.
    Chart.defaults.color = colors.text;
    Chart.defaults.borderColor = colors.grid;
    return colors;
  });

  public readonly monthLabelsOptions$$ = computed<MonthLabelsPluginOptions>(() =>
    this.settingsService.darkTheme$$() ? FOOD_STATS_MONTH_LABELS_OPTIONS_DARK : FOOD_STATS_MONTH_LABELS_OPTIONS_LIGHT,
  );
}
