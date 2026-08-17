import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class PauseSubscriptionDto {
  @IsOptional()
  pauseAt?: string;

  @IsOptional()
  resumeAt?: string;

  @IsOptional()
  reason?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ResumeSubscriptionDto {
  @IsOptional()
  resumeAt?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
