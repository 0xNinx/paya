import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SplitAuditAction {
  SPLIT_CREATED = 'SPLIT_CREATED',
  SPLIT_EXECUTED = 'SPLIT_EXECUTED',
  SPLIT_CANCELLED = 'SPLIT_CANCELLED',
  DISTRIBUTION_STARTED = 'DISTRIBUTION_STARTED',
  DISTRIBUTION_COMPLETED = 'DISTRIBUTION_COMPLETED',
  DISTRIBUTION_FAILED = 'DISTRIBUTION_FAILED',
  MILESTONE_TRIGGERED = 'MILESTONE_TRIGGERED',
  MILESTONE_COMPLETED = 'MILESTONE_COMPLETED',
  RETRY_INITIATED = 'RETRY_INITIATED',
  CONFIG_UPDATED = 'CONFIG_UPDATED',
}

@Entity('split_audit')
export class SplitAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  auditId: string;

  @Column()
  splitId: string;

  @Column({ nullable: true })
  distributionId: string;

  @Column({ nullable: true })
  milestoneId: string;

  @Column({
    type: 'enum',
    enum: SplitAuditAction,
  })
  action: SplitAuditAction;

  @Column()
  performedBy: string;

  @Column()
  performedByRole: string;

  @Column({ type: 'jsonb' })
  oldState: Record<string, any>;

  @Column({ type: 'jsonb' })
  newState: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
