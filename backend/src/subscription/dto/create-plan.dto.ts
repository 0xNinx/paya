import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BillingInterval } from '../entities/subscription-plan.entity';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  currency: string;

  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trialPeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lateFeePercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxRetryAttempts?: number;

  @IsOptional()
  @IsBoolean()
  prorateOnUpgrade?: boolean;

  @IsOptional()
  @IsBoolean()
  prorateOnDowngrade?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  limits?: Record<string, number>;

  @IsOptional()
  metadata?: Record<string, any>;
}
