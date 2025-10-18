import { inject, Injectable, signal } from '@angular/core';
import { NetworkService } from '@app/services/network.service';
import { WebSocketMessageType } from '@app/shared/interfaces';

@Injectable({
  providedIn: 'root',
})
export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private sequenceNumber = 0;

  public readonly isRecording$$ = signal(false);

  private readonly networkService = inject(NetworkService);

  public async startRecording(): Promise<void> {
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
      };

      this.networkService.sendMessage({
        type: WebSocketMessageType.START_VOICE_RECORDING,
      });

      this.mediaRecorder.start(100);
      this.isRecording$$.set(true);
    } catch (error) {
      console.error('Error starting voice recording:', error);
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
