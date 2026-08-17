import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { Webhook } from './entities/webhook.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue('webhooks') private webhookQueue: Queue,
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    private deliveryService: WebhookDeliveryService,
  ) {}

  async addDeliveryJob(eventId: string): Promise<void> {
    await this.webhookQueue.add('deliver-webhook', { eventId }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 50,
    });

    this.logger.log(`Added delivery job for event ${eventId}`);
  }

  async processDelivery(eventId: string): Promise<void> {
    const event = await this.webhookEventRepository.findOne({
      where: { id: eventId },
      relations: ['webhook'],
    });

    if (!event) {
      this.logger.error(`Event ${eventId} not found`);
      return;
    }

    const webhook = await this.webhookRepository.findOne({
      where: { webhookId: event.webhookId },
    });

    if (!webhook) {
      this.logger.error(`Webhook ${event.webhookId} not found`);
      return;
    }

    if (webhook.status !== 'ACTIVE') {
      this.logger.log(`Webhook ${webhook.webhookId} is not active, skipping delivery`);
      return;
    }

    event.deliveryStatus = 'SENDING';
    await this.webhookEventRepository.save(event);

    try {
      const signature = this.generateEventSignature(event, webhook.secret);
      
      const delivery = await this.deliveryService.deliverWebhook(
        webhook,
        event.payload,
        signature,
      );

      event.deliveryStatus = 'SUCCESS';
      event.deliveredAt = new Date();
      event.statusCode = delivery.responseStatusCode;
      event.responseTime = delivery.responseTime;
      await this.webhookEventRepository.save(event);

    } catch (error) {
      event.retryCount++;
      event.errorMessage = error.message;

      if (event.retryCount >= webhook.maxRetries) {
        event.deliveryStatus = 'FAILED';
        await this.webhookEventRepository.save(event);

        const failedDelivery = await this.webhookDeliveryRepository.findOne({
          where: { eventId: event.eventId },
          order: { attemptNumber: 'DESC' },
        });

        if (failedDelivery) {
          await this.deliveryService.moveToDeadLetter(failedDelivery);
        }
      } else {
        event.deliveryStatus = 'RETRYING';
        event.nextRetryAt = this.calculateNextRetry(event.retryCount);
        await this.webhookEventRepository.save(event);

        await this.addDeliveryJob(event.id);
      }
    }
  }

  private generateEventSignature(event: WebhookEvent, secret: string): string {
    const crypto = require('node:crypto');
    const timestamp = Date.now().toString();
    const payloadString = JSON.stringify(event.payload);
    const signaturePayload = `${timestamp}.${payloadString}`;
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    return `${timestamp}.${signature}`;
  }

  private calculateNextRetry(retryCount: number): Date {
    const baseDelay = 1000;
    const maxDelay = 3600000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return new Date(Date.now() + delay);
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.webhookQueue.getWaitingCount();
    const active = await this.webhookQueue.getActiveCount();
    const completed = await this.webhookQueue.getCompletedCount();
    const failed = await this.webhookQueue.getFailedCount();

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  async cleanOldJobs(): Promise<void> {
    await this.webhookQueue.clean(24 * 60 * 60 * 1000, 0, 'completed');
    await this.webhookQueue.clean(7 * 24 * 60 * 60 * 1000, 0, 'failed');
    this.logger.log('Cleaned old webhook jobs');
  }
}
