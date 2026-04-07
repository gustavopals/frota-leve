import { Injectable } from '@angular/core';
import { PoNotificationService } from '@po-ui/ng-components';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private readonly poNotificationService: PoNotificationService) {}

  success(message: string): void {
    this.poNotificationService.success(message);
  }

  info(message: string): void {
    this.poNotificationService.information(message);
  }

  warning(message: string): void {
    this.poNotificationService.warning(message);
  }

  error(message: string): void {
    this.poNotificationService.error(message);
  }
}
