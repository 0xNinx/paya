import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISABLED = 'DISABLED',
}

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  merchantId: string;

  @Column()
  url: string;

  @Column('simple-array')
  events: string[];

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @Column({ nullable: true })
  secret: string;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastFailureAt: Date;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 5000 })
  retryDelay: number; // milliseconds

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Index(['merchantId', 'status'])
@Index(['merchantId', 'events'])
