import { IsString, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionDto {
  @IsString()
  planId: string;

  @IsString()
  customerId: string;

  @IsString()
  customerEmail: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsBoolean()
  trialPeriod?: boolean;

  @IsOptional()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  customFields?: Record<string, any>;
}
