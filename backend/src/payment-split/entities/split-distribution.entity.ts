import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SplitStatus } from './payment-split.entity';

@Entity('split_distributions')
export class SplitDistribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  distributionId: string;

  @Column()
  splitId: string;

  @Column()
  recipientAddress: string;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column({ nullable: true })
  transactionHash: string;

  @Column({
    type: 'enum',
    enum: SplitStatus,
    default: SplitStatus.PENDING,
  })
  status: SplitStatus;

  @Column({ nullable: true })
  attemptedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
