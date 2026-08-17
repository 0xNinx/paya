import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { NotificationServiceController } from './notification-service.controller';
import { WebhookService } from './webhook/webhook.service';
import { EmailService } from './email/email.service';
import { WebhookProcessor } from './webhook/webhook.processor';
import { EmailProcessor } from './email/email.processor';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { EmailLog } from './entities/email-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook, WebhookDelivery, EmailLog]),
    BullModule.registerQueue(
      { name: 'webhook-delivery' },
      { name: 'email-delivery' },
    ),
  ],
  controllers: [NotificationServiceController],
  providers: [
    WebhookService,
    EmailService,
    WebhookProcessor,
    EmailProcessor,
  ],
  exports: [WebhookService, EmailService],
})
export class NotificationServiceModule {}
