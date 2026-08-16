import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  TRANSACTION_PROOF = 'TRANSACTION_PROOF',
  DELIVERY_CONFIRMATION = 'DELIVERY_CONFIRMATION',
  COMMUNICATION = 'COMMUNICATION',
  OTHER = 'OTHER',
}

@Entity('dispute_evidence')
@Index(['disputeId'])
@Index(['uploadedBy'])
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  evidenceId: string;

  @Column()
  disputeId: string;

  @Column()
  uploadedBy: string;

  @Column()
  uploadedByRole: string; // 'merchant' or 'customer'

  @Column({
    type: 'enum',
    enum: EvidenceType,
  })
  evidenceType: EvidenceType;

  @Column()
  fileName: string;

  @Column()
  fileUrl: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'text', nullable: true })
  mimeType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
