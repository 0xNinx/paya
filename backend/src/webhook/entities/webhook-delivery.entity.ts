import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WebhookEvent } from './webhook-event.entity';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD_LETTER = 'DEAD_LETTER',
}

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  deliveryId: string;

  @Column()
  eventId: string;

  @Column()
  webhookId: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column('jsonb')
  requestPayload: Record<string, any>;

  @Column('jsonb', { nullable: true })
  requestHeaders: Record<string, string>;

  @Column({ nullable: true })
  responseStatusCode: number;

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  attemptNumber: number;

  @Column({ default: 0 })
  responseTime: number;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => WebhookEvent)
  @JoinColumn({ name: 'eventId' })
  event: WebhookEvent;
}
