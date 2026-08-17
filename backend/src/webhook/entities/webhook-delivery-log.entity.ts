import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WebhookDelivery } from './webhook-delivery.entity';

@Entity('webhook_delivery_logs')
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deliveryId: string;

  @Column()
  webhookId: string;

  @Column()
  eventId: string;

  @Column()
  logType: string;

  @Column('text')
  message: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @Column({ nullable: true })
  statusCode: number;

  @Column({ default: 0 })
  responseTime: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => WebhookDelivery)
  @JoinColumn({ name: 'deliveryId' })
  delivery: WebhookDelivery;
}
