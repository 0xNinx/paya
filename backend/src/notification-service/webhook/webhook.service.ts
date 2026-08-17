import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Webhook, WebhookStatus } from '../entities/webhook.entity';
import { WebhookDelivery, DeliveryStatus } from '../entities/webhook-delivery.entity';
import { RegisterWebhookDto } from '../dto/register-webhook.dto';
import { UpdateWebhookDto } from '../dto/update-webhook.dto';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
    @InjectQueue('webhook-delivery')
    private webhookQueue: Queue,
  ) {}

  async registerWebhook(dto: RegisterWebhookDto): Promise<Webhook> {
    const secret = dto.secret || this.generateSecret();

    const webhook = this.webhookRepository.create({
      ...dto,
      secret,
      status: dto.status || WebhookStatus.ACTIVE,
    });

    const saved = await this.webhookRepository.save(webhook);
    this.logger.log(`Registered webhook for merchant ${dto.merchantId} with ${dto.events.length} events`);
    return saved;
  }

  async updateWebhook(webhookId: string, dto: UpdateWebhookDto): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    Object.assign(webhook, dto);
    return this.webhookRepository.save(webhook);
  }

  async getWebhook(webhookId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  async getMerchantWebhooks(merchantId: string, status?: WebhookStatus): Promise<Webhook[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    return this.webhookRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    await this.webhookRepository.remove(webhook);
  }

  async sendWebhook(eventType: string, payload: Record<string, any>): Promise<void> {
    const webhooks = await this.webhookRepository.find({
      where: { status: WebhookStatus.ACTIVE },
    });

    const relevantWebhooks = webhooks.filter(w => w.events.includes(eventType) || w.events.includes('*'));

    for (const webhook of relevantWebhooks) {
      await this.queueWebhookDelivery(webhook, eventType, payload);
    }

    this.logger.log(`Queued webhook delivery for ${eventType} to ${relevantWebhooks.length} webhooks`);
  }

  async queueWebhookDelivery(webhook: Webhook, eventType: string, payload: Record<string, any>): Promise<void> {
    const delivery = this.deliveryRepository.create({
      webhookId: webhook.id,
      merchantId: webhook.merchantId,
      eventType,
      payload,
      status: DeliveryStatus.PENDING,
      attemptNumber: 0,
    });

    const savedDelivery = await this.deliveryRepository.save(delivery);

    await this.webhookQueue.add(
      'deliver-webhook',
      {
        deliveryId: savedDelivery.id,
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
      },
      {
        attempts: webhook.maxRetries,
        backoff: {
          type: 'exponential',
          delay: webhook.retryDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
  }

  async getWebhookDeliveries(webhookId: string, status?: DeliveryStatus): Promise<WebhookDelivery[]> {
    const where: any = { webhookId };
    if (status) {
      where.status = status;
    }
    return this.deliveryRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async getDeliveryStatus(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepository.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  async getMerchantDeliveries(merchantId: string, eventType?: string): Promise<WebhookDelivery[]> {
    const where: any = { merchantId };
    if (eventType) {
      where.eventType = eventType;
    }
    return this.deliveryRepository.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async disableWebhook(webhookId: string): Promise<Webhook> {
    const webhook = await this.getWebhook(webhookId);
    webhook.status = WebhookStatus.DISABLED;
    return this.webhookRepository.save(webhook);
  }

  async enableWebhook(webhookId: string): Promise<Webhook> {
    const webhook = await this.getWebhook(webhookId);
    webhook.status = WebhookStatus.ACTIVE;
    webhook.failureCount = 0;
    return this.webhookRepository.save(webhook);
  }

  async regenerateSecret(webhookId: string): Promise<{ secret: string }> {
    const webhook = await this.getWebhook(webhookId);
    const newSecret = this.generateSecret();
    webhook.secret = newSecret;
    await this.webhookRepository.save(webhook);
    return { secret: newSecret };
  }

  async verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    return hmac.update(payload).digest('hex');
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getWebhookStats(webhookId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    averageResponseTime: number;
  }> {
    const deliveries = await this.deliveryRepository.find({ where: { webhookId } });

    const successful = deliveries.filter(d => d.status === DeliveryStatus.SUCCESS);
    const failed = deliveries.filter(d => d.status === DeliveryStatus.FAILED);
    const pending = deliveries.filter(d => d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.RETRYING);

    const responseTimes = successful
      .filter(d => d.responseTime !== null)
      .map(d => d.responseTime);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      pendingDeliveries: pending.length,
      averageResponseTime: avgResponseTime,
    };
  }
}
