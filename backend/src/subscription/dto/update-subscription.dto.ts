import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  customFields?: Record<string, any>;
}
