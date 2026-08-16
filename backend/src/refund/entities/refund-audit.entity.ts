import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  REFUND_CREATED = 'REFUND_CREATED',
  REFUND_APPROVED = 'REFUND_APPROVED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  REFUND_FAILED = 'REFUND_FAILED',
  REFUND_REVERSED = 'REFUND_REVERSED',
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_UPDATED = 'DISPUTE_UPDATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  EVIDENCE_UPLOADED = 'EVIDENCE_UPLOADED',
  POLICY_UPDATED = 'POLICY_UPDATED',
  FEE_CALCULATED = 'FEE_CALCULATED',
}

@Entity('refund_audit_trail')
@Index(['refundId'])
@Index(['disputeId'])
@Index(['action'])
@Index(['createdAt'])
export class RefundAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  auditId: string;

  @Column({ nullable: true })
  refundId: string;

  @Column({ nullable: true })
  disputeId: string;

  @Column()
  action: AuditAction;

  @Column()
  performedBy: string;

  @Column()
  performedByRole: string;

  @Column({ type: 'json', nullable: true })
  previousState: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  newState: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
