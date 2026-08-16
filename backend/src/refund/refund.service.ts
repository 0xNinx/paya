import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund, RefundStatus, RefundType } from './entities/refund.entity';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { RefundPolicy } from './entities/refund-policy.entity';
import { RefundAudit, AuditAction } from './entities/refund-audit.entity';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { Evidence } from './entities/evidence.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RefundService {
  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(RefundPolicy)
    private policyRepository: Repository<RefundPolicy>,
    @InjectRepository(RefundAudit)
    private auditRepository: Repository<RefundAudit>,
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
  ) {}

  async createRefund(
    createRefundDto: CreateRefundDto,
    merchantId: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<Refund> {
    const policy = await this.getMerchantPolicy(merchantId);
    const refundId = `REF_${uuidv4()}`;

    // Validate refund window
    if (createRefundDto.paymentDate) {
      const paymentDate = new Date(createRefundDto.paymentDate);
      const now = new Date();
      const daysSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSincePayment > policy.refundWindowDays) {
        throw new BadRequestException('Refund window has expired');
      }
    }

    // Calculate refund amount and fees
    const originalAmount = createRefundDto.partialAmount || 0; // Would fetch from payment service
    const refundAmount = createRefundDto.refundType === RefundType.FULL 
      ? originalAmount 
      : (createRefundDto.partialAmount || 0);

    const processingFee = Math.max(
      (refundAmount * policy.processingFeePercentage) / 100,
      policy.minimumFee,
    );
    const netAmount = refundAmount - processingFee;

    const refund = this.refundRepository.create({
      refundId,
      paymentId: createRefundDto.paymentId,
      merchantId,
      customerId: createRefundDto.customerId || 'unknown',
      originalAmount,
      refundAmount,
      refundType: createRefundDto.refundType,
      reason: createRefundDto.reason,
      reasonDescription: createRefundDto.reasonDescription,
      status: RefundStatus.PENDING,
      feeAmount: processingFee,
      netAmount,
      metadata: createRefundDto.metadata,
    });

    const savedRefund = await this.refundRepository.save(refund);

    // Create audit trail
    await this.createAudit({
      refundId: savedRefund.refundId,
      action: AuditAction.REFUND_CREATED,
      performedBy,
      performedByRole,
      newState: { ...savedRefund },
      notes: `Refund created for payment ${createRefundDto.paymentId}`,
    });

    // Auto-process if under threshold
    if (refundAmount <= policy.autoApproveThreshold && policy.autoProcess) {
      await this.processRefund(savedRefund.refundId, performedBy, performedByRole);
    }

    return savedRefund;
  }

  async processRefund(
    refundId: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<Refund> {
    const refund = await this.refundRepository.findOne({ where: { refundId } });
    
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException('Refund is not in pending state');
    }

    // Here you would integrate with Stellar blockchain to process the refund
    // For now, we'll simulate the transaction
    const transactionHash = `TX_${uuidv4()}`;

    refund.status = RefundStatus.PROCESSING;
    await this.refundRepository.save(refund);

    await this.createAudit({
      refundId: refund.refundId,
      action: AuditAction.REFUND_PROCESSED,
      performedBy,
      performedByRole,
      previousState: { status: RefundStatus.PENDING },
      newState: { status: RefundStatus.PROCESSING, transactionHash },
      notes: 'Refund submitted for processing',
    });

    // Simulate completion (in real implementation, this would be async)
    refund.status = RefundStatus.COMPLETED;
    refund.processedAt = new Date();
    refund.transactionHash = transactionHash;
    const savedRefund = await this.refundRepository.save(refund);

    await this.createAudit({
      refundId: refund.refundId,
      action: AuditAction.REFUND_APPROVED,
      performedBy,
      performedByRole,
      previousState: { status: RefundStatus.PROCESSING },
      newState: { status: RefundStatus.COMPLETED, processedAt: refund.processedAt },
      notes: 'Refund completed successfully',
    });

    return savedRefund;
  }

  async failRefund(
    refundId: string,
    failureReason: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<Refund> {
    const refund = await this.refundRepository.findOne({ where: { refundId } });
    
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    const previousStatus = refund.status;
    refund.status = RefundStatus.FAILED;
    refund.failureReason = failureReason;
    const savedRefund = await this.refundRepository.save(refund);

    await this.createAudit({
      refundId: refund.refundId,
      action: AuditAction.REFUND_FAILED,
      performedBy,
      performedByRole,
      previousState: { status: previousStatus },
      newState: { status: RefundStatus.FAILED, failureReason },
      notes: `Refund failed: ${failureReason}`,
    });

    return savedRefund;
  }

  async reverseRefund(
    refundId: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<Refund> {
    const refund = await this.refundRepository.findOne({ where: { refundId } });
    
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== RefundStatus.COMPLETED) {
      throw new BadRequestException('Only completed refunds can be reversed');
    }

    const previousStatus = refund.status;
    refund.status = RefundStatus.REVERSED;
    refund.reversedAt = new Date();
    const savedRefund = await this.refundRepository.save(refund);

    await this.createAudit({
      refundId: refund.refundId,
      action: AuditAction.REFUND_REVERSED,
      performedBy,
      performedByRole,
      previousState: { status: previousStatus },
      newState: { status: RefundStatus.REVERSED, reversedAt: refund.reversedAt },
      notes: 'Refund reversed',
    });

    return savedRefund;
  }

  async getRefund(refundId: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({ where: { refundId } });
    
    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  async getRefundsByMerchant(merchantId: string, filters: any): Promise<{ data: Refund[]; total: number }> {
    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .where('refund.merchantId = :merchantId', { merchantId });

    if (filters.status) {
      queryBuilder.andWhere('refund.status = :status', { status: filters.status });
    }

    if (filters.reason) {
      queryBuilder.andWhere('refund.reason = :reason', { reason: filters.reason });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('refund.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('refund.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    
    queryBuilder
      .orderBy('refund.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async createDispute(
    createDisputeDto: CreateDisputeDto,
    merchantId: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<Dispute> {
    const disputeId = `DSP_${uuidv4()}`;
    const policy = await this.getMerchantPolicy(merchantId);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + policy.disputeResponseDays);

    const dispute = this.disputeRepository.create({
      disputeId,
      paymentId: createDisputeDto.paymentId,
      refundId: createDisputeDto.refundId,
      merchantId,
      customerId: createDisputeDto.customerId || 'unknown',
      amount: createDisputeDto.amount || 0,
      reason: createDisputeDto.reason,
      reasonDescription: createDisputeDto.reasonDescription,
      status: DisputeStatus.OPEN,
      dueDate,
      metadata: createDisputeDto.metadata,
    });

    const savedDispute = await this.disputeRepository.save(dispute);

    await this.createAudit({
      disputeId: savedDispute.disputeId,
      action: AuditAction.DISPUTE_CREATED,
      performedBy,
      performedByRole,
      newState: { ...savedDispute },
      notes: `Dispute created for payment ${createDisputeDto.paymentId}`,
    });

    return savedDispute;
  }

  async updateDispute(
    disputeId: string,
    updateDisputeDto: UpdateDisputeDto,
    performedBy: string,
    performedByRole: string,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { disputeId } });
    
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const previousState = { ...dispute };

    if (updateDisputeDto.status) {
      dispute.status = updateDisputeDto.status;
      
      if (updateDisputeDto.status === DisputeStatus.RESOLVED || 
          updateDisputeDto.status === DisputeStatus.WON ||
          updateDisputeDto.status === DisputeStatus.LOST ||
          updateDisputeDto.status === DisputeStatus.CLOSED) {
        dispute.resolvedAt = new Date();
      }
    }

    if (updateDisputeDto.resolutionNotes) {
      dispute.resolutionNotes = updateDisputeDto.resolutionNotes;
    }

    if (updateDisputeDto.chargebackId) {
      dispute.chargebackId = updateDisputeDto.chargebackId;
    }

    if (updateDisputeDto.metadata) {
      dispute.metadata = { ...dispute.metadata, ...updateDisputeDto.metadata };
    }

    const savedDispute = await this.disputeRepository.save(dispute);

    await this.createAudit({
      disputeId: dispute.disputeId,
      action: AuditAction.DISPUTE_UPDATED,
      performedBy,
      performedByRole,
      previousState,
      newState: { ...savedDispute },
      notes: 'Dispute status updated',
    });

    return savedDispute;
  }

  async uploadEvidence(
    uploadEvidenceDto: UploadEvidenceDto,
    uploadedBy: string,
    uploadedByRole: string,
  ): Promise<Evidence> {
    const evidenceId = `EVD_${uuidv4()}`;

    const evidence = this.evidenceRepository.create({
      evidenceId,
      disputeId: uploadEvidenceDto.disputeId,
      uploadedBy,
      uploadedByRole,
      evidenceType: uploadEvidenceDto.evidenceType,
      fileName: uploadEvidenceDto.fileName,
      fileUrl: uploadEvidenceDto.fileUrl,
      fileSize: uploadEvidenceDto.fileSize,
      mimeType: uploadEvidenceDto.mimeType,
      description: uploadEvidenceDto.description,
      isPublic: uploadEvidenceDto.isPublic || false,
      metadata: uploadEvidenceDto.metadata,
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    // Update dispute evidence count
    const dispute = await this.disputeRepository.findOne({ 
      where: { disputeId: uploadEvidenceDto.disputeId } 
    });
    
    if (dispute) {
      dispute.evidenceCount += 1;
      await this.disputeRepository.save(dispute);
    }

    await this.createAudit({
      disputeId: uploadEvidenceDto.disputeId,
      action: AuditAction.EVIDENCE_UPLOADED,
      performedBy: uploadedBy,
      performedByRole: uploadedByRole,
      newState: { evidenceId: savedEvidence.evidenceId, fileName: savedEvidence.fileName },
      notes: `Evidence uploaded: ${savedEvidence.fileName}`,
    });

    return savedEvidence;
  }

  async getDispute(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({ where: { disputeId } });
    
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  async getDisputesByMerchant(merchantId: string, filters: any): Promise<{ data: Dispute[]; total: number }> {
    const queryBuilder = this.disputeRepository.createQueryBuilder('dispute')
      .where('dispute.merchantId = :merchantId', { merchantId });

    if (filters.status) {
      queryBuilder.andWhere('dispute.status = :status', { status: filters.status });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('dispute.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('dispute.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    
    queryBuilder
      .orderBy('dispute.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async getDisputeEvidence(disputeId: string): Promise<Evidence[]> {
    return this.evidenceRepository.find({ where: { disputeId } });
  }

  async getRefundAnalytics(merchantId: string, startDate: Date, endDate: Date) {
    const refunds = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.merchantId = :merchantId', { merchantId })
      .andWhere('refund.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const totalRefunds = refunds.length;
    const totalRefundAmount = refunds.reduce((sum, r) => sum + Number(r.refundAmount), 0);
    const totalFees = refunds.reduce((sum, r) => sum + Number(r.feeAmount), 0);
    
    const statusBreakdown = refunds.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const reasonBreakdown = refunds.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRefunds,
      totalRefundAmount,
      totalFees,
      statusBreakdown,
      reasonBreakdown,
      averageRefundAmount: totalRefunds > 0 ? totalRefundAmount / totalRefunds : 0,
    };
  }

  async getDisputeAnalytics(merchantId: string, startDate: Date, endDate: Date) {
    const disputes = await this.disputeRepository
      .createQueryBuilder('dispute')
      .where('dispute.merchantId = :merchantId', { merchantId })
      .andWhere('dispute.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const totalDisputes = disputes.length;
    const totalDisputedAmount = disputes.reduce((sum, d) => sum + Number(d.amount), 0);
    
    const statusBreakdown = disputes.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const wonDisputes = disputes.filter(d => d.status === DisputeStatus.WON).length;
    const lostDisputes = disputes.filter(d => d.status === DisputeStatus.LOST).length;
    const winRate = totalDisputes > 0 ? (wonDisputes / totalDisputes) * 100 : 0;

    return {
      totalDisputes,
      totalDisputedAmount,
      statusBreakdown,
      wonDisputes,
      lostDisputes,
      winRate,
    };
  }

  private async getMerchantPolicy(merchantId: string): Promise<RefundPolicy> {
    let policy = await this.policyRepository.findOne({ 
      where: { merchantId, isActive: true } 
    });

    if (!policy) {
      // Create default policy
      policy = this.policyRepository.create({
        policyId: `POL_${uuidv4()}`,
        merchantId,
        refundWindowDays: 30,
        processingFeePercentage: 5,
        minimumFee: 0,
        autoApproveThreshold: 100,
        disputeResponseDays: 14,
        chargebackResponseDays: 90,
        requireApproval: false,
        autoProcess: true,
        isActive: true,
      });
      policy = await this.policyRepository.save(policy);
    }

    return policy;
  }

  private async createAudit(auditData: {
    refundId?: string;
    disputeId?: string;
    action: AuditAction;
    performedBy: string;
    performedByRole: string;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    const audit = this.auditRepository.create({
      auditId: `AUD_${uuidv4()}`,
      ...auditData,
    });
    return this.auditRepository.save(audit);
  }

  async getAuditTrail(refundId?: string, disputeId?: string): Promise<RefundAudit[]> {
    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    if (refundId) {
      queryBuilder.andWhere('audit.refundId = :refundId', { refundId });
    }

    if (disputeId) {
      queryBuilder.andWhere('audit.disputeId = :disputeId', { disputeId });
    }

    return queryBuilder.orderBy('audit.createdAt', 'ASC').getMany();
  }
}
