import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundService } from './refund.service';
import { DisputeTemplateService } from './dispute-template.service';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { RefundController, DisputeController, RefundAnalyticsController, DisputeAnalyticsController } from './refund.controller';
import { Refund } from './entities/refund.entity';
import { Dispute } from './entities/dispute.entity';
import { Evidence } from './entities/evidence.entity';
import { RefundAudit } from './entities/refund-audit.entity';
import { RefundPolicy } from './entities/refund-policy.entity';
import { DisputeTemplate } from './entities/dispute-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Refund,
      Dispute,
      Evidence,
      RefundAudit,
      RefundPolicy,
      DisputeTemplate,
    ]),
  ],
  controllers: [
    RefundController,
    DisputeController,
    RefundAnalyticsController,
    DisputeAnalyticsController,
  ],
  providers: [RefundService, DisputeTemplateService, RefundReconciliationService],
  exports: [RefundService, DisputeTemplateService, RefundReconciliationService],
})
export class RefundModule {}
