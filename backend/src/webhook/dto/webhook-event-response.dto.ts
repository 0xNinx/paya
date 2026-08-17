import { EventType } from '../entities/webhook-event.entity';

export class WebhookEventResponseDto {
  id: string;
  eventId: string;
  webhookId: string;
  eventType: EventType;
  payload: Record<string, any>;
  deliveryStatus: string;
  retryCount: number;
  nextRetryAt: Date;
  deliveredAt: Date;
  errorMessage: string;
  statusCode: number;
  responseTime: number;
  createdAt: Date;
  metadata: Record<string, any>;
}
