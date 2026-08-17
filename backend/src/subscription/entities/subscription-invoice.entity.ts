import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  VOID = 'VOID',
  REFUNDED = 'REFUNDED',
}

export enum InvoiceType {
  RECURRING = 'RECURRING',
  PRORATION = 'PRORATION',
  USAGE_BASED = 'USAGE_BASED',
  ONE_TIME = 'ONE_TIME',
}

@Entity('subscription_invoices')
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceId: string;

  @Column()
  subscriptionId: string;

  @Column()
  merchantId: string;

  @Column()
  customerId: string;

  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({
    type: 'enum',
    enum: InvoiceType,
    default: InvoiceType.RECURRING,
  })
  type: InvoiceType;

  @Column('decimal', { precision: 20, scale: 8 })
  subtotal: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 20, scale: 8 })
  total: number;

  @Column()
  currency: string;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  failedAt: Date;

  @Column({ nullable: true })
  voidedAt: Date;

  @Column({ nullable: true })
  refundedAt: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  paymentMethodId: string;

  @Column({ nullable: true })
  transactionHash: string;

  @Column('jsonb')
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    periodStart?: Date;
    periodEnd?: Date;
  }>;

  @Column('jsonb', { nullable: true })
  prorationDetails: {
    previousPlanId?: string;
    newPlanId?: string;
    prorationRatio: number;
    proratedAmount: number;
  };

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
