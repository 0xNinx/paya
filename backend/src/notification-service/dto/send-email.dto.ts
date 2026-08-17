import { IsString, IsOptional, IsObject } from 'class-validator';

export class SendEmailDto {
  @IsString()
  merchantId: string;

  @IsString()
  recipientEmail: string;

  @IsString()
  recipientName: string;

  @IsString()
  template: string;

  @IsObject()
  templateData: Record<string, any>;

  @IsOptional()
  subject?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
