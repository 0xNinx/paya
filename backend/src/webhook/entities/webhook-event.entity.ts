import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Webhook } from './webhook.entity';

export enum EventType {
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_PAID = 'payment.paid',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_SPLIT_CREATED = 'payment.split.created',
  PAYMENT_SPLIT_COMPLETED = 'payment.split.completed',
  PAYMENT_SPLIT_FAILED = 'payment.split.failed',
  DISPUTE_CREATED = 'dispute.created',
  DISPUTE_RESOLVED = 'dispute.resolved',
  DISPUTE_CLOSED = 'dispute.closed',
  REFUND_REQUESTED = 'refund.requested',
  REFUND_PROCESSED = 'refund.processed',
  REFUND_FAILED = 'refund.failed',
  MERCHANT_CREATED = 'merchant.created',
  MERCHANT_UPDATED = 'merchant.updated',
  ACCOUNT_VERIFIED = 'account.verified',
}

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  eventId: string;

  @Column()
  webhookId: string;

  @Column({
    type: 'enum',
    enum: EventType,
  })
  eventType: EventType;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({ default: 'PENDING' })
  deliveryStatus: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ default: 0 })
  responseTime: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Webhook, (webhook) => webhook.eventsHistory)
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;
}
