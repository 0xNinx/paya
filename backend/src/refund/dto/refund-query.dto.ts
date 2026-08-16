import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { RefundStatus, RefundReason, RefundType } from '../entities/refund.entity';
import { Type } from 'class-transformer';

export class RefundQueryDto {
  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsEnum(RefundReason)
  reason?: RefundReason;

  @IsOptional()
  @IsEnum(RefundType)
  refundType?: RefundType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
