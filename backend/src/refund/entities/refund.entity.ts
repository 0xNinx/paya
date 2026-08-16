import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum RefundReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  PRODUCT_NOT_RECEIVED = 'PRODUCT_NOT_RECEIVED',
  PRODUCT_DEFECTIVE = 'PRODUCT_DEFECTIVE',
  WRONG_ITEM = 'WRONG_ITEM',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  FRAUDULENT = 'FRAUDULENT',
  OTHER = 'OTHER',
}

export enum RefundType {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
}

@Entity('refunds')
@Index(['paymentId'])
@Index(['merchantId'])
@Index(['status'])
@Index(['createdAt'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  refundId: string;

  @Column()
  paymentId: string;

  @Column()
  merchantId: string;

  @Column()
  customerId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  originalAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  refundAmount: number;

  @Column({
    type: 'enum',
    enum: RefundType,
  })
  refundType: RefundType;

  @Column({
    type: 'enum',
    enum: RefundReason,
  })
  reason: RefundReason;

  @Column({ type: 'text', nullable: true })
  reasonDescription: string;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.PENDING,
  })
  status: RefundStatus;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  feeAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  netAmount: number;

  @Column({ type: 'text', nullable: true })
  transactionHash: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reversedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
