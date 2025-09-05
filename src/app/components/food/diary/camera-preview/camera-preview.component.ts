import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CapturedPhoto } from '@app/shared/interfaces';
import { IconName } from '@app/shared/ui-kit/types';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { VIcon } from '@app/shared/ui-kit/v-icon/v-icon';

@Component({
  selector: 'camera-preview',
  templateUrl: './camera-preview.component.html',
  styleUrl: './camera-preview.component.scss',
  imports: [VIcon, VButton],
})
export class CameraPreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video')
  private video!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvas')
  private canvas!: ElementRef<HTMLCanvasElement>;

  @Output()
  public photoTaken = new EventEmitter<CapturedPhoto>();

  @Output()
  public cancelled = new EventEmitter<void>();

  protected readonly isLoading$$ = signal(false);
  protected readonly photoDataUrl$$ = signal<string>('');
  protected readonly error$$ = signal<string>('');
  protected readonly isConfirmPhotoTemporarilyDisabled$$ = signal(false);

  private readonly capturedFile$$ = signal<File | null>(null);
  protected readonly hasPhoto$$ = computed(() => this.capturedFile$$() !== null);

  protected readonly IconName = IconName;

  private cameraStream: MediaStream | null = null;

  constructor() {
    effect(() => {
      if (this.hasPhoto$$()) {
        this.isConfirmPhotoTemporarilyDisabled$$.set(true);
        setTimeout(() => this.isConfirmPhotoTemporarilyDisabled$$.set(false), 1000);
      }
    });

    // effect(() => { console.log('isConfirmTemporarilyDisabled$$ has been updated:', this.isConfirmTemporarilyDisabled$$()) }); // prettier-ignore
    // effect(() => { console.log('hasPhoto$$ has been updated:', this.hasPhoto$$()) }); // prettier-ignore
  }

  public async ngAfterViewInit(): Promise<void> {
    await this.startCamera();
  }

  public ngOnDestroy(): void {
    this.stopCamera();
  }

  public async startCamera(): Promise<void> {
    try {
      this.isLoading$$.set(true);
      this.error$$.set('');

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (this.video?.nativeElement) {
        this.video.nativeElement.srcObject = this.cameraStream;
        await this.video.nativeElement.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.error$$.set('Не удалось получить доступ к камере. Проверьте разрешения.');
    } finally {
      this.isLoading$$.set(false);
    }
  }

  public takePhoto(): void {
    if (!this.video?.nativeElement || !this.canvas?.nativeElement) {
      return;
    }

    const video = this.video.nativeElement;
    const canvas = this.canvas.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      this.error$$.set('Ошибка создания изображения');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          this.capturedFile$$.set(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
          this.photoDataUrl$$.set(canvas.toDataURL('image/jpeg', 0.8));
          this.stopCamera();
        } else {
          this.error$$.set('Ошибка создания фото');
        }
      },
      'image/jpeg',
      0.8,
    );
  }

  public confirmPhoto(): void {
    console.log('Confirm photo clicked');
    const capturedFile = this.capturedFile$$();
    if (capturedFile && this.photoDataUrl$$()) {
      this.photoTaken.emit({
        file: capturedFile,
        dataUrl: this.photoDataUrl$$(),
      });
    }
  }

  public retakePhoto(): void {
    this.photoDataUrl$$.set('');
    this.capturedFile$$.set(null);
    this.startCamera();
  }

  public cancel(): void {
    this.cancelled.emit();
  }

  private stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
  }
}
