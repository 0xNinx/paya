import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSplitService } from './payment-split.service';
import { PaymentSplitRefundService } from './payment-split-refund.service';
import { PaymentSplitNotificationService } from './payment-split-notification.service';
import { PaymentSplitController } from './payment-split.controller';
import { PaymentSplit } from './entities/payment-split.entity';
import { SplitDistribution } from './entities/split-distribution.entity';
import { SplitMilestone } from './entities/split-milestone.entity';
import { SplitAudit } from './entities/split-audit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentSplit,
      SplitDistribution,
      SplitMilestone,
      SplitAudit,
    ]),
  ],
  controllers: [PaymentSplitController],
  providers: [PaymentSplitService, PaymentSplitRefundService, PaymentSplitNotificationService],
  exports: [PaymentSplitService, PaymentSplitRefundService, PaymentSplitNotificationService],
})
export class PaymentSplitModule {}
