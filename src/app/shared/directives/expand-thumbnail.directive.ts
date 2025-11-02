import { Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { VExpand } from '@app/shared/ui-kit/v-expand/v-expand';

@Directive({
  selector: 'v-expand[foodImageUrl]',
  host: {
    '[style.position]': '"relative"',
    '[class.thumbnail-expanded]': 'isExpanded$$()',
  },
})
export class FoodThumbnailDirective {
  public readonly foodImageUrl = input<string>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly vExpand = inject(VExpand);

  protected readonly isExpanded$$ = this.vExpand['_isExpanded$$'];

  private thumbnailImageSvgContainer: SVGSVGElement | null = null;
  private mediumImageSvgContainer: SVGSVGElement | null = null;

  private readonly animationDuration = '0.1s';

  private readonly thumbnailImageSize = 40;
  private readonly mediumImageSize = 185;

  private readonly thumbnailImageZoomLevel = 1.5;
  private readonly mediumImageZoomLevel = 1.0;

  private readonly squircleOffsetRatio = 0.06;
  private readonly squircleCornerRatio = 0.4;
  private readonly thumbnailImageBlurDeviation = 0.8;

  private readonly mediumImageBlurDeviation = 3;
  private readonly mediumImageXOffset = -9;

  private readonly updateImagesEffect$$ = effect(() => {
    this.updateThumbnails(this.foodImageUrl());
  });

  private readonly updateExpansionEffect$$ = effect(() => {
    this.updateThumbnailsState(this.isExpanded$$());
  });

  private createSquircleSVG(imageUrl: string, size: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', `squircleMask-${Date.now()}`);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const offset = size * this.squircleOffsetRatio;
    const corner = size * this.squircleCornerRatio;
    const center = size * (1 - this.squircleCornerRatio);
    path.setAttribute(
      'd',
      `
        M ${offset} ${corner}
        C ${offset} ${offset}, ${offset} ${offset}, ${corner} ${offset}
        L ${center} ${offset}
        C ${size - offset} ${offset}, ${size - offset} ${offset}, ${size - offset} ${corner}
        L ${size - offset} ${center}
        C ${size - offset} ${size - offset}, ${size - offset} ${size - offset}, ${center} ${size - offset}
        L ${corner} ${size - offset}
        C ${offset} ${size - offset}, ${offset} ${size - offset}, ${offset} ${center}
        Z
      `,
    );
    path.setAttribute('fill', 'white');
    path.setAttribute('filter', 'url(#blur)');

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'blur');

    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', this.thumbnailImageBlurDeviation.toString());

    filter.appendChild(feGaussianBlur);
    mask.appendChild(path);
    defs.appendChild(mask);
    defs.appendChild(filter);

    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', imageUrl);

    const zoomedSize = size * this.thumbnailImageZoomLevel;
    const imageOffset = (zoomedSize - size) / 2;
    image.setAttribute('width', zoomedSize.toString());
    image.setAttribute('height', zoomedSize.toString());
    image.setAttribute('x', (-imageOffset).toString());
    image.setAttribute('y', (-imageOffset).toString());
    image.setAttribute('mask', `url(#${mask.getAttribute('id')})`);

    svg.appendChild(defs);
    svg.appendChild(image);

    return svg;
  }

  private createCornerBlurSVG(imageUrl: string, size: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', `cornerBlurMask-${Date.now()}`);

    const filterId = `cornerBlur-${Date.now()}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const offset = size * 0.125;
    const edgePoint = size * 0.875;
    path.setAttribute(
      'd',
      `
        M ${-offset} ${-offset}
        L ${edgePoint} ${-offset}
        L ${edgePoint} 0
        C ${edgePoint} ${size * 0.8125}, ${size * 0.8125} ${edgePoint}, 0 ${edgePoint}
        L ${-offset} ${edgePoint}
        L ${-offset} ${-offset}
        Z
      `,
    );
    path.setAttribute('fill', 'white');
    path.setAttribute('filter', `url(#${filterId})`);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);

    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', this.mediumImageBlurDeviation.toString());

    filter.appendChild(feGaussianBlur);
    mask.appendChild(path);
    defs.appendChild(mask);
    defs.appendChild(filter);

    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', imageUrl);
    const zoomedSize = size * this.mediumImageZoomLevel;
    const imageOffset = (zoomedSize - size) / 2;
    const horizontalOffset = size * (this.mediumImageXOffset / 100);
    image.setAttribute('width', zoomedSize.toString());
    image.setAttribute('height', zoomedSize.toString());
    image.setAttribute('x', (-imageOffset + horizontalOffset).toString());
    image.setAttribute('y', (-imageOffset).toString());
    image.setAttribute('mask', `url(#${mask.getAttribute('id')})`);

    svg.appendChild(defs);
    svg.appendChild(image);

    return svg;
  }

  private updateThumbnails(imageUrl: string | undefined): void {
    if (!imageUrl) return;

    if (this.thumbnailImageSvgContainer) {
      this.renderer.removeChild(this.elementRef.nativeElement, this.thumbnailImageSvgContainer);
      this.thumbnailImageSvgContainer = null;
    }

    if (this.mediumImageSvgContainer) {
      this.renderer.removeChild(this.elementRef.nativeElement, this.mediumImageSvgContainer);
      this.mediumImageSvgContainer = null;
    }

    this.thumbnailImageSvgContainer = this.createSquircleSVG(imageUrl, this.thumbnailImageSize);
    this.setSvgSize(this.thumbnailImageSvgContainer, this.thumbnailImageSize);
    this.thumbnailImageSvgContainer.style.zIndex = '-1';
    this.thumbnailImageSvgContainer.style.opacity = '1';
    this.thumbnailImageSvgContainer.style.transition = `
      width ${this.animationDuration} ease-in-out,
      height ${this.animationDuration} ease-in-out,
      opacity ${this.animationDuration} ease-in-out
    `;

    this.mediumImageSvgContainer = this.createCornerBlurSVG(imageUrl, this.mediumImageSize);
    this.setSvgSize(this.mediumImageSvgContainer, this.thumbnailImageSize);
    this.mediumImageSvgContainer.style.zIndex = '-2';
    this.mediumImageSvgContainer.style.opacity = '0';
    this.mediumImageSvgContainer.style.transition = `
      width ${this.animationDuration} ease-in-out,
      height ${this.animationDuration} ease-in-out,
      opacity ${this.animationDuration} ease-in-out
    `;

    this.renderer.insertBefore(
      this.elementRef.nativeElement,
      this.mediumImageSvgContainer,
      this.elementRef.nativeElement.firstChild,
    );

    this.renderer.insertBefore(
      this.elementRef.nativeElement,
      this.thumbnailImageSvgContainer,
      this.elementRef.nativeElement.firstChild,
    );
  }

  private updateThumbnailsState(isExpanded: boolean): void {
    if (!this.thumbnailImageSvgContainer || !this.mediumImageSvgContainer) {
      return;
    }

    if (isExpanded) {
      this.setSvgSize(this.thumbnailImageSvgContainer, this.mediumImageSize);
      this.setSvgSize(this.mediumImageSvgContainer, this.mediumImageSize);

      this.thumbnailImageSvgContainer.style.opacity = '0';
      this.mediumImageSvgContainer.style.opacity = '1';
    } else {
      this.setSvgSize(this.thumbnailImageSvgContainer, this.thumbnailImageSize);
      this.setSvgSize(this.mediumImageSvgContainer, this.thumbnailImageSize);

      this.thumbnailImageSvgContainer.style.zIndex = '-1';
      this.mediumImageSvgContainer.style.zIndex = '-2';

      this.thumbnailImageSvgContainer.style.opacity = '1';
      this.mediumImageSvgContainer.style.opacity = '0';
    }
  }

  private setSvgSize(svgElem: SVGSVGElement, size: number): void {
    svgElem.style.width = `${size}px`;
    svgElem.style.height = `${size}px`;
  }
}
