import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionInvoice, InvoiceStatus } from './entities/subscription-invoice.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

@Injectable()
export class SubscriptionAnalyticsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionInvoice)
    private invoiceRepository: Repository<SubscriptionInvoice>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
  ) {}

  async getSubscriptionMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    cancelledSubscriptions: number;
    newSubscriptions: number;
    churnRate: number;
    mrr: number;
    arr: number;
  }> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { merchantId },
    });

    const activeSubscriptions = subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE).length;
    const trialingSubscriptions = subscriptions.filter(s => s.status === SubscriptionStatus.TRIALING).length;
    const cancelledSubscriptions = subscriptions.filter(s => s.status === SubscriptionStatus.CANCELLED).length;
    const newSubscriptions = subscriptions.filter(
      s => s.createdAt >= startDate && s.createdAt <= endDate,
    ).length;

    const totalSubscriptions = subscriptions.length;
    const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;

    // Calculate MRR (Monthly Recurring Revenue)
    const activeSubs = subscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE);
    const mrr = activeSubs.reduce((sum, s) => {
      if (s.plan.billingInterval === 'MONTHLY') {
        return sum + s.currentAmount;
      } else if (s.plan.billingInterval === 'YEARLY') {
        return sum + s.currentAmount / 12;
      } else if (s.plan.billingInterval === 'WEEKLY') {
        return sum + s.currentAmount * 4;
      } else {
        return sum + s.currentAmount * 30;
      }
    }, 0);

    const arr = mrr * 12;

    return {
      totalSubscriptions,
      activeSubscriptions,
      trialingSubscriptions,
      cancelledSubscriptions,
      newSubscriptions,
      churnRate,
      mrr,
      arr,
    };
  }

  async getRevenueMetrics(
    merchantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRevenue: number;
    paidInvoices: number;
    pendingInvoices: number;
    failedInvoices: number;
    averageAmount: number;
  }> {
    const invoices = await this.invoiceRepository.find({
      where: { merchantId },
    });

    const periodInvoices = invoices.filter(
      i => i.createdAt >= startDate && i.createdAt <= endDate,
    );

    const paidInvoices = periodInvoices.filter(i => i.status === InvoiceStatus.PAID);
    const pendingInvoices = periodInvoices.filter(i => i.status === InvoiceStatus.PENDING);
    const failedInvoices = periodInvoices.filter(i => i.status === InvoiceStatus.FAILED);

    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const averageAmount = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

    return {
      totalRevenue,
      paidInvoices: paidInvoices.length,
      pendingInvoices: pendingInvoices.length,
      failedInvoices: failedInvoices.length,
      averageAmount,
    };
  }

  async getPlanMetrics(merchantId: string): Promise<Array<{
    planId: string;
    planName: string;
    subscriptionCount: number;
    revenue: number;
  }>> {
    const plans = await this.planRepository.find({ where: { merchantId } });
    const metrics = [];

    for (const plan of plans) {
      const subscriptions = await this.subscriptionRepository.find({
        where: { planId: plan.planId, status: SubscriptionStatus.ACTIVE },
      });

      const invoices = await this.invoiceRepository.find({
        where: { planId: plan.planId, status: InvoiceStatus.PAID },
      });

      const revenue = invoices.reduce((sum, i) => sum + i.total, 0);

      metrics.push({
        planId: plan.planId,
        planName: plan.name,
        subscriptionCount: subscriptions.length,
        revenue,
      });
    }

    return metrics;
  }

  async getSubscriptionTrends(
    merchantId: string,
    days: number = 30,
  ): Promise<Array<{
    date: string;
    newSubscriptions: number;
    cancellations: number;
    revenue: number;
  }>> {
    const trends = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const subscriptions = await this.subscriptionRepository.find({
        where: { merchantId },
      });

      const newSubs = subscriptions.filter(
        s => s.createdAt >= dayStart && s.createdAt <= dayEnd,
      ).length;

      const cancellations = subscriptions.filter(
        s => s.canceledAt && s.canceledAt >= dayStart && s.canceledAt <= dayEnd,
      ).length;

      const invoices = await this.invoiceRepository.find({
        where: { merchantId, status: InvoiceStatus.PAID },
      });

      const revenue = invoices
        .filter(i => i.paidAt && i.paidAt >= dayStart && i.paidAt <= dayEnd)
        .reduce((sum, i) => sum + i.total, 0);

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        newSubscriptions: newSubs,
        cancellations,
        revenue,
      });
    }

    return trends;
  }

  async getCustomerLifetimeValue(merchantId: string): Promise<{
    averageLTV: number;
    medianLTV: number;
    totalCustomers: number;
  }> {
    const invoices = await this.invoiceRepository.find({
      where: { merchantId, status: InvoiceStatus.PAID },
    });

    const customerRevenue = new Map();

    for (const invoice of invoices) {
      const existing = customerRevenue.get(invoice.customerId) || 0;
      customerRevenue.set(invoice.customerId, existing + invoice.total);
    }

    const ltvs = Array.from(customerRevenue.values());
    const totalCustomers = ltvs.length;
    const averageLTV = totalCustomers > 0 ? ltvs.reduce((sum, ltv) => sum + ltv, 0) / totalCustomers : 0;

    const sortedLtvs = ltvs.sort((a, b) => a - b);
    const medianLTV = totalCustomers > 0 
      ? sortedLtvs[Math.floor(totalCustomers / 2)] 
      : 0;

    return {
      averageLTV,
      medianLTV,
      totalCustomers,
    };
  }
}
