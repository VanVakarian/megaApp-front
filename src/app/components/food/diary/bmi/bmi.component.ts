import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import { FoodService } from '@app/services/food.service';
import { SettingsService } from '@app/services/settings.service';

interface BmiSegment {
  divClasses: string;
  spanClasses?: string;
}

@Component({
  selector: 'app-bmi',
  templateUrl: './bmi.component.html',
  styleUrl: './bmi.component.scss',
  standalone: true,
  imports: [CommonModule, MatIconModule],
})
export class BMIComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bmiMeter') bmiMeterElem!: ElementRef;

  public bmiSegments: BmiSegment[] = [
    {
      divClasses: 'relative h-2 rounded-l-md bg-yellow-300',
    },
    {
      divClasses: 'relative h-2 bg-green-400',
      spanClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      divClasses: 'relative h-2 bg-yellow-300',
      spanClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      divClasses: 'relative h-2 bg-red-300',
      spanClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      divClasses: 'relative h-2 bg-red-500',
      spanClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
    {
      divClasses: 'relative h-2 rounded-r-md bg-red-700',
      spanClasses: 'absolute left-0 top-[10px] text-sm -translate-x-1/2',
    },
  ];

  public bmiContainerWidth$$: WritableSignal<number> = signal(0);
  public bmiPointerShift$$: Signal<number | null> = computed(() => this.calculateBmiPointerShift());

  private bmiValues = [16, 18.5, 25, 30, 35, 40, 45];
  private bmiSegmentsWidthFractions: number[] = [];
  private bmiSegmentsThresholdsInKgs: number[] = [];

  private selectedDateWeight$$: Signal<number> = computed(() => this.getSelectedDateWeight());

  private resizeObserver: ResizeObserver | null = null;

  public get bmiPointerShiftStyle(): { left: string } | null {
    const shift = this.bmiPointerShift$$();
    if (shift) {
      return { left: `${shift}px` };
    } else {
      return null;
    }
  }

  constructor(
    public foodService: FoodService,
    public settingsService: SettingsService,
  ) {
    effect(() => {
      this.bmiPointerShift$$(); // needed to trigger re-calculation
      this.bmiSegmentsThresholdsInKgs = this.prepBmiSegmentsThresholdsInKgs();

      // console.log('bmiPointerShift has been updated:', this.bmiPointerShift$$()); // prettier-ignore
      // console.log('selectedDateWeight has been updated:', this.selectedDateWeight$$()); // prettier-ignore
    });

    this.resizeObserver = new ResizeObserver(() => {
      const width = this.bmiMeterElem?.nativeElement?.clientWidth;
      this.bmiContainerWidth$$.set(width ? width - 2 : 0); // adjusting for padding
    });
  }

  public ngOnInit(): void {
    this.bmiSegmentsWidthFractions = this.calculateBmiSegmentsWidthFractions();
  }

  public ngAfterViewInit(): void {
    if (this.bmiMeterElem?.nativeElement) {
      this.resizeObserver?.observe(this.bmiMeterElem.nativeElement);
    }
  }

  public ngOnDestroy(): void {
    if (this.bmiMeterElem?.nativeElement) {
      this.resizeObserver?.unobserve(this.bmiMeterElem.nativeElement);
    }
    this.resizeObserver?.disconnect();
  }

  public bmiKgThresholdValue(idx: number): number {
    return this.bmiSegmentsThresholdsInKgs[idx];
  }

  public bmiSegmentWidthStyle(segmentIdx: number): { width: string } {
    const segmentWidthFraction = this.bmiSegmentsWidthFractions[segmentIdx];
    const segmentWidthPx = segmentWidthFraction * this.bmiContainerWidth$$();
    return { width: `${segmentWidthPx}px` };
  }

  public bmiSegmentTitle(segmentIdx: number): string {
    const segmentStart = this.bmiSegmentsThresholdsInKgs[segmentIdx];
    const segmentEnd = this.bmiSegmentsThresholdsInKgs[segmentIdx + 1];
    return `${segmentStart} - ${segmentEnd}`;
  }

  private getSelectedDateWeight(): number {
    const selectedDateISO = this.foodService.selectedDayIso$$();
    return this.foodService.diary$$()?.[selectedDateISO]?.bodyWeight ?? 0;
  }

  private calculateBmiPointerShift(): number | null {
    const weight = this.selectedDateWeight$$();
    if (!this.isWeightWithinRange(weight)) return null;

    const containerWidth = this.bmiContainerWidth$$();
    const bmiKgs = this.bmiSegmentsThresholdsInKgs;
    const percentShift = (weight - bmiKgs[0]) / (bmiKgs[bmiKgs.length - 1] - bmiKgs[0]);
    return containerWidth * percentShift;
  }

  private isWeightWithinRange(weight: number): boolean {
    const thresholds = this.bmiSegmentsThresholdsInKgs;
    return weight > thresholds[0] && weight < thresholds[thresholds.length - 1];
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
