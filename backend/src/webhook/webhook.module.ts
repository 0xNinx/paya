import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookQueueService } from './webhook-queue.service';
import { WebhookTestingService } from './webhook-testing.service';
import { WebhookProcessor } from './webhook.processor';
import { Webhook } from './entities/webhook.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Webhook,
      WebhookEvent,
      WebhookDelivery,
      WebhookDeliveryLog,
    ]),
    BullModule.registerQueue({
      name: 'webhooks',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    HttpModule,
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookSignatureService,
    WebhookDeliveryService,
    WebhookQueueService,
    WebhookTestingService,
    WebhookProcessor,
  ],
  exports: [
    WebhookService,
    WebhookSignatureService,
    WebhookDeliveryService,
    WebhookQueueService,
    WebhookTestingService,
  ],
})
export class WebhookModule {}
