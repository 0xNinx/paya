import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionInvoice } from './entities/subscription-invoice.entity';

export interface SubscriptionEventData {
  subscription: Subscription;
  invoice?: SubscriptionInvoice;
  additionalData?: Record<string, any>;
}

@Injectable()
export class SubscriptionNotificationService {
  private readonly logger = new Logger(SubscriptionNotificationService.name);

  constructor(
    @InjectQueue('webhook-notifications')
    private webhookQueue: Queue,
  ) {}

  async sendSubscriptionEvent(
    eventType: string,
    subscription: Subscription,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    const payload = {
      eventType,
      data: {
        subscription: this.sanitizeSubscription(subscription),
        ...additionalData,
      },
      timestamp: new Date().toISOString(),
      merchantId: subscription.merchantId,
    };

    try {
      await this.webhookQueue.add(
        'send-webhook',
        {
          merchantId: subscription.merchantId,
          eventType: `subscription.${eventType}`,
          payload,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Queued webhook event: subscription.${eventType} for merchant ${subscription.merchantId}`);
    } catch (error) {
      this.logger.error(`Failed to queue webhook event: subscription.${eventType}`, error);
    }
  }

  async sendInvoiceEvent(
    eventType: string,
    invoice: SubscriptionInvoice,
    subscription: Subscription,
  ): Promise<void> {
    const payload = {
      eventType,
      data: {
        invoice: this.sanitizeInvoice(invoice),
        subscription: this.sanitizeSubscription(subscription),
      },
      timestamp: new Date().toISOString(),
      merchantId: invoice.merchantId,
    };

    try {
      await this.webhookQueue.add(
        'send-webhook',
        {
          merchantId: invoice.merchantId,
          eventType: `invoice.${eventType}`,
          payload,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Queued webhook event: invoice.${eventType} for merchant ${invoice.merchantId}`);
    } catch (error) {
      this.logger.error(`Failed to queue webhook event: invoice.${eventType}`, error);
    }
  }

  async sendDunningEvent(
    eventType: string,
    subscriptionId: string,
    invoiceId: string,
    merchantId: string,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    const payload = {
      eventType,
      data: {
        subscriptionId,
        invoiceId,
        ...additionalData,
      },
      timestamp: new Date().toISOString(),
      merchantId,
    };

    try {
      await this.webhookQueue.add(
        'send-webhook',
        {
          merchantId,
          eventType: `dunning.${eventType}`,
          payload,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Queued webhook event: dunning.${eventType} for merchant ${merchantId}`);
    } catch (error) {
      this.logger.error(`Failed to queue webhook event: dunning.${eventType}`, error);
    }
  }

  private sanitizeSubscription(subscription: Subscription): Partial<Subscription> {
    const { id, ...sanitized } = subscription;
    return sanitized;
  }

  private sanitizeInvoice(invoice: SubscriptionInvoice): Partial<SubscriptionInvoice> {
    const { id, ...sanitized } = invoice;
    return sanitized;
  }

  async sendTestWebhook(merchantId: string, webhookUrl: string): Promise<void> {
    const payload = {
      eventType: 'subscription.test',
      data: {
        message: 'Test webhook notification',
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.webhookQueue.add(
        'send-webhook',
        {
          merchantId,
          eventType: 'subscription.test',
          payload,
          testWebhookUrl: webhookUrl,
        },
        {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log(`Queued test webhook for merchant ${merchantId}`);
    } catch (error) {
      this.logger.error(`Failed to queue test webhook for merchant ${merchantId}`, error);
      throw error;
    }
  }
}
