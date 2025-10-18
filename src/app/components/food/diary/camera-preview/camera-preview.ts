import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FoodAddModalService } from '@app/services/food/food-add-modal.service';
import { PhotoCaptureService } from '@app/services/photo-capture.service';
import { CapturedPhoto } from '@app/shared/interfaces';
import { VButton } from '@app/shared/ui-kit/v-button/v-button';
import { IconName, VIcon } from '@app/shared/ui-kit/v-icon/v-icon';

@Component({
  selector: 'camera-preview',
  templateUrl: './camera-preview.html',
  imports: [VIcon, VButton],
})
export class CameraPreview implements AfterViewInit, OnDestroy {
  @ViewChild('video')
  private readonly video!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvas')
  private readonly canvas!: ElementRef<HTMLCanvasElement>;

  protected readonly isLoading$$ = signal(false);
  protected readonly photoDataUrl$$ = signal<string>('');
  protected readonly error$$ = signal<string>('');
  protected readonly isConfirmPhotoTemporarilyDisabled$$ = signal(false);

  private readonly capturedFile$$ = signal<File | null>(null);
  protected readonly hasPhoto$$ = computed(() => this.capturedFile$$() !== null);

  protected readonly Icon = IconName;

  private cameraStream: MediaStream | null = null;

  private readonly photoCaptureService = inject(PhotoCaptureService);
  private readonly foodAddModalService = inject(FoodAddModalService);

  private readonly confirmPhotoButtonCooldownEffect$$ = effect(() => {
    if (this.hasPhoto$$()) {
      this.isConfirmPhotoTemporarilyDisabled$$.set(true);
      setTimeout(() => this.isConfirmPhotoTemporarilyDisabled$$.set(false), 500);
    }
  });

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

  public async confirmPhoto(): Promise<void> {
    const capturedFile = this.capturedFile$$();
    if (capturedFile && this.photoDataUrl$$()) {
      const capturedPhoto: CapturedPhoto = {
        file: capturedFile,
        dataUrl: this.photoDataUrl$$(),
      };

      this.foodAddModalService.submitSuccess();

      try {
        const result = await this.photoCaptureService.analyzeImage(capturedPhoto.file);

        if (result?.result && result.data) {
          console.log('Photo analysis result:', result.data);
        } else if (result?.error) {
          console.error('Photo analysis failed:', result.error);
        } else {
          console.error('Photo analysis returned no results');
        }
      } catch (error) {
        console.error('Error during photo analysis:', error);
      }
    }
  }

  public retakePhoto(): void {
    this.photoDataUrl$$.set('');
    this.capturedFile$$.set(null);
    this.startCamera();
  }

  public cancel(): void {
    this.foodAddModalService.goBackToSearch();
  }

  private stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
  }
}
