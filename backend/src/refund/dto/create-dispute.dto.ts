import { IsEnum, IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { DisputeReason } from '../entities/dispute.entity';

export class CreateDisputeDto {
  @IsNotEmpty()
  @IsString()
  paymentId: string;

  @IsEnum(DisputeReason)
  reason: DisputeReason;

  @IsOptional()
  @IsString()
  reasonDescription?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  refundId?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
