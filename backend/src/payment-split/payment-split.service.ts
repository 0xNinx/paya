import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PaymentSplit, SplitStatus, SplitType } from './entities/payment-split.entity';
import { SplitDistribution } from './entities/split-distribution.entity';
import { SplitMilestone, MilestoneStatus } from './entities/split-milestone.entity';
import { SplitAudit, SplitAuditAction } from './entities/split-audit.entity';
import { CreateSplitDto } from './dto/create-split.dto';
import { ExecuteSplitDto } from './dto/execute-split.dto';
import { DistributeRecipientDto } from './dto/distribute-recipient.dto';
import { TriggerMilestoneDto } from './dto/trigger-milestone.dto';

@Injectable()
export class PaymentSplitService {
  private readonly logger = new Logger(PaymentSplitService.name);

  constructor(
    @InjectRepository(PaymentSplit)
    private splitRepository: Repository<PaymentSplit>,
    @InjectRepository(SplitDistribution)
    private distributionRepository: Repository<SplitDistribution>,
    @InjectRepository(SplitMilestone)
    private milestoneRepository: Repository<SplitMilestone>,
    @InjectRepository(SplitAudit)
    private auditRepository: Repository<SplitAudit>,
  ) {}

  async createSplit(
    createSplitDto: CreateSplitDto,
    performedBy: string,
    performedByRole: string,
  ): Promise<PaymentSplit> {
    // Validate split percentages
    this.validateRecipients(createSplitDto.recipients, createSplitDto.splitType);

    const splitId = `SPLIT_${uuidv4()}`;
    
    const split = this.splitRepository.create({
      id: uuidv4(),
      splitId,
      paymentId: createSplitDto.paymentId,
      merchantAddress: createSplitDto.merchantAddress,
      totalAmount: createSplitDto.totalAmount,
      currency: createSplitDto.currency,
      splitType: createSplitDto.splitType,
      status: SplitStatus.PENDING,
      recipients: createSplitDto.recipients.map(r => ({
        ...r,
        distributedAmount: 0,
        distributionStatus: SplitStatus.PENDING,
      })),
      retryCount: 0,
      maxRetries: 3,
      metadata: createSplitDto.metadata,
    });

    const savedSplit = await this.splitRepository.save(split);

    // Create milestones if provided
    if (createSplitDto.milestones && createSplitDto.milestones.length > 0) {
      for (const milestone of createSplitDto.milestones) {
        const milestoneEntity = this.milestoneRepository.create({
          id: uuidv4(),
          milestoneId: milestone.milestoneId,
          splitId: splitId,
          description: milestone.description,
          triggerCondition: milestone.triggerCondition,
          requiredAmount: milestone.requiredAmount,
          status: MilestoneStatus.PENDING,
        });
        await this.milestoneRepository.save(milestoneEntity);
      }
    }

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      action: SplitAuditAction.SPLIT_CREATED,
      performedBy,
      performedByRole,
      oldState: {},
      newState: { split: savedSplit },
      notes: 'Payment split created',
    });

    this.logger.log(`Created payment split ${splitId} for payment ${createSplitDto.paymentId}`);
    return savedSplit;
  }

  async executeSplit(executeSplitDto: ExecuteSplitDto, performedBy: string, performedByRole: string): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ where: { splitId: executeSplitDto.splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${executeSplitDto.splitId} not found`);
    }

    if (split.status !== SplitStatus.PENDING) {
      throw new BadRequestException(`Split is not in PENDING status. Current status: ${split.status}`);
    }

    if (split.merchantAddress !== executeSplitDto.executor) {
      throw new BadRequestException('Only merchant can execute the split');
    }

    const oldStatus = split.status;
    split.status = SplitStatus.EXECUTING;
    split.executedAt = new Date();
    
    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: split.splitId,
      action: SplitAuditAction.SPLIT_EXECUTED,
      performedBy,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: split.status, executedAt: split.executedAt },
      notes: 'Split execution started',
    });

    this.logger.log(`Executed payment split ${split.splitId}`);
    return updatedSplit;
  }

  async distributeToRecipient(
    distributeDto: DistributeRecipientDto,
    performedBy: string,
    performedByRole: string,
  ): Promise<SplitDistribution> {
    const split = await this.splitRepository.findOne({ where: { splitId: distributeDto.splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${distributeDto.splitId} not found`);
    }

    if (split.status !== SplitStatus.EXECUTING) {
      throw new BadRequestException(`Split is not in EXECUTING status. Current status: ${split.status}`);
    }

    // Validate recipient exists in split
    const recipient = split.recipients.find(r => r.address === distributeDto.recipientAddress);
    if (!recipient) {
      throw new BadRequestException('Recipient not found in split');
    }

    const distribution = this.distributionRepository.create({
      id: uuidv4(),
      distributionId: distributeDto.distributionId,
      splitId: distributeDto.splitId,
      recipientAddress: distributeDto.recipientAddress,
      amount: distributeDto.amount,
      status: SplitStatus.EXECUTING,
      attemptedAt: new Date(),
      retryCount: 0,
    });

    const savedDistribution = await this.distributionRepository.save(distribution);

    // Update recipient distributed amount
    recipient.distributedAmount += distributeDto.amount;
    recipient.distributionStatus = SplitStatus.EXECUTING;
    await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: distributeDto.splitId,
      distributionId: distributeDto.distributionId,
      action: SplitAuditAction.DISTRIBUTION_STARTED,
      performedBy,
      performedByRole,
      oldState: {},
      newState: { distribution: savedDistribution },
      notes: `Distribution started to ${distributeDto.recipientAddress}`,
    });

    this.logger.log(`Started distribution ${distributeDto.distributionId} to ${distributeDto.recipientAddress}`);
    return savedDistribution;
  }

  async confirmDistribution(distributionId: string, transactionHash: string): Promise<SplitDistribution> {
    const distribution = await this.distributionRepository.findOne({ where: { distributionId } });
    
    if (!distribution) {
      throw new NotFoundException(`Distribution ${distributionId} not found`);
    }

    const oldStatus = distribution.status;
    distribution.status = SplitStatus.COMPLETED;
    distribution.transactionHash = transactionHash;
    distribution.completedAt = new Date();
    
    const updatedDistribution = await this.distributionRepository.save(distribution);

    // Update split recipient status
    const split = await this.splitRepository.findOne({ where: { splitId: distribution.splitId } });
    if (split) {
      const recipient = split.recipients.find(r => r.address === distribution.recipientAddress);
      if (recipient) {
        recipient.distributionStatus = SplitStatus.COMPLETED;
      }
      
      // Check if all distributions are complete
      await this.updateSplitCompletionStatus(split);
    }

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: distribution.splitId,
      distributionId,
      action: SplitAuditAction.DISTRIBUTION_COMPLETED,
      performedBy: 'system',
      performedByRole: 'payment_processor',
      oldState: { status: oldStatus },
      newState: { status: distribution.status, transactionHash },
      notes: 'Distribution confirmed on blockchain',
    });

    this.logger.log(`Confirmed distribution ${distributionId} with transaction ${transactionHash}`);
    return updatedDistribution;
  }

  async failDistribution(distributionId: string, errorMessage: string): Promise<SplitDistribution> {
    const distribution = await this.distributionRepository.findOne({ where: { distributionId } });
    
    if (!distribution) {
      throw new NotFoundException(`Distribution ${distributionId} not found`);
    }

    const oldStatus = distribution.status;
    distribution.status = SplitStatus.FAILED;
    distribution.errorMessage = errorMessage;
    distribution.retryCount += 1;
    
    const updatedDistribution = await this.distributionRepository.save(distribution);

    // Update split status and retry count
    const split = await this.splitRepository.findOne({ where: { splitId: distribution.splitId } });
    if (split) {
      const recipient = split.recipients.find(r => r.address === distribution.recipientAddress);
      if (recipient) {
        recipient.distributionStatus = SplitStatus.FAILED;
      }
      
      split.retryCount += 1;
      
      if (split.retryCount >= split.maxRetries) {
        split.status = SplitStatus.FAILED;
      } else {
        split.status = SplitStatus.PARTIALLY_COMPLETED;
      }
      
      await this.splitRepository.save(split);
    }

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: distribution.splitId,
      distributionId,
      action: SplitAuditAction.DISTRIBUTION_FAILED,
      performedBy: 'system',
      performedByRole: 'payment_processor',
      oldState: { status: oldStatus },
      newState: { status: distribution.status, errorMessage, retryCount: distribution.retryCount },
      notes: `Distribution failed: ${errorMessage}`,
    });

    this.logger.error(`Distribution ${distributionId} failed: ${errorMessage}`);
    return updatedDistribution;
  }

  async triggerMilestone(triggerMilestoneDto: TriggerMilestoneDto, performedBy: string, performedByRole: string): Promise<SplitMilestone> {
    const split = await this.splitRepository.findOne({ where: { splitId: triggerMilestoneDto.splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${triggerMilestoneDto.splitId} not found`);
    }

    if (split.merchantAddress !== triggerMilestoneDto.triggerer) {
      throw new BadRequestException('Only merchant can trigger milestones');
    }

    const milestone = await this.milestoneRepository.findOne({ 
      where: { splitId: triggerMilestoneDto.splitId, milestoneId: triggerMilestoneDto.milestoneId } 
    });
    
    if (!milestone) {
      throw new NotFoundException(`Milestone ${triggerMilestoneDto.milestoneId} not found`);
    }

    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException(`Milestone is not in PENDING status. Current status: ${milestone.status}`);
    }

    const oldStatus = milestone.status;
    milestone.status = MilestoneStatus.TRIGGERED;
    milestone.triggeredAt = new Date();
    milestone.triggeredBy = triggerMilestoneDto.triggerer;
    
    const updatedMilestone = await this.milestoneRepository.save(milestone);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId: triggerMilestoneDto.splitId,
      milestoneId: triggerMilestoneDto.milestoneId,
      action: SplitAuditAction.MILESTONE_TRIGGERED,
      performedBy,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: milestone.status, triggeredAt: milestone.triggeredAt },
      notes: `Milestone triggered: ${milestone.description}`,
    });

    this.logger.log(`Triggered milestone ${triggerMilestoneDto.milestoneId} for split ${triggerMilestoneDto.splitId}`);
    return updatedMilestone;
  }

  async completeMilestone(splitId: string, milestoneId: string, performedBy: string, performedByRole: string): Promise<SplitMilestone> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    if (split.merchantAddress !== performedBy) {
      throw new BadRequestException('Only merchant can complete milestones');
    }

    const milestone = await this.milestoneRepository.findOne({ 
      where: { splitId, milestoneId } 
    });
    
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    if (milestone.status !== MilestoneStatus.TRIGGERED) {
      throw new BadRequestException(`Milestone is not in TRIGGERED status. Current status: ${milestone.status}`);
    }

    const oldStatus = milestone.status;
    milestone.status = MilestoneStatus.COMPLETED;
    milestone.completedAt = new Date();
    milestone.completedBy = performedBy;
    
    const updatedMilestone = await this.milestoneRepository.save(milestone);

    // Check if all milestones are completed
    const milestones = await this.milestoneRepository.find({ where: { splitId } });
    const allCompleted = milestones.every(m => m.status === MilestoneStatus.COMPLETED);
    
    if (allCompleted) {
      split.status = SplitStatus.COMPLETED;
      split.completedAt = new Date();
      await this.splitRepository.save(split);
    }

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      milestoneId,
      action: SplitAuditAction.MILESTONE_COMPLETED,
      performedBy,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: milestone.status, completedAt: milestone.completedAt },
      notes: `Milestone completed: ${milestone.description}`,
    });

    this.logger.log(`Completed milestone ${milestoneId} for split ${splitId}`);
    return updatedMilestone;
  }

  async cancelSplit(splitId: string, canceller: string, performedByRole: string): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    if (split.merchantAddress !== canceller) {
      throw new BadRequestException('Only merchant can cancel the split');
    }

    if (split.status === SplitStatus.COMPLETED || split.status === SplitStatus.EXECUTING) {
      throw new BadRequestException('Cannot cancel split in current status');
    }

    const oldStatus = split.status;
    split.status = SplitStatus.CANCELLED;
    
    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      action: SplitAuditAction.SPLIT_CANCELLED,
      performedBy: canceller,
      performedByRole,
      oldState: { status: oldStatus },
      newState: { status: split.status },
      notes: 'Split cancelled by merchant',
    });

    this.logger.log(`Cancelled split ${splitId}`);
    return updatedSplit;
  }

  async retryFailedDistributions(splitId: string, retryer: string, performedByRole: string): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }

    if (split.merchantAddress !== retryer) {
      throw new BadRequestException('Only merchant can retry distributions');
    }

    if (split.retryCount >= split.maxRetries) {
      throw new BadRequestException('Max retries exceeded');
    }

    split.retryCount += 1;
    split.status = SplitStatus.EXECUTING;

    // Reset failed recipients to pending
    for (const recipient of split.recipients) {
      if (recipient.distributionStatus === SplitStatus.FAILED) {
        recipient.distributionStatus = SplitStatus.PENDING;
      }
    }
    
    const updatedSplit = await this.splitRepository.save(split);

    // Create audit entry
    await this.auditRepository.save({
      auditId: `AUDIT_${uuidv4()}`,
      splitId,
      action: SplitAuditAction.RETRY_INITIATED,
      performedBy: retryer,
      performedByRole,
      oldState: { retryCount: split.retryCount - 1 },
      newState: { retryCount: split.retryCount, status: split.status },
      notes: 'Retry initiated for failed distributions',
    });

    this.logger.log(`Initiated retry for split ${splitId}`);
    return updatedSplit;
  }

  async getSplit(splitId: string): Promise<PaymentSplit> {
    const split = await this.splitRepository.findOne({ 
      where: { splitId },
      relations: ['distributions', 'milestones'],
    });
    
    if (!split) {
      throw new NotFoundException(`Split ${splitId} not found`);
    }
    
    return split;
  }

  async getSplitAudit(splitId: string): Promise<SplitAudit[]> {
    return this.auditRepository.find({ 
      where: { splitId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSplitAnalytics(startDate: Date, endDate: Date): Promise<{
    totalSplits: number;
    completedSplits: number;
    failedSplits: number;
    totalAmount: number;
    averageSplitAmount: number;
    statusBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
  }> {
    const splits = await this.splitRepository
      .createQueryBuilder('split')
      .where('split.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const completedSplits = splits.filter(s => s.status === SplitStatus.COMPLETED);
    const failedSplits = splits.filter(s => s.status === SplitStatus.FAILED);
    const totalAmount = splits.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const statusBreakdown = splits.reduce((acc, split) => {
      acc[split.status] = (acc[split.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeBreakdown = splits.reduce((acc, split) => {
      acc[split.splitType] = (acc[split.splitType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSplits: splits.length,
      completedSplits: completedSplits.length,
      failedSplits: failedSplits.length,
      totalAmount,
      averageSplitAmount: splits.length > 0 ? totalAmount / splits.length : 0,
      statusBreakdown,
      typeBreakdown,
    };
  }

  private validateRecipients(recipients: any[], splitType: SplitType): void {
    if (recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    if (recipients.length > 50) {
      throw new BadRequestException('Maximum 50 recipients allowed');
    }

    switch (splitType) {
      case SplitType.PERCENTAGE:
        let totalPercentage = 0;
        for (const recipient of recipients) {
          if (recipient.percentage < 1 || recipient.percentage > 100) {
            throw new BadRequestException('Percentage must be between 1 and 100');
          }
          totalPercentage += recipient.percentage;
        }
        if (totalPercentage !== 100) {
          throw new BadRequestException('Percentages must sum to 100');
        }
        break;

      case SplitType.FIXED_AMOUNT:
        let totalFixed = 0;
        for (const recipient of recipients) {
          if (recipient.fixedAmount <= 0) {
            throw new BadRequestException('Fixed amount must be greater than 0');
          }
          totalFixed += recipient.fixedAmount;
        }
        break;

      case SplitType.MILESTONE:
        for (const recipient of recipients) {
          if (recipient.percentage < 1 || recipient.percentage > 100) {
            throw new BadRequestException('Percentage must be between 1 and 100');
          }
        }
        break;
    }
  }

  private async updateSplitCompletionStatus(split: PaymentSplit): Promise<void> {
    const allCompleted = split.recipients.every(r => r.distributionStatus === SplitStatus.COMPLETED);
    const anyFailed = split.recipients.some(r => r.distributionStatus === SplitStatus.FAILED);

    if (allCompleted) {
      split.status = SplitStatus.COMPLETED;
      split.completedAt = new Date();
    } else if (anyFailed) {
      split.status = SplitStatus.PARTIALLY_COMPLETED;
    }

    await this.splitRepository.save(split);
  }
}
