import { IsString, IsOptional } from 'class-validator';

export class ReplayWebhookDto {
  @IsString()
  eventId: string;

  @IsString()
  @IsOptional()
  webhookId?: string;
}
