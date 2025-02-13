import { Injectable } from '@angular/core';
import { Notification } from '@app/shared/interfaces';

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  notifications: Notification[] = [];
  currentId = 0;

  bgColourTable = {
    error: 'bg-red-600',
    warning: 'bg-yellow-400',
    success: 'bg-green-600',
    info: 'bg-white',
  };
  textColourTable = {
    error: 'text-white',
    warning: 'text-black',
    success: 'text-white',
    info: 'text-black',
  };
  borderColourTable = {
    error: '',
    warning: '',
    success: '',
    info: 'border-gray-700',
  };

  addNotification(message: string, notiffKind: string, time: number = 0) {
    const bgColour = this.bgColourTable[notiffKind as keyof typeof this.bgColourTable];
    const textColour = this.textColourTable[notiffKind as keyof typeof this.textColourTable];
    const borderColour = this.borderColourTable[notiffKind as keyof typeof this.borderColourTable];

    const id = this.currentId++;
    this.notifications.push({ id, message, bgColour, textColour, borderColour, time });

    if (time === 0) {
      setTimeout(() => this.removeNotification(id), (1 + message.length / 20) * 1000);
    } else if (time > 0) {
      setTimeout(() => this.removeNotification(id), time * 1000);
    }
  }

  removeNotification(id: number) {
    this.notifications = this.notifications.filter((notification) => notification.id !== id);
  }
}
