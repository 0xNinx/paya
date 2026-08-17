import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { WebhookEvent } from './webhook-event.entity';

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISABLED = 'DISABLED',
}

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  webhookId: string;

  @Column()
  merchantId: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.INACTIVE,
  })
  status: WebhookStatus;

  @Column('simple-array')
  events: string[];

  @Column({ nullable: true })
  secret: string;

  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  payloadTemplate: Record<string, any>;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 300 })
  timeout: number;

  @Column({ type: 'simple-array', nullable: true })
  allowedIps: string[];

  @Column({ default: 0 })
  rateLimitPerMinute: number;

  @Column({ default: false })
  testMode: boolean;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ nullable: true })
  lastSuccessAt: Date;

  @Column({ nullable: true })
  lastFailureAt: Date;

  @Column({ nullable: true })
  lastTriggeredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => WebhookEvent, (event) => event.webhook)
  eventsHistory: WebhookEvent[];
}
