import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  subscriptionId: string;

  @Column()
  merchantId: string;

  @Column()
  customerId: string;

  @Column()
  customerEmail: string;

  @Column()
  planId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column('decimal', { precision: 20, scale: 8 })
  currentAmount: number;

  @Column()
  currency: string;

  @Column({ nullable: true })
  trialStart: Date;

  @Column({ nullable: true })
  trialEnd: Date;

  @Column()
  currentPeriodStart: Date;

  @Column()
  currentPeriodEnd: Date;

  @Column({ nullable: true })
  cancelAtPeriodEnd: boolean;

  @Column({ nullable: true })
  cancelAt: Date;

  @Column({ nullable: true })
  canceledAt: Date;

  @Column({ nullable: true })
  pausedAt: Date;

  @Column({ nullable: true })
  resumeAt: Date;

  @Column({ default: 0 })
  billingCycleCount: number;

  @Column({ default: 0 })
  failedPaymentCount: number;

  @Column({ nullable: true })
  lastPaymentAt: Date;

  @Column({ nullable: true })
  nextPaymentAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column('jsonb', { nullable: true })
  customFields: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
