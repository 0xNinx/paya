import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SplitStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum SplitType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  MILESTONE = 'MILESTONE',
}

@Entity('payment_splits')
export class PaymentSplit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  splitId: string;

  @Column()
  paymentId: string;

  @Column()
  merchantAddress: string;

  @Column('decimal', { precision: 20, scale: 8 })
  totalAmount: number;

  @Column()
  currency: string;

  @Column({
    type: 'enum',
    enum: SplitType,
  })
  splitType: SplitType;

  @Column({
    type: 'enum',
    enum: SplitStatus,
    default: SplitStatus.PENDING,
  })
  status: SplitStatus;

  @Column('jsonb')
  recipients: Array<{
    address: string;
    percentage?: number;
    fixedAmount?: number;
    splitType: SplitType;
    distributedAmount: number;
    distributionStatus: SplitStatus;
  }>;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ nullable: true })
  executedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
