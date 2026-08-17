import { IsString, IsArray, IsOptional, IsEnum, IsUrl, IsNumber } from 'class-validator';
import { WebhookStatus } from '../entities/webhook.entity';

export class RegisterWebhookDto {
  @IsString()
  merchantId: string;

  @IsUrl()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  retryDelay?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
