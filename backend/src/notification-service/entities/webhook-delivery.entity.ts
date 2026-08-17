import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookId: string;

  @Column()
  merchantId: string;

  @Column()
  eventType: string;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ nullable: true })
  responseTime: number; // milliseconds

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  attemptNumber: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column('jsonb', { nullable: true })
  headers: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;
}

@Index(['webhookId', 'status'])
@Index(['merchantId', 'eventType'])
@Index(['status', 'nextRetryAt'])
