import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionUsage } from './entities/subscription-usage.entity';
import { Subscription } from './entities/subscription.entity';
import { CreateUsageRecordDto } from './dto/usage-record.dto';

@Injectable()
export class UsageTrackingService {
  constructor(
    @InjectRepository(SubscriptionUsage)
    private usageRepository: Repository<SubscriptionUsage>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  async recordUsage(createUsageDto: CreateUsageRecordDto): Promise<SubscriptionUsage> {
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId: createUsageDto.subscriptionId }
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const amount = createUsageDto.quantity * createUsageDto.unitPrice;

    const usageRecord = this.usageRepository.create({
      subscriptionId: createUsageDto.subscriptionId,
      metricId: createUsageDto.metricId,
      metricName: createUsageDto.metricName,
      metricUnit: createUsageDto.metricUnit,
      quantity: createUsageDto.quantity,
      unitPrice: createUsageDto.unitPrice,
      amount,
      currency: createUsageDto.currency,
      periodStart: new Date(createUsageDto.periodStart),
      periodEnd: new Date(createUsageDto.periodEnd),
      metadata: createUsageDto.metadata,
    });

    return this.usageRepository.save(usageRecord);
  }

  async recordUsageBatch(usageRecords: CreateUsageRecordDto[]): Promise<SubscriptionUsage[]> {
    const savedRecords = [];
    
    for (const usageDto of usageRecords) {
      const record = await this.recordUsage(usageDto);
      savedRecords.push(record);
    }

    return savedRecords;
  }

  async getUsageRecords(subscriptionId: string, metricId?: string): Promise<SubscriptionUsage[]> {
    const where: any = { subscriptionId };
    if (metricId) {
      where.metricId = metricId;
    }

    return this.usageRepository.find({ 
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async getUsageByPeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
    metricId?: string,
  ): Promise<SubscriptionUsage[]> {
    const where: any = {
      subscriptionId,
      periodStart,
      periodEnd,
    };
    
    if (metricId) {
      where.metricId = metricId;
    }

    return this.usageRepository.find({ where });
  }

  async aggregateUsageByMetric(
    subscriptionId: string,
    metricId: string,
    periodStart?: Date,
    periodEnd?: Date,
  ): Promise<{ totalQuantity: number; totalAmount: number; recordCount: number }> {
    const where: any = { subscriptionId, metricId };
    
    if (periodStart && periodEnd) {
      where.periodStart = periodStart;
      where.periodEnd = periodEnd;
    }

    const records = await this.usageRepository.find({ where });

    const totalQuantity = records.reduce((sum, record) => sum + record.quantity, 0);
    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

    return {
      totalQuantity,
      totalAmount,
      recordCount: records.length,
    };
  }

  async aggregateUsageByPeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Array<{ metricId: string; metricName: string; totalQuantity: number; totalAmount: number }>> {
    const records = await this.usageRepository.find({
      where: {
        subscriptionId,
        periodStart,
        periodEnd,
      },
    });

    const aggregation = new Map();

    for (const record of records) {
      const key = record.metricId;
      const existing = aggregation.get(key) || {
        metricId: record.metricId,
        metricName: record.metricName,
        totalQuantity: 0,
        totalAmount: 0,
      };

      existing.totalQuantity += record.quantity;
      existing.totalAmount += record.amount;
      aggregation.set(key, existing);
    }

    return Array.from(aggregation.values());
  }

  async checkUsageLimits(
    subscriptionId: string,
    metricId: string,
    additionalQuantity: number,
  ): Promise<{ withinLimit: boolean; currentUsage: number; limit: number; remaining: number }> {
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId },
      relations: ['plan']
    });

    if (!subscription || !subscription.plan.limits) {
      return { withinLimit: true, currentUsage: 0, limit: Infinity, remaining: Infinity };
    }

    const limit = subscription.plan.limits[metricId];
    if (!limit) {
      return { withinLimit: true, currentUsage: 0, limit: Infinity, remaining: Infinity };
    }

    const currentPeriodStart = subscription.currentPeriodStart;
    const currentPeriodEnd = subscription.currentPeriodEnd;

    const { totalQuantity: currentUsage } = await this.aggregateUsageByMetric(
      subscriptionId,
      metricId,
      currentPeriodStart,
      currentPeriodEnd,
    );

    const remaining = limit - currentUsage;
    const withinLimit = (currentUsage + additionalQuantity) <= limit;

    return {
      withinLimit,
      currentUsage,
      limit,
      remaining,
    };
  }

  async resetUsagePeriod(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId }
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Archive old usage records or mark them as processed
    // For now, we'll just query them to demonstrate the concept
    const oldRecords = await this.usageRepository.find({
      where: {
        subscriptionId,
        periodEnd: subscription.currentPeriodStart,
      },
    });

    // In a real implementation, you might move these to an archive table
    // or update their status to indicate they've been billed
  }

  async getUsageSummary(subscriptionId: string): Promise<{
    totalMetrics: number;
    totalRecords: number;
    totalAmount: number;
    byMetric: Array<{ metricId: string; metricName: string; totalQuantity: number; totalAmount: number }>;
  }> {
    const records = await this.usageRepository.find({ 
      where: { subscriptionId }
    });

    const totalRecords = records.length;
    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

    const metricSet = new Set(records.map(r => r.metricId));
    const totalMetrics = metricSet.size;

    const byMetric = await this.aggregateUsageByPeriod(
      subscriptionId,
      new Date(0), // Beginning of time
      new Date(),  // Now
    );

    return {
      totalMetrics,
      totalRecords,
      totalAmount,
      byMetric,
    };
  }

  async deleteUsageRecord(usageId: string): Promise<void> {
    const record = await this.usageRepository.findOne({ where: { id: usageId } });
    
    if (!record) {
      throw new NotFoundException('Usage record not found');
    }

    await this.usageRepository.remove(record);
  }
}
