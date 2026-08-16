import { IsEnum, IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { RefundType, RefundReason } from '../entities/refund.entity';

export class CreateRefundDto {
  @IsNotEmpty()
  @IsString()
  paymentId: string;

  @IsEnum(RefundType)
  refundType: RefundType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  partialAmount?: number;

  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsOptional()
  @IsString()
  reasonDescription?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
