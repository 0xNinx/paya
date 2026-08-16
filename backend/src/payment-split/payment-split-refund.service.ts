import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentSplit, SplitStatus } from './entities/payment-split.entity';
import { SplitDistribution } from './entities/split-distribution.entity';
import { SplitAudit, SplitAuditAction } from './entities/split-audit.entity';

@Injectable()
export class PaymentSplitRefundService {
  private readonly logger = new Logger(PaymentSplitRefundService.name);

  constructor(
    @InjectRepository(PaymentSplit)
    private splitRepository: Repository<PaymentSplit>,
    @InjectRepository(SplitDistribution)
    private distributionRepository: Repository<SplitDistribution>,
    @InjectRepository(SplitAudit)
    private auditRepository: Repository<SplitAudit>,
  ) {}

  async handlePartialPayment(
    splitId: string,
    partialAmount: number,
    performedBy: string,
    performedByRole: string,
  ): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    if (split.status !== SplitStatus.PENDING) {
      throw new BadRequestException('Can only handle partial payments for pending splits');
    }

    if (partialAmount <= 0 || partialAmount > split.totalAmount) {
      throw new BadRequestException('Invalid partial amount');
    }

    // Adjust recipients' amounts proportionally for percentage-based splits
    if (split.splitType === 'PERCENTAGE') {
      for (const recipient of split.recipients) {
        const proportionalAmount = (partialAmount * recipient.percentage) / 100;
        recipient.fixedAmount = proportionalAmount;
      }
    }

    split.totalAmount = partialAmount;
    split.metadata = { ...split.metadata, isPartialPayment: true, originalAmount: split.totalAmount };

    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      action: SplitAuditAction.SPLIT_CREATED,
      performedBy,
      performedByRole,
      oldState: { totalAmount: split.totalAmount },
      newState: { totalAmount: partialAmount, isPartialPayment: true },
      notes: `Partial payment of ${partialAmount} processed`,
    });

    this.logger.log(`Handled partial payment of ${partialAmount} for split ${splitId}`);
    return updatedSplit;
  }

  async refundSplit(
    splitId: string,
    refundAmount: number,
    reason: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    if (split.status === SplitStatus.CANCELLED) {
      throw new BadRequestException('Cannot refund a cancelled split');
    }

    if (split.status === SplitStatus.COMPLETED) {
      // For completed splits, we need to handle refunds differently
      return this.refundCompletedSplit(split, refundAmount, reason, performedBy, performedByRole);
    }

    // For pending or partially completed splits, cancel and refund
    const oldStatus = split.status;
    split.status = SplitStatus.CANCELLED;
    split.metadata = { 
      ...split.metadata, 
      refundAmount, 
      refundReason: reason, 
      refundedAt: new Date().toISOString(),
    };

    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      action: SplitAuditAction.SPLIT_CANCELLED,
      performedBy,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: split.status, refundAmount, reason },
      notes: `Split refunded: ${reason}`,
    });

    this.logger.log(`Refunded split ${splitId} with amount ${refundAmount}`);
    return updatedSplit;
  }

  async refundCompletedSplit(
    split: PaymentSplit,
    refundAmount: number,
    reason: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<PaymentSplit> {
    // For completed splits, we need to claw back funds from recipients
    // This is a complex operation that may require legal action
    // For now, we'll mark it as needing manual processing

    const distributions = await this.distributionRepository.find({ 
      where: { splitId: split.splitId } 
    });

    const refundDistributions: any[] = [];

    for (const distribution of distributions) {
      if (distribution.status === SplitStatus.COMPLETED) {
        // Calculate proportional refund amount
        const proportionalRefund = (refundAmount * distribution.amount) / split.totalAmount;
        
        refundDistributions.push({
          distributionId: distribution.distributionId,
          recipientAddress: distribution.recipientAddress,
          originalAmount: distribution.amount,
          refundAmount: proportionalRefund,
          status: 'PENDING_CLAWBACK',
        });
      }
    }

    split.metadata = {
      ...split.metadata,
      refundAmount,
      refundReason: reason,
      refundDistributions,
      refundStatus: 'PENDING_MANUAL_PROCESSING',
      refundedAt: new Date().toISOString(),
    };

    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: split.splitId,
      action: SplitAuditAction.SPLIT_CANCELLED,
      performedBy,
      performedByRole,
      oldState: { status: split.status },
      newState: { refundAmount, reason, refundDistributions },
      notes: `Refund initiated for completed split - requires manual clawback processing`,
    });

    this.logger.warn(`Refund initiated for completed split ${split.splitId} - requires manual clawback`);
    return updatedSplit;
  }

  async refundSpecificDistribution(
    distributionId: string,
    refundAmount: number,
    reason: string,
    performedBy: string,
    performedByRole: string,
  ): Promise<SplitDistribution> {
    const distribution = await this.distributionRepository.findOne({ 
      where: { distributionId },
    });
    
    if (!distribution) {
      throw new NotFoundException(`Distribution ${distributionId} not found`);
    }

    if (distribution.status !== SplitStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed distributions');
    }

    if (refundAmount > distribution.amount) {
      throw new BadRequestException('Refund amount cannot exceed distribution amount');
    }

    const oldStatus = distribution.status;
    distribution.status = SplitStatus.FAILED;
    distribution.errorMessage = `Refunded: ${reason}`;
    distribution.metadata = {
      ...distribution.metadata,
      refundAmount,
      refundReason: reason,
      refundedAt: new Date().toISOString(),
    };

    const updatedDistribution = await this.distributionRepository.save(distribution);

    // Update split status
    const split = await this.splitRepository.findOne({ where: { splitId: distribution.splitId } });
    if (split) {
      const anyFailed = split.recipients.some(r => r.distributionStatus === SplitStatus.FAILED);
      if (anyFailed) {
        split.status = SplitStatus.PARTIALLY_COMPLETED;
        await this.splitRepository.save(split);
      }
    }

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: distribution.splitId,
      distributionId,
      action: SplitAuditAction.DISTRIBUTION_FAILED,
      performedBy,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: distribution.status, refundAmount, reason },
      notes: `Distribution refunded: ${reason}`,
    });

    this.logger.log(`Refunded distribution ${distributionId} with amount ${refundAmount}`);
    return updatedDistribution;
  }

  async calculateRefundAmounts(splitId: string): Promise<{
    totalRefundable: number;
    recipientRefunds: Array<{
      recipientAddress: string;
      originalAmount: number;
      refundableAmount: number;
      distributionStatus: SplitStatus;
    }>;
  }> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    const distributions = await this.distributionRepository.find({ 
      where: { splitId } 
    });

    let totalRefundable = 0;
    const recipientRefunds: any[] = [];

    for (const distribution of distributions) {
      if (distribution.status === SplitStatus.COMPLETED) {
        totalRefundable += distribution.amount;
        recipientRefunds.push({
          recipientAddress: distribution.recipientAddress,
          originalAmount: distribution.amount,
          refundableAmount: distribution.amount,
          distributionStatus: distribution.status,
        });
      } else if (distribution.status === SplitStatus.EXECUTING) {
        // Partially distributed - refund the amount that hasn't been confirmed
        recipientRefunds.push({
          recipientAddress: distribution.recipientAddress,
          originalAmount: distribution.amount,
          refundableAmount: 0, // Can't refund unconfirmed transactions
          distributionStatus: distribution.status,
        });
      }
    }

    return {
      totalRefundable,
      recipientRefunds,
    };
  }

  async getRefundHistory(splitId: string): Promise<SplitAudit[]> {
    return this.auditRepository.find({ 
      where: { splitId },
      order: { createdAt: 'DESC' },
    });
  }
}
