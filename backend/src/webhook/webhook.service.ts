import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'node:crypto';
import { Webhook, WebhookStatus } from './entities/webhook.entity';
import { WebhookEvent, EventType } from './entities/webhook-event.entity';
import { WebhookDelivery, DeliveryStatus } from './entities/webhook-delivery.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { ReplayWebhookDto } from './dto/replay-webhook.dto';
import { TriggerWebhookDto } from './dto/trigger-webhook.dto';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookQueueService } from './webhook-queue.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(WebhookDeliveryLog)
    private webhookDeliveryLogRepository: Repository<WebhookDeliveryLog>,
    private signatureService: WebhookSignatureService,
    private deliveryService: WebhookDeliveryService,
    private queueService: WebhookQueueService,
  ) {}

  async create(createWebhookDto: CreateWebhookDto): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      webhookId: uuidv4(),
      ...createWebhookDto,
      secret: createWebhookDto.secret || this.generateSecret(),
    });

    return this.webhookRepository.save(webhook);
  }

  async findAll(merchantId?: string): Promise<Webhook[]> {
    if (merchantId) {
      return this.webhookRepository.find({ where: { merchantId } });
    }
    return this.webhookRepository.find();
  }

  async findOne(webhookId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { webhookId } });
    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${webhookId} not found`);
    }
    return webhook;
  }

  async update(webhookId: string, updateWebhookDto: UpdateWebhookDto): Promise<Webhook> {
    const webhook = await this.findOne(webhookId);
    Object.assign(webhook, updateWebhookDto);
    return this.webhookRepository.save(webhook);
  }

  async remove(webhookId: string): Promise<void> {
    const webhook = await this.findOne(webhookId);
    await this.webhookRepository.remove(webhook);
  }

  async activate(webhookId: string): Promise<Webhook> {
    const webhook = await this.findOne(webhookId);
    webhook.status = WebhookStatus.ACTIVE;
    return this.webhookRepository.save(webhook);
  }

  async deactivate(webhookId: string): Promise<Webhook> {
    const webhook = await this.findOne(webhookId);
    webhook.status = WebhookStatus.INACTIVE;
    return this.webhookRepository.save(webhook);
  }

  async trigger(triggerWebhookDto: TriggerWebhookDto): Promise<WebhookEvent[]> {
    const { eventType, payload, merchantId } = triggerWebhookDto;

    let webhooks = await this.webhookRepository.find({
      where: { status: WebhookStatus.ACTIVE },
    });

    if (merchantId) {
      webhooks = webhooks.filter(w => w.merchantId === merchantId);
    }

    webhooks = webhooks.filter(w => w.events.includes(eventType));

    if (webhooks.length === 0) {
      this.logger.log(`No active webhooks found for event ${eventType}`);
      return [];
    }

    const events: WebhookEvent[] = [];

    for (const webhook of webhooks) {
      const event = await this.createWebhookEvent(webhook, eventType, payload);
      events.push(event);

      await this.queueService.addDeliveryJob(event.id);
    }

    return events;
  }

  async test(testWebhookDto: TestWebhookDto): Promise<any> {
    const { webhookId, eventType, testPayload } = testWebhookDto;
    const webhook = await this.findOne(webhookId);

    const payload = testPayload || {
      test: true,
      eventType,
      timestamp: new Date().toISOString(),
    };

    const signature = this.signatureService.generateSignature(payload, webhook.secret);

    try {
      const result = await this.deliveryService.deliverWebhook(
        webhook,
        payload,
        signature,
        true,
      );

      return {
        success: true,
        webhookId,
        eventType,
        payload,
        result,
      };
    } catch (error) {
      return {
        success: false,
        webhookId,
        eventType,
        payload,
        error: error.message,
      };
    }
  }

  async replay(replayWebhookDto: ReplayWebhookDto): Promise<WebhookEvent> {
    const { eventId, webhookId } = replayWebhookDto;

    let event = await this.webhookEventRepository.findOne({
      where: { eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    if (webhookId) {
      event = await this.webhookEventRepository.findOne({
        where: { eventId, webhookId },
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} for webhook ${webhookId} not found`);
      }
    }

    event.deliveryStatus = 'PENDING';
    event.retryCount = 0;
    event.nextRetryAt = null;
    event.deliveredAt = null;
    event.errorMessage = null;
    event.statusCode = null;

    await this.webhookEventRepository.save(event);

    await this.queueService.addDeliveryJob(event.id);

    return event;
  }

  async getEvents(webhookId: string, limit = 50, offset = 0): Promise<WebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getDeliveries(eventId: string, limit = 50, offset = 0): Promise<WebhookDelivery[]> {
    return this.webhookDeliveryRepository.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getDeliveryLogs(deliveryId: string, limit = 50, offset = 0): Promise<WebhookDeliveryLog[]> {
    return this.webhookDeliveryLogRepository.find({
      where: { deliveryId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  private async createWebhookEvent(
    webhook: Webhook,
    eventType: EventType,
    payload: Record<string, any>,
  ): Promise<WebhookEvent> {
    const event = this.webhookEventRepository.create({
      eventId: uuidv4(),
      webhookId: webhook.webhookId,
      eventType,
      payload: this.applyPayloadTemplate(payload, webhook.payloadTemplate),
      deliveryStatus: 'PENDING',
    });

    webhook.lastTriggeredAt = new Date();
    await this.webhookRepository.save(webhook);

    return this.webhookEventRepository.save(event);
  }

  private applyPayloadTemplate(
    payload: Record<string, any>,
    template?: Record<string, any>,
  ): Record<string, any> {
    if (!template) {
      return payload;
    }

    const result = { ...payload };

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const fieldPath = value.slice(2, -2).trim();
        result[key] = this.getNestedValue(payload, fieldPath);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async getWebhookStats(webhookId: string): Promise<any> {
    const webhook = await this.findOne(webhookId);

    const totalEvents = await this.webhookEventRepository.count({
      where: { webhookId },
    });

    const successfulDeliveries = await this.webhookDeliveryRepository.count({
      where: { webhookId, status: DeliveryStatus.SUCCESS },
    });

    const failedDeliveries = await this.webhookDeliveryRepository.count({
      where: { webhookId, status: DeliveryStatus.FAILED },
    });

    const pendingDeliveries = await this.webhookDeliveryRepository.count({
      where: { webhookId, status: DeliveryStatus.PENDING },
    });

    return {
      webhookId: webhook.webhookId,
      url: webhook.url,
      status: webhook.status,
      totalEvents,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries,
      successRate: totalEvents > 0 ? (successfulDeliveries / totalEvents) * 100 : 0,
      webhookSuccessCount: webhook.successCount,
      webhookFailureCount: webhook.failureCount,
      lastSuccessAt: webhook.lastSuccessAt,
      lastFailureAt: webhook.lastFailureAt,
      lastTriggeredAt: webhook.lastTriggeredAt,
    };
  }
}
