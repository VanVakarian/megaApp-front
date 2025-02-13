import { Component } from '@angular/core';
import { Notification } from '@app/shared/interfaces';
import { NotificationsService } from '../../../services/notifications.service';
import { slideInOutAnimation } from './notifications.animations';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  animations: [slideInOutAnimation],
})
export class NotificationsComponent {
  constructor(public notificationsService: NotificationsService) {}

  removeNotification(notification: Notification) {
    this.notificationsService.removeNotification(notification.id);
  }
}
