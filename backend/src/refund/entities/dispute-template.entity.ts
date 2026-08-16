import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TemplateType {
  EVIDENCE_REQUEST = 'EVIDENCE_REQUEST',
  DISPUTE_RESPONSE = 'DISPUTE_RESPONSE',
  CHARGEBACK_RESPONSE = 'CHARGEBACK_RESPONSE',
  REFUND_APPROVAL = 'REFUND_APPROVAL',
  REFUND_DENIAL = 'REFUND_DENIAL',
  STATUS_UPDATE = 'STATUS_UPDATE',
}

@Entity('dispute_response_templates')
export class DisputeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  templateId: string;

  @Column()
  merchantId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: TemplateType,
  })
  templateType: TemplateType;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'json', nullable: true })
  variables: string[]; // Array of variable names that can be substituted

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
