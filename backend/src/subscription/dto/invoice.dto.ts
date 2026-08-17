import { IsString, IsOptional, IsEnum } from 'class-validator';
import { InvoiceStatus } from '../entities/subscription-invoice.entity';

export class CreateInvoiceDto {
  @IsString()
  subscriptionId: string;

  @IsString()
  customerId: string;

  @IsString()
  planId: string;

  @IsString()
  currency: string;

  @IsOptional()
  paymentMethodId?: string;

  @IsOptional()
  dueDate?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class RetryInvoicePaymentDto {
  @IsString()
  invoiceId: string;

  @IsOptional()
  paymentMethodId?: string;
}

export class VoidInvoiceDto {
  @IsString()
  invoiceId: string;

  @IsOptional()
  reason?: string;
}
