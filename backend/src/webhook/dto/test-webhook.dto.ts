import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { EventType } from '../entities/webhook-event.entity';

export class TestWebhookDto {
  @IsString()
  webhookId: string;

  @IsEnum(EventType)
  eventType: EventType;

  @IsObject()
  @IsOptional()
  testPayload?: Record<string, any>;
}
