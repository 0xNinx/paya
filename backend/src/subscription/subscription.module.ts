import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { DunningService } from './dunning.service';
import { UsageTrackingService } from './usage-tracking.service';
import { SubscriptionAnalyticsService } from './subscription-analytics.service';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionInvoice } from './entities/subscription-invoice.entity';
import { SubscriptionUsage } from './entities/subscription-usage.entity';
import { DunningRecord } from './entities/dunning-record.entity';
import { SubscriptionProcessor } from './subscription.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      Subscription,
      SubscriptionInvoice,
      SubscriptionUsage,
      DunningRecord,
    ]),
    BullModule.registerQueue(
      { name: 'subscription-payments' },
      { name: 'subscription-trials' },
      { name: 'subscription-resume' },
      { name: 'webhook-notifications' },
    ),
    ScheduleModule.forRoot(),
  ],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionInvoiceService,
    SubscriptionSchedulerService,
    SubscriptionNotificationService,
    DunningService,
    UsageTrackingService,
    SubscriptionAnalyticsService,
    SubscriptionProcessor,
  ],
  exports: [
    SubscriptionPlanService,
    SubscriptionService,
    SubscriptionInvoiceService,
    SubscriptionSchedulerService,
    SubscriptionNotificationService,
    DunningService,
    UsageTrackingService,
    SubscriptionAnalyticsService,
  ],
})
export class SubscriptionModule {}
