import { Component, ElementRef, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'ui-progress-icon',
  templateUrl: './progress-icon.component.html',
  styleUrl: './progress-icon.component.scss',
})
export class UiProgressIcon implements OnChanges {
  @Input()
  public progressNum: number = 0;

  @Input()
  public diameter: number = 40;

  @Input()
  public strokeWidthCircle: number = 4;

  @Input()
  public strokeWidthPie: number = 0;

  @Input()
  // public color: string = '#3f51b5'; // TODO[092] Color system refactor
  public color: string = '#000000de';

  @Input()
  public backgroundColor: string = '#e0e0e0';

  radius: number = 0;
  circumference: number = 0;
  dashoffset: number = 0;
  piePathData: string = '';

  constructor(private elementRef: ElementRef) {}

  public get isCircle(): boolean {
    const element = this.elementRef.nativeElement;
    return !element.hasAttribute('pieStyle');
  }

  public get isPie(): boolean {
    const element = this.elementRef.nativeElement;
    return element.hasAttribute('pieStyle');
  }

  ngOnChanges() {
    this.radius = (this.diameter - this.strokeWidthCircle) / 2;
    this.circumference = 2 * Math.PI * this.radius;
    this.updateProgress();
  }

  updateProgress() {
    const clampedProgress = Math.max(0, Math.min(100, this.progressNum));
    const progress = clampedProgress / 100;

    // Updating the circular progress
    this.dashoffset = this.circumference * (1 - progress);

    // Updating the pie progress
    this.updatePiePath(progress);
  }

  // Calculating the SVG path for the pie chart
  updatePiePath(progress: number) {
    if (progress <= 0) {
      this.piePathData = '';
      return;
    }

    // Clamping progress to ensure it is between 0% and 100%
    if (progress >= 1) {
      this.piePathData = `M ${this.diameter / 2} ${this.diameter / 2}
        m 0 -${this.radius}
        a ${this.radius} ${this.radius} 0 1 1 0 ${2 * this.radius}
        a ${this.radius} ${this.radius} 0 1 1 0 -${2 * this.radius}`;
      return;
    }

    // Calculating end point based on progress
    const angle = progress * 2 * Math.PI;
    const x = this.diameter / 2 + this.radius * Math.sin(angle);
    const y = this.diameter / 2 - this.radius * Math.cos(angle);

    // Arc flag is 0 for angles less than 180 degrees, 1 for angles greater than 180 degrees
    const largeArcFlag = progress > 0.5 ? 1 : 0;

    // Building the SVG path
    this.piePathData = `M ${this.diameter / 2} ${this.diameter / 2}
      L ${this.diameter / 2} ${this.diameter / 2 - this.radius}
      A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${x} ${y}
      Z`;
  }
}
