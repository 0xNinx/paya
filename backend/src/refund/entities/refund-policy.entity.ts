import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('refund_policies')
export class RefundPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  policyId: string;

  @Column()
  merchantId: string;

  @Column({ type: 'int', default: 30 })
  refundWindowDays: number;

  @Column({ type: 'int', default: 5 })
  processingFeePercentage: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  minimumFee: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  autoApproveThreshold: number;

  @Column({ type: 'int', default: 14 })
  disputeResponseDays: number;

  @Column({ type: 'int', default: 90 })
  chargebackResponseDays: number;

  @Column({ type: 'boolean', default: false })
  requireApproval: boolean;

  @Column({ type: 'boolean', default: true })
  autoProcess: boolean;

  @Column({ type: 'json', nullable: true })
  customRules: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
