import { DeliveryStatus } from '../entities/webhook-delivery.entity';

export class WebhookDeliveryResponseDto {
  id: string;
  deliveryId: string;
  eventId: string;
  webhookId: string;
  url: string;
  status: DeliveryStatus;
  requestPayload: Record<string, any>;
  requestHeaders: Record<string, string>;
  responseStatusCode: number;
  responseBody: string;
  errorMessage: string;
  attemptNumber: number;
  responseTime: number;
  deliveredAt: Date;
  nextRetryAt: Date;
  createdAt: Date;
  metadata: Record<string, any>;
}
