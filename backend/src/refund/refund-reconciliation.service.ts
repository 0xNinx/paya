import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund, RefundStatus } from './entities/refund.entity';
import { RefundAudit, AuditAction } from './entities/refund-audit.entity';
import { v4 as uuidv4 } from 'uuid';

interface ReconciliationResult {
  matched: number;
  unmatched: number;
  discrepancies: Array<{
    refundId: string;
    issue: string;
    expectedAmount?: number;
    actualAmount?: number;
  }>;
}

interface ProcessorTransaction {
  transactionId: string;
  refundId: string;
  amount: number;
  status: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class RefundReconciliationService {
  private readonly logger = new Logger(RefundReconciliationService.name);

  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(RefundAudit)
    private auditRepository: Repository<RefundAudit>,
  ) {}

  async reconcileWithProcessor(
    processorTransactions: ProcessorTransaction[],
    processorName: string,
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      matched: 0,
      unmatched: 0,
      discrepancies: [],
    };

    const localRefunds = await this.refundRepository.find({
      where: { status: RefundStatus.COMPLETED },
    });

    const processorMap = new Map(
      processorTransactions.map((tx) => [tx.refundId, tx]),
    );

    for (const refund of localRefunds) {
      const processorTx = processorMap.get(refund.refundId);

      if (!processorTx) {
        result.unmatched++;
        result.discrepancies.push({
          refundId: refund.refundId,
          issue: 'Refund not found in processor records',
          expectedAmount: Number(refund.refundAmount),
        });
        continue;
      }

      // Check amount match
      if (Math.abs(Number(refund.refundAmount) - processorTx.amount) > 0.01) {
        result.discrepancies.push({
          refundId: refund.refundId,
          issue: 'Amount mismatch',
          expectedAmount: Number(refund.refundAmount),
          actualAmount: processorTx.amount,
        });
        continue;
      }

      // Check status match
      if (processorTx.status.toLowerCase() !== 'completed' && 
          processorTx.status.toLowerCase() !== 'success') {
        result.discrepancies.push({
          refundId: refund.refundId,
          issue: `Status mismatch: local=${refund.status}, processor=${processorTx.status}`,
        });
        continue;
      }

      result.matched++;
    }

    // Check for processor transactions not in local records
    for (const processorTx of processorTransactions) {
      const localRefund = localRefunds.find((r) => r.refundId === processorTx.refundId);
      
      if (!localRefund) {
        result.discrepancies.push({
          refundId: processorTx.refundId,
          issue: 'Transaction in processor but not in local records',
          actualAmount: processorTx.amount,
        });
      }
    }

    // Create audit entry for reconciliation
    await this.auditRepository.save({
      auditId: `REC_${uuidv4()}`,
      action: AuditAction.FEE_CALCULATED, // Using existing action, could add new one
      performedBy: 'system',
      performedByRole: 'reconciliation_bot',
      newState: { result, processorName, timestamp: new Date() },
      notes: `Reconciliation with ${processorName}: ${result.matched} matched, ${result.unmatched} unmatched`,
    });

    this.logger.log(
      `Reconciliation completed: ${result.matched} matched, ${result.unmatched} unmatched, ${result.discrepancies.length} discrepancies`,
    );

    return result;
  }

  async reconcileRefund(refundId: string, processorData: ProcessorTransaction): Promise<boolean> {
    const refund = await this.refundRepository.findOne({ where: { refundId } });

    if (!refund) {
      this.logger.warn(`Refund ${refundId} not found for reconciliation`);
      return false;
    }

    const isMatched =
      Math.abs(Number(refund.refundAmount) - processorData.amount) < 0.01 &&
      refund.status === RefundStatus.COMPLETED;

    if (isMatched) {
      await this.auditRepository.save({
        auditId: `REC_${uuidv4()}`,
        refundId: refund.refundId,
        action: AuditAction.FEE_CALCULATED,
        performedBy: 'system',
        performedByRole: 'reconciliation_bot',
        newState: { reconciled: true, processorData },
        notes: 'Refund successfully reconciled with processor',
      });
    } else {
      await this.auditRepository.save({
        auditId: `REC_${uuidv4()}`,
        refundId: refund.refundId,
        action: AuditAction.FEE_CALCULATED,
        performedBy: 'system',
        performedByRole: 'reconciliation_bot',
        newState: { reconciled: false, processorData },
        notes: 'Refund reconciliation failed - discrepancy detected',
      });
    }

    return isMatched;
  }

  async getReconciliationReport(startDate: Date, endDate: Date): Promise<{
    totalRefunds: number;
    completedRefunds: number;
    failedRefunds: number;
    totalAmount: number;
    totalFees: number;
    averageProcessingTime: number;
  }> {
    const refunds = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const completedRefunds = refunds.filter((r) => r.status === RefundStatus.COMPLETED);
    const failedRefunds = refunds.filter((r) => r.status === RefundStatus.FAILED);

    const totalAmount = completedRefunds.reduce((sum, r) => sum + Number(r.refundAmount), 0);
    const totalFees = completedRefunds.reduce((sum, r) => sum + Number(r.feeAmount), 0);

    // Calculate average processing time
    const processingTimes = completedRefunds
      .filter((r) => r.processedAt && r.createdAt)
      .map((r) => r.processedAt!.getTime() - r.createdAt.getTime());

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

    return {
      totalRefunds: refunds.length,
      completedRefunds: completedRefunds.length,
      failedRefunds: failedRefunds.length,
      totalAmount,
      totalFees,
      averageProcessingTime,
    };
  }

  async flagSuspiciousRefunds(threshold: number = 1000): Promise<Refund[]> {
    const suspiciousRefunds = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.refundAmount > :threshold', { threshold })
      .andWhere('refund.status = :status', { status: RefundStatus.COMPLETED })
      .orderBy('refund.refundAmount', 'DESC')
      .limit(50)
      .getMany();

    // Flag refunds with unusual patterns
    const flagged = suspiciousRefunds.filter((refund) => {
      // Add more sophisticated fraud detection logic here
      return (
        refund.reason === 'FRAUDULENT' ||
        refund.refundType === 'FULL' ||
        Number(refund.refundAmount) > threshold * 2
      );
    });

    return flagged;
  }

  async autoReconcile(): Promise<void> {
    this.logger.log('Starting automatic reconciliation...');

    // This would typically be called by a scheduled job
    // and would fetch transactions from payment processors
    // For now, it's a placeholder for the reconciliation logic

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentRefunds = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.processedAt BETWEEN :startDate AND :endDate', {
        startDate: oneDayAgo,
        endDate: new Date(),
      })
      .andWhere('refund.status = :status', { status: RefundStatus.COMPLETED })
      .getMany();

    this.logger.log(`Found ${recentRefunds.length} refunds to reconcile`);

    // In a real implementation, you would:
    // 1. Fetch transactions from Stellar/payment processor
    // 2. Compare with local records
    // 3. Flag discrepancies
    // 4. Send notifications for unmatched items
  }
}
