import { WebhookStatus } from '../entities/webhook.entity';

export class WebhookResponseDto {
  id: string;
  webhookId: string;
  merchantId: string;
  url: string;
  status: WebhookStatus;
  events: string[];
  maxRetries: number;
  timeout: number;
  allowedIps: string[];
  rateLimitPerMinute: number;
  testMode: boolean;
  successCount: number;
  failureCount: number;
  lastSuccessAt: Date;
  lastFailureAt: Date;
  lastTriggeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}
