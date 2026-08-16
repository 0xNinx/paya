import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  EVIDENCE_REQUIRED = 'EVIDENCE_REQUIRED',
  RESPONDING = 'RESPONDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  WON = 'WON',
  LOST = 'LOST',
}

export enum DisputeReason {
  PRODUCT_NOT_RECEIVED = 'PRODUCT_NOT_RECEIVED',
  PRODUCT_NOT_AS_DESCRIBED = 'PRODUCT_NOT_AS_DESCRIBED',
  UNAUTHORIZED_TRANSACTION = 'UNAUTHORIZED_TRANSACTION',
  DUPLICATE_CHARGE = 'DUPLICATE_CHARGE',
  CREDIT_NOT_PROCESSED = 'CREDIT_NOT_PROCESSED',
  OTHER = 'OTHER',
}

@Entity('disputes')
@Index(['paymentId'])
@Index(['merchantId'])
@Index(['status'])
@Index(['createdAt'])
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  disputeId: string;

  @Column()
  paymentId: string;

  @Column({ nullable: true })
  refundId: string;

  @Column()
  merchantId: string;

  @Column()
  customerId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  amount: number;

  @Column({
    type: 'enum',
    enum: DisputeReason,
  })
  reason: DisputeReason;

  @Column({ type: 'text', nullable: true })
  reasonDescription: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'int', default: 0 })
  evidenceCount: number;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  chargebackDeadline: Date;

  @Column({ type: 'boolean', default: false })
  isChargeback: boolean;

  @Column({ type: 'text', nullable: true })
  chargebackId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
