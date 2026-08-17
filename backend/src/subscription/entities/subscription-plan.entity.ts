import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum BillingInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PlanStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  planId: string;

  @Column()
  merchantId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column()
  currency: string;

  @Column({
    type: 'enum',
    enum: BillingInterval,
  })
  billingInterval: BillingInterval;

  @Column({ nullable: true })
  trialPeriodDays: number;

  @Column({ nullable: true })
  gracePeriodDays: number;

  @Column({ default: 0 })
  lateFeePercentage: number;

  @Column({ default: 3 })
  maxRetryAttempts: number;

  @Column({ default: true })
  prorateOnUpgrade: boolean;

  @Column({ default: true })
  prorateOnDowngrade: boolean;

  @Column({
    type: 'enum',
    enum: PlanStatus,
    default: PlanStatus.ACTIVE,
  })
  status: PlanStatus;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column('jsonb', { nullable: true })
  features: string[];

  @Column('jsonb', { nullable: true })
  limits: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
