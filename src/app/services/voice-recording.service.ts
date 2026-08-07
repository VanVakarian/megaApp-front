import { inject, Injectable, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { PerformanceMetricsService } from '@app/services/performance-metrics.service';
import { WebSocketMessageType } from '@app/shared/types';

@Injectable({
  providedIn: 'root',
})
export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private sequenceNumber = 0;
  private recordingStartedAt: number | null = null;

  public readonly isRecording$$ = signal(false);

  private readonly networkService = inject(NetworkService);
  private readonly performanceMetrics = inject(PerformanceMetricsService);

  public async startRecording(): Promise<void> {
    const startedAt = performance.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];
      this.sequenceNumber = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.handleAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        this.mediaRecorder = null;
        if (this.recordingStartedAt !== null) {
          this.performanceMetrics.record('food.voice_flow', performance.now() - this.recordingStartedAt, {
            chunks: this.audioChunks.length,
            audioBytes: this.audioChunks.reduce((total, chunk) => total + chunk.size, 0),
          });
          this.recordingStartedAt = null;
        }
      };

      this.networkService.sendMessage({
        type: WebSocketMessageType.START_VOICE_RECORDING,
      });

      this.mediaRecorder.start(100);
      this.isRecording$$.set(true);
      this.recordingStartedAt = startedAt;
    } catch (error) {
      console.error('Error starting voice recording:', error);
      this.performanceMetrics.record('food.voice_start', performance.now() - startedAt, undefined, 'error');
      throw error;
    }
  }

  public stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.isRecording$$.set(false);
      this.mediaRecorder.stop();

      setTimeout(() => {
        this.networkService.sendMessage({
          type: WebSocketMessageType.STOP_VOICE_RECORDING,
        });
      }, 150);
    } else {
      console.warn('Cannot stop recording: MediaRecorder is not active');
    }
  }

  private handleAudioChunk(chunk: Blob): void {
    this.audioChunks.push(chunk);

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];

      this.networkService.sendMessage({
        type: WebSocketMessageType.AUDIO_CHUNK,
        data: base64Data,
        sequence: ++this.sequenceNumber,
      });
    };

    reader.readAsDataURL(chunk);
  }
}
