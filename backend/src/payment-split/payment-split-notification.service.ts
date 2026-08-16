import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSplit, SplitStatus } from './entities/payment-split.entity';
import { SplitDistribution } from './entities/split-distribution.entity';
import { SplitMilestone, MilestoneStatus } from './entities/split-milestone.entity';

export enum NotificationType {
  SPLIT_CREATED = 'SPLIT_CREATED',
  SPLIT_EXECUTED = 'SPLIT_EXECUTED',
  DISTRIBUTION_STARTED = 'DISTRIBUTION_STARTED',
  DISTRIBUTION_COMPLETED = 'DISTRIBUTION_COMPLETED',
  DISTRIBUTION_FAILED = 'DISTRIBUTION_FAILED',
  MILESTONE_TRIGGERED = 'MILESTONE_TRIGGERED',
  MILESTONE_COMPLETED = 'MILESTONE_COMPLETED',
  SPLIT_CANCELLED = 'SPLIT_CANCELLED',
  RETRY_INITIATED = 'RETRY_INITIATED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK',
  IN_APP = 'IN_APP',
}

interface NotificationPayload {
  recipientAddress: string;
  notificationType: NotificationType;
  channels: NotificationChannel[];
  data: {
    splitId: string;
    paymentId: string;
    amount?: number;
    currency?: string;
    status?: string;
    message: string;
    timestamp: Date;
  };
}

@Injectable()
export class PaymentSplitNotificationService {
  private readonly logger = new Logger(PaymentSplitNotificationService.name);

  constructor(
    @InjectRepository(PaymentSplit)
    private splitRepository: Repository<PaymentSplit>,
    @InjectRepository(SplitDistribution)
    private distributionRepository: Repository<SplitDistribution>,
    @InjectRepository(SplitMilestone)
    private milestoneRepository: Repository<SplitMilestone>,
  ) {}

  async notifySplitCreated(splitId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    if (!split) return;

    const payload: NotificationPayload = {
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.SPLIT_CREATED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        amount: split.totalAmount,
        currency: split.currency,
        status: split.status,
        message: `Payment split ${split.splitId} has been created for payment ${split.paymentId}`,
        timestamp: new Date(),
      },
    };

    await this.sendNotification(payload);
    this.logger.log(`Sent split created notification for ${splitId}`);
  }

  async notifySplitExecuted(splitId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    if (!split) return;

    // Notify merchant
    await this.sendNotification({
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.SPLIT_EXECUTED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        amount: split.totalAmount,
        currency: split.currency,
        status: split.status,
        message: `Payment split ${split.splitId} execution has started`,
        timestamp: new Date(),
      },
    });

    // Notify all recipients
    for (const recipient of split.recipients) {
      await this.sendNotification({
        recipientAddress: recipient.address,
        notificationType: NotificationType.SPLIT_EXECUTED,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        data: {
          splitId: split.splitId,
          paymentId: split.paymentId,
          amount: recipient.percentage ? (split.totalAmount * recipient.percentage / 100) : recipient.fixedAmount,
          currency: split.currency,
          status: split.status,
          message: `You are scheduled to receive payment from split ${split.splitId}`,
          timestamp: new Date(),
        },
      });
    }

    this.logger.log(`Sent split executed notifications for ${splitId}`);
  }

  async notifyDistributionCompleted(distributionId: string): Promise<void> {
    const distribution = await this.distributionRepository.findOne({ where: { distributionId } });
    if (!distribution) return;

    await this.sendNotification({
      recipientAddress: distribution.recipientAddress,
      notificationType: NotificationType.DISTRIBUTION_COMPLETED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: distribution.splitId,
        amount: distribution.amount,
        currency: 'USDC',
        status: distribution.status,
        message: `You have received ${distribution.amount} USDC from distribution ${distribution.distributionId}`,
        timestamp: new Date(),
      },
    });

    this.logger.log(`Sent distribution completed notification for ${distributionId}`);
  }

  async notifyDistributionFailed(distributionId: string, errorMessage: string): Promise<void> {
    const distribution = await this.distributionRepository.findOne({ where: { distributionId } });
    if (!distribution) return;

    await this.sendNotification({
      recipientAddress: distribution.recipientAddress,
      notificationType: NotificationType.DISTRIBUTION_FAILED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: distribution.splitId,
        amount: distribution.amount,
        currency: 'USDC',
        status: distribution.status,
        message: `Distribution ${distribution.distributionId} failed: ${errorMessage}`,
        timestamp: new Date(),
      },
    });

    this.logger.log(`Sent distribution failed notification for ${distributionId}`);
  }

  async notifyMilestoneTriggered(splitId: string, milestoneId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    const milestone = await this.milestoneRepository.findOne({ where: { splitId, milestoneId } });
    
    if (!split || !milestone) return;

    await this.sendNotification({
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.MILESTONE_TRIGGERED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        status: milestone.status,
        message: `Milestone "${milestone.description}" has been triggered for split ${split.splitId}`,
        timestamp: new Date(),
      },
    });

    this.logger.log(`Sent milestone triggered notification for ${milestoneId}`);
  }

  async notifyMilestoneCompleted(splitId: string, milestoneId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    const milestone = await this.milestoneRepository.findOne({ where: { splitId, milestoneId } });
    
    if (!split || !milestone) return;

    // Notify merchant
    await this.sendNotification({
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.MILESTONE_COMPLETED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        status: milestone.status,
        message: `Milestone "${milestone.description}" has been completed for split ${split.splitId}`,
        timestamp: new Date(),
      },
    });

    // Notify recipients if milestone releases funds
    for (const recipient of split.recipients) {
      await this.sendNotification({
        recipientAddress: recipient.address,
        notificationType: NotificationType.MILESTONE_COMPLETED,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        data: {
          splitId: split.splitId,
          amount: recipient.percentage ? (split.totalAmount * recipient.percentage / 100) : recipient.fixedAmount,
          currency: split.currency,
          status: milestone.status,
          message: `Milestone completed - payment distribution initiated`,
          timestamp: new Date(),
        },
      });
    }

    this.logger.log(`Sent milestone completed notification for ${milestoneId}`);
  }

  async notifySplitCancelled(splitId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    if (!split) return;

    // Notify merchant
    await this.sendNotification({
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.SPLIT_CANCELLED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        amount: split.totalAmount,
        currency: split.currency,
        status: split.status,
        message: `Payment split ${split.splitId} has been cancelled`,
        timestamp: new Date(),
      },
    });

    // Notify recipients
    for (const recipient of split.recipients) {
      await this.sendNotification({
        recipientAddress: recipient.address,
        notificationType: NotificationType.SPLIT_CANCELLED,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        data: {
          splitId: split.splitId,
          paymentId: split.paymentId,
          status: split.status,
          message: `Payment split ${split.splitId} has been cancelled - you will not receive payment`,
          timestamp: new Date(),
        },
      });
    }

    this.logger.log(`Sent split cancelled notifications for ${splitId}`);
  }

  async notifyRetryInitiated(splitId: string): Promise<void> {
    const split = await this.splitRepository.findOne({ where: { splitId } });
    if (!split) return;

    await this.sendNotification({
      recipientAddress: split.merchantAddress,
      notificationType: NotificationType.RETRY_INITIATED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      data: {
        splitId: split.splitId,
        paymentId: split.paymentId,
        status: split.status,
        message: `Retry initiated for failed distributions in split ${split.splitId}`,
        timestamp: new Date(),
      },
    });

    this.logger.log(`Sent retry initiated notification for ${splitId}`);
  }

  private async sendNotification(payload: NotificationPayload): Promise<void> {
    // In production, this would integrate with actual notification services
    // For now, we'll log the notification
    this.logger.log(`Notification sent:`, {
      type: payload.notificationType,
      recipient: payload.recipientAddress,
      channels: payload.channels,
      message: payload.data.message,
    });

    // TODO: Integrate with email service
    // TODO: Integrate with SMS service
    // TODO: Integrate with webhook service
    // TODO: Store in-app notifications in database
  }

  async configureNotificationPreferences(
    address: string,
    preferences: {
      email: boolean;
      sms: boolean;
      webhook: string | null;
      inApp: boolean;
    },
  ): Promise<void> {
    // Store user notification preferences
    this.logger.log(`Notification preferences updated for ${address}:`, preferences);
  }

  async getNotificationHistory(address: string, limit: number = 50): Promise<any[]> {
    // Retrieve notification history for a user
    this.logger.log(`Retrieved notification history for ${address}`);
    return [];
  }
}
