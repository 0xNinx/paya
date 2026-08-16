import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MilestoneStatus {
  PENDING = 'PENDING',
  TRIGGERED = 'TRIGGERED',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

@Entity('split_milestones')
export class SplitMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  milestoneId: string;

  @Column()
  splitId: string;

  @Column()
  description: string;

  @Column()
  triggerCondition: string;

  @Column('decimal', { precision: 20, scale: 8 })
  requiredAmount: number;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  @Column({ nullable: true })
  triggeredAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  triggeredBy: string;

  @Column({ nullable: true })
  completedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
