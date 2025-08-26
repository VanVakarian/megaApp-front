import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PhotoAnalysisResult {
  result: boolean;
  data?: {
    id: number;
    name: string;
    kcals: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
  } | null;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PhotoCaptureService {
  constructor(private http: HttpClient) {}

  public async analyzeImage(file: File): Promise<PhotoAnalysisResult> {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await firstValueFrom(this.http.post<PhotoAnalysisResult>('/api/food/analyze-image', formData));

      return response;
    } catch (error) {
      console.error('Error analyzing image:', error);
      return {
        result: false,
        error: 'Failed to analyze image',
      };
    }
  }

  public async selectFromGallery(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = this.createFileInput();

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        resolve(file || null);
      };

      input.oncancel = () => {
        resolve(null);
      };

      input.click();
    });
  }

  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    return input;
  }
}
