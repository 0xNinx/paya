import { IsEnum, IsObject, IsString } from 'class-validator';
import { EventType } from '../entities/webhook-event.entity';

export class TriggerWebhookDto {
  @IsEnum(EventType)
  eventType: EventType;

  @IsObject()
  payload: Record<string, any>;

  @IsString()
  @IsOptional()
  merchantId?: string;
}
