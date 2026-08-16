import { IsString, IsNumber, IsEnum, IsArray, ValidateNested, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { SplitType } from '../entities/payment-split.entity';

class RecipientDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @IsOptional()
  percentage?: number;

  @IsNumber()
  @IsOptional()
  fixedAmount?: number;

  @IsEnum(SplitType)
  splitType: SplitType;
}

class MilestoneDto {
  @IsString()
  @IsNotEmpty()
  milestoneId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  triggerCondition: string;

  @IsNumber()
  @IsNotEmpty()
  requiredAmount: number;
}

export class CreateSplitDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  merchantAddress: string;

  @IsNumber()
  @IsNotEmpty()
  totalAmount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsEnum(SplitType)
  splitType: SplitType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  @IsOptional()
  milestones?: MilestoneDto[];

  @IsOptional()
  metadata?: Record<string, any>;
}
