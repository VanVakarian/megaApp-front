import { computed, Injectable } from '@angular/core';

export interface DeviceInfo {
  isMobile: boolean;
  hasRearCamera: boolean;
  hasFrontCamera: boolean;
  isTouchDevice: boolean;
  platform: 'mobile' | 'tablet' | 'desktop';
}

@Injectable({
  providedIn: 'root',
})
export class DeviceDetectorService {
  private deviceInfo: DeviceInfo | null = null;

  public readonly isMobile$$ = computed(() => this.detectMobile());
  public readonly isDesktop$$ = computed(() => !this.detectMobile());

  constructor() {
    // effect(() => { console.log('ISMOBILE have been updated:', this.isMobile$$()) }); // prettier-ignore
  }

  public async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    const isTouchDevice = this.detectTouchDevice();
    const isMobile = this.detectMobile();
    const platform = this.detectPlatform();
    const { hasRearCamera, hasFrontCamera } = await this.detectCameras();

    this.deviceInfo = {
      isMobile,
      hasRearCamera,
      hasFrontCamera,
      isTouchDevice,
      platform,
    };

    return this.deviceInfo;
  }

  public shouldShowCameraButtonSync(): boolean {
    const isMobile = this.detectMobile();
    const isTouchDevice = this.detectTouchDevice();
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;

    const userAgent = navigator.userAgent.toLowerCase();
    const isLaptop =
      userAgent.includes('macintosh') ||
      userAgent.includes('windows') ||
      (userAgent.includes('linux') && !userAgent.includes('android'));

    if (isLaptop && !isTouchDevice) {
      return false;
    }

    return (isMobile || isTouchDevice) && hasMediaDevices;
  }

  public async shouldShowCameraButton(): Promise<boolean> {
    const deviceInfo = await this.getDeviceInfo();

    return deviceInfo.isMobile || deviceInfo.hasRearCamera;
  }

  private detectTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private detectMobile(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile', 'opera mini'];

    return mobileKeywords.some((keyword) => userAgent.includes(keyword));
  }

  private detectPlatform(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|android.*mobile/.test(userAgent)) {
      return 'mobile';
    }

    if (/ipad|android(?!.*mobile)|tablet/.test(userAgent)) {
      return 'tablet';
    }

    return 'desktop';
  }

  private async detectCameras(): Promise<{ hasRearCamera: boolean; hasFrontCamera: boolean }> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return { hasRearCamera: false, hasFrontCamera: false };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');

      let hasRearCamera = false;
      let hasFrontCamera = false;

      for (const device of videoInputs) {
        const label = device.label.toLowerCase();

        if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
          hasRearCamera = true;
        } else if (label.includes('front') || label.includes('user') || label.includes('facing')) {
          hasFrontCamera = true;
        } else if (label.includes('webcam') || label.includes('camera') || label.includes('usb')) {
          hasFrontCamera = true;
        }
      }

      if (videoInputs.length > 0 && !hasRearCamera && !hasFrontCamera) {
        const isMobile = this.detectMobile();

        if (isMobile) {
          if (videoInputs.length === 1) {
            hasRearCamera = true;
          } else {
            hasRearCamera = true;
            hasFrontCamera = true;
          }
        } else {
          hasFrontCamera = true;
        }
      }

      return { hasRearCamera, hasFrontCamera };
    } catch (error) {
      console.warn('Failed to detect cameras:', error);
      return { hasRearCamera: false, hasFrontCamera: false };
    }
  }

  public clearCache(): void {
    this.deviceInfo = null;
  }

  public logDeviceInfo(): void {
    const isMobile = this.detectMobile();
    const isTouchDevice = this.detectTouchDevice();
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;
    const userAgent = navigator.userAgent;
    const shouldShow = this.shouldShowCameraButtonSync();

    console.log('Device Detection Info:', {
      userAgent,
      isMobile,
      isTouchDevice,
      hasMediaDevices,
      shouldShowCameraButton: shouldShow,
      platform: this.detectPlatform(),
    });
  }
}
