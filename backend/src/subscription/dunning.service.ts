import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DunningRecord, DunningStatus, DunningAction } from './entities/dunning-record.entity';
import { SubscriptionInvoice, InvoiceStatus } from './entities/subscription-invoice.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    @InjectRepository(DunningRecord)
    private dunningRepository: Repository<DunningRecord>,
    @InjectRepository(SubscriptionInvoice)
    private invoiceRepository: Repository<SubscriptionInvoice>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  async createDunningRecord(
    subscriptionId: string,
    invoiceId: string,
    action: DunningAction,
    scheduledAt: Date,
    retryConfig?: any,
  ): Promise<DunningRecord> {
    const invoice = await this.invoiceRepository.findOne({ where: { invoiceId } });
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const subscription = await this.subscriptionRepository.findOne({ where: { subscriptionId } });
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const dunningRecord = this.dunningRepository.create({
      dunningId: uuidv4(),
      subscriptionId,
      invoiceId,
      merchantId: invoice.merchantId,
      customerId: invoice.customerId,
      status: DunningStatus.PENDING,
      action,
      attemptNumber: invoice.retryCount + 1,
      scheduledAt,
      retryConfig: retryConfig || {
        maxAttempts: subscription.plan?.maxRetryAttempts || 3,
        retryIntervalHours: 24,
        escalateAfterAttempts: 3,
      },
    });

    return this.dunningRepository.save(dunningRecord);
  }

  async processDunningRecord(dunningId: string): Promise<void> {
    const dunningRecord = await this.dunningRepository.findOne({ 
      where: { dunningId },
      relations: ['subscription', 'invoice']
    });

    if (!dunningRecord) {
      this.logger.error(`Dunning record ${dunningId} not found`);
      return;
    }

    if (dunningRecord.status !== DunningStatus.PENDING) {
      this.logger.warn(`Dunning record ${dunningId} is not pending`);
      return;
    }

    dunningRecord.status = DunningStatus.IN_PROGRESS;
    dunningRecord.executedAt = new Date();
    await this.dunningRepository.save(dunningRecord);

    try {
      switch (dunningRecord.action) {
        case DunningAction.PAYMENT_RETRY:
          await this.processPaymentRetry(dunningRecord);
          break;
        case DunningAction.EMAIL_NOTIFICATION:
          await this.processEmailNotification(dunningRecord);
          break;
        case DunningAction.SUBSCRIPTION_PAUSE:
          await this.processSubscriptionPause(dunningRecord);
          break;
        case DunningAction.SUBSCRIPTION_CANCEL:
          await this.processSubscriptionCancel(dunningRecord);
          break;
        default:
          throw new Error(`Unknown dunning action: ${dunningRecord.action}`);
      }

      dunningRecord.status = DunningStatus.RESOLVED;
      dunningRecord.resolvedAt = new Date();
    } catch (error) {
      dunningRecord.status = DunningStatus.FAILED;
      dunningRecord.errorMessage = error.message;
      this.logger.error(`Failed to process dunning record ${dunningId}:`, error);
    }

    await this.dunningRepository.save(dunningRecord);
  }

  private async processPaymentRetry(dunningRecord: DunningRecord): Promise<void> {
    this.logger.log(`Processing payment retry for dunning record ${dunningRecord.dunningId}`);
    
    // This would trigger the payment retry logic
    // For now, we'll update the invoice status
    const invoice = await this.invoiceRepository.findOne({ 
      where: { invoiceId: dunningRecord.invoiceId }
    });

    if (invoice) {
      invoice.status = InvoiceStatus.PROCESSING;
      invoice.retryCount = dunningRecord.attemptNumber;
      await this.invoiceRepository.save(invoice);
    }
  }

  private async processEmailNotification(dunningRecord: DunningRecord): Promise<void> {
    this.logger.log(`Sending email notification for dunning record ${dunningRecord.dunningId}`);
    
    // This would integrate with an email service
    // For now, we'll just log the action
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId: dunningRecord.subscriptionId }
    });

    this.logger.log(`Payment failed notification sent to ${subscription?.customerEmail}`);
  }

  private async processSubscriptionPause(dunningRecord: DunningRecord): Promise<void> {
    this.logger.log(`Pausing subscription for dunning record ${dunningRecord.dunningId}`);
    
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId: dunningRecord.subscriptionId }
    });

    if (subscription) {
      subscription.status = SubscriptionStatus.PAUSED;
      subscription.pausedAt = new Date();
      await this.subscriptionRepository.save(subscription);
    }
  }

  private async processSubscriptionCancel(dunningRecord: DunningRecord): Promise<void> {
    this.logger.log(`Cancelling subscription for dunning record ${dunningRecord.dunningId}`);
    
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId: dunningRecord.subscriptionId }
    });

    if (subscription) {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.canceledAt = new Date();
      await this.subscriptionRepository.save(subscription);
    }
  }

  async scheduleNextDunningAction(
    subscriptionId: string,
    invoiceId: string,
    currentAttempt: number,
    maxAttempts: number,
  ): Promise<void> {
    if (currentAttempt >= maxAttempts) {
      // Max attempts reached, schedule cancellation
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      await this.createDunningRecord(
        subscriptionId,
        invoiceId,
        DunningAction.SUBSCRIPTION_CANCEL,
        scheduledAt,
      );
      return;
    }

    const retryIntervalHours = 24; // Default retry interval
    const scheduledAt = new Date(Date.now() + retryIntervalHours * 60 * 60 * 1000);

    // Schedule payment retry
    await this.createDunningRecord(
      subscriptionId,
      invoiceId,
      DunningAction.PAYMENT_RETRY,
      scheduledAt,
    );

    // Schedule email notification
    await this.createDunningRecord(
      subscriptionId,
      invoiceId,
      DunningAction.EMAIL_NOTIFICATION,
      new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    );

    // If this is the second-to-last attempt, schedule pause
    if (currentAttempt === maxAttempts - 1) {
      await this.createDunningRecord(
        subscriptionId,
        invoiceId,
        DunningAction.SUBSCRIPTION_PAUSE,
        new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
      );
    }
  }

  async getDunningRecords(subscriptionId?: string, invoiceId?: string): Promise<DunningRecord[]> {
    const where: any = {};
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (invoiceId) where.invoiceId = invoiceId;

    return this.dunningRepository.find({ 
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async getActiveDunningRecords(): Promise<DunningRecord[]> {
    return this.dunningRepository.find({
      where: {
        status: DunningStatus.PENDING,
        scheduledAt: new Date(),
      },
      relations: ['subscription', 'invoice'],
    });
  }

  async escalateDunningRecord(dunningId: string): Promise<DunningRecord> {
    const dunningRecord = await this.dunningRepository.findOne({ 
      where: { dunningId }
    });

    if (!dunningRecord) {
      throw new Error('Dunning record not found');
    }

    dunningRecord.status = DunningStatus.ESCALATED;
    dunningRecord.resolvedAt = new Date();
    
    return this.dunningRepository.save(dunningRecord);
  }
}
