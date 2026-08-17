import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('subscription_usage')
@Index(['subscriptionId', 'periodStart', 'periodEnd'])
@Index(['subscriptionId', 'metricId'])
export class SubscriptionUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subscriptionId: string;

  @Column()
  metricId: string;

  @Column()
  metricName: string;

  @Column()
  metricUnit: string;

  @Column('decimal', { precision: 20, scale: 8 })
  quantity: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  unitPrice: number;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column()
  currency: string;

  @Column()
  periodStart: Date;

  @Column()
  periodEnd: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
