import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DunningStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  FAILED = 'FAILED',
  ESCALATED = 'ESCALATED',
}

export enum DunningAction {
  EMAIL_NOTIFICATION = 'EMAIL_NOTIFICATION',
  PAYMENT_RETRY = 'PAYMENT_RETRY',
  SUBSCRIPTION_PAUSE = 'SUBSCRIPTION_PAUSE',
  SUBSCRIPTION_CANCEL = 'SUBSCRIPTION_CANCEL',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
}

@Entity('dunning_records')
export class DunningRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  dunningId: string;

  @Column()
  subscriptionId: string;

  @Column()
  invoiceId: string;

  @Column()
  merchantId: string;

  @Column()
  customerId: string;

  @Column({
    type: 'enum',
    enum: DunningStatus,
    default: DunningStatus.PENDING,
  })
  status: DunningStatus;

  @Column({
    type: 'enum',
    enum: DunningAction,
  })
  action: DunningAction;

  @Column({ default: 1 })
  attemptNumber: number;

  @Column()
  scheduledAt: Date;

  @Column({ nullable: true })
  executedAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column('jsonb', { nullable: true })
  retryConfig: {
    maxAttempts: number;
    retryIntervalHours: number;
    escalateAfterAttempts: number;
  };

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
