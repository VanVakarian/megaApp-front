import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FoodService } from '@app/services/food.service';
import { SettingsService } from '@app/services/settings.service';

interface BmiSegment {
  twSegmentClasses: string;
  twLabelClasses?: string;
}

@Component({
  selector: 'app-bmi',
  templateUrl: './bmi.component.html',
  styleUrl: './bmi.component.scss',
  imports: [CommonModule, MatIconModule],
})
export class BMIComponent implements OnInit {
  protected bmiSegments: BmiSegment[] = [
    {
      twSegmentClasses: 'relative h-2 rounded-l-md bg-yellow-300',
    },
    {
      twSegmentClasses: 'relative h-2 bg-green-400',
      twLabelClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      twSegmentClasses: 'relative h-2 bg-yellow-300',
      twLabelClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      twSegmentClasses: 'relative h-2 bg-red-300',
      twLabelClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      twSegmentClasses: 'relative h-2 bg-red-500',
      twLabelClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      twSegmentClasses: 'relative h-2 rounded-r-md bg-red-700',
      twLabelClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
  ];

  protected bmiSegmentsWidthFractions: number[] = [];

  protected bmiPointerPercent$$: Signal<number | null> = computed(() => this.calculateBmiPointerPercent());

  private bmiValues = [16, 18.5, 25, 30, 35, 40, 45];

  private bmiSegmentsThresholdsInKgs$$: Signal<number[]> = computed(() => this.prepBmiSegmentsThresholdsInKgs());

  private selectedDateWeight$$: Signal<number> = computed(() => this.getSelectedDateWeight());

  constructor(
    private foodService: FoodService,
    private settingsService: SettingsService,
  ) {
    // effect(() => { console.log('SELECTEDDATEWEIGHT has been updated:', this.selectedDateWeight$$()) }); // prettier-ignore
  }

  public ngOnInit(): void {
    this.bmiSegmentsWidthFractions = this.calculateBmiSegmentsWidthFractions();
  }

  protected bmiKgThresholdValue(idx: number): number {
    return this.bmiSegmentsThresholdsInKgs$$()[idx];
  }

  protected bmiSegmentTitle(segmentIdx: number): string {
    const thresholds = this.bmiSegmentsThresholdsInKgs$$();
    const segmentStart = thresholds[segmentIdx];
    const segmentEnd = thresholds[segmentIdx + 1];
    return `${segmentStart} - ${segmentEnd}`;
  }

  private getSelectedDateWeight(): number {
    const selectedDateISO = this.foodService.selectedDayIso$$();
    return this.foodService.diary$$()?.[selectedDateISO]?.totals.bodyWeight ?? 0;
  }

  private calculateBmiPointerPercent(): number | null {
    const weight = this.selectedDateWeight$$();
    if (!this.isWeightWithinRange(weight)) return null;

    const bmiKgs = this.bmiSegmentsThresholdsInKgs$$();
    if (bmiKgs.length === 0) return null;

    const percentShift = (weight - bmiKgs[0]) / (bmiKgs[bmiKgs.length - 1] - bmiKgs[0]);
    return Math.max(0, Math.min(100, percentShift * 100));
  }

  private isWeightWithinRange(weight: number): boolean {
    const bmiKgs = this.bmiSegmentsThresholdsInKgs$$();
    return weight > bmiKgs[0] && weight < bmiKgs[bmiKgs.length - 1];
  }

  private prepBmiSegmentsThresholdsInKgs(): number[] {
    const height = this.settingsService.settings$$().height;
    if (!height) return [];

    const heightMeters = height / 100;
    return this.bmiValues.map((value) => {
      return Math.round(value * (heightMeters * heightMeters));
    });
  }

  private calculateBmiSegmentsWidthFractions(): number[] {
    const fractions: number[] = [];
    const total = this.bmiValues[this.bmiValues.length - 1] - this.bmiValues[0];

    for (let i = 0; i < this.bmiValues.length - 1; i++) {
      const segment = this.bmiValues[i + 1] - this.bmiValues[i];
      fractions.push(segment / total);
    }

    return fractions;
  }
}
