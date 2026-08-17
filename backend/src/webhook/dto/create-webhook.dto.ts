import { IsString, IsUrl, IsArray, IsEnum, IsOptional, IsNumber, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { WebhookStatus } from '../entities/webhook.entity';
import { EventType } from '../entities/webhook-event.entity';

export class CreateWebhookDto {
  @IsString()
  merchantId: string;

  @IsUrl()
  url: string;

  @IsEnum(WebhookStatus)
  @IsOptional()
  status?: WebhookStatus;

  @IsArray()
  @IsEnum(EventType, { each: true })
  events: EventType[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsObject()
  @IsOptional()
  payloadTemplate?: Record<string, any>;

  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @IsNumber()
  @IsOptional()
  timeout?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedIps?: string[];

  @IsNumber()
  @IsOptional()
  rateLimitPerMinute?: number;

  @IsBoolean()
  @IsOptional()
  testMode?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
