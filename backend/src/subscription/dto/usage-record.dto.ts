import { IsString, IsNumber } from 'class-validator';

export class CreateUsageRecordDto {
  @IsString()
  subscriptionId: string;

  @IsString()
  metricId: string;

  @IsString()
  metricName: string;

  @IsString()
  metricUnit: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsString()
  currency: string;

  @IsString()
  periodStart: string;

  @IsString()
  periodEnd: string;

  metadata?: Record<string, any>;
}
