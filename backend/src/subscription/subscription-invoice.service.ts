import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionInvoice, InvoiceStatus, InvoiceType } from './entities/subscription-invoice.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { CreateInvoiceDto } from './dto/invoice.dto';

@Injectable()
export class SubscriptionInvoiceService {
  constructor(
    @InjectRepository(SubscriptionInvoice)
    private invoiceRepository: Repository<SubscriptionInvoice>,
  ) {}

  async createRecurringInvoice(subscription: Subscription): Promise<SubscriptionInvoice> {
    const lineItems = [{
      description: `${subscription.plan.name} - ${subscription.plan.billingInterval} subscription`,
      quantity: 1,
      unitPrice: subscription.currentAmount,
      amount: subscription.currentAmount,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    }];

    const invoice = this.invoiceRepository.create({
      invoiceId: uuidv4(),
      subscriptionId: subscription.subscriptionId,
      merchantId: subscription.merchantId,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: InvoiceStatus.PENDING,
      type: InvoiceType.RECURRING,
      subtotal: subscription.currentAmount,
      total: subscription.currentAmount,
      currency: subscription.currency,
      dueDate: subscription.currentPeriodEnd,
      lineItems,
      metadata: {
        billingCycle: subscription.billingCycleCount + 1,
      },
    });

    return this.invoiceRepository.save(invoice);
  }

  async createProrationInvoice(
    subscription: Subscription,
    oldPlan: SubscriptionPlan,
    newPlan: SubscriptionPlan,
    proratedAmount: number,
  ): Promise<SubscriptionInvoice> {
    const lineItems = [{
      description: `Plan change: ${oldPlan.name} → ${newPlan.name} (prorated)`,
      quantity: 1,
      unitPrice: proratedAmount,
      amount: proratedAmount,
    }];

    const invoice = this.invoiceRepository.create({
      invoiceId: uuidv4(),
      subscriptionId: subscription.subscriptionId,
      merchantId: subscription.merchantId,
      customerId: subscription.customerId,
      planId: newPlan.planId,
      status: InvoiceStatus.PENDING,
      type: InvoiceType.PRORATION,
      subtotal: proratedAmount,
      total: proratedAmount,
      currency: subscription.currency,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
      lineItems,
      prorationDetails: {
        previousPlanId: oldPlan.planId,
        newPlanId: newPlan.planId,
        prorationRatio: proratedAmount / newPlan.amount,
        proratedAmount,
      },
    });

    return this.invoiceRepository.save(invoice);
  }

  async createUsageBasedInvoice(
    subscription: Subscription,
    usageRecords: any[],
  ): Promise<SubscriptionInvoice> {
    const lineItems = usageRecords.map(record => ({
      description: `${record.metricName} usage (${record.metricUnit})`,
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      amount: record.amount,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
    }));

    const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

    const invoice = this.invoiceRepository.create({
      invoiceId: uuidv4(),
      subscriptionId: subscription.subscriptionId,
      merchantId: subscription.merchantId,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: InvoiceStatus.PENDING,
      type: InvoiceType.USAGE_BASED,
      subtotal: total,
      total,
      currency: subscription.currency,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      lineItems,
    });

    return this.invoiceRepository.save(invoice);
  }

  async getInvoice(invoiceId: string): Promise<SubscriptionInvoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getSubscriptionInvoices(subscriptionId: string): Promise<SubscriptionInvoice[]> {
    return this.invoiceRepository.find({ 
      where: { subscriptionId },
      order: { createdAt: 'DESC' }
    });
  }

  async getMerchantInvoices(merchantId: string, status?: InvoiceStatus): Promise<SubscriptionInvoice[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    return this.invoiceRepository.find({ 
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async getCustomerInvoices(customerId: string): Promise<SubscriptionInvoice[]> {
    return this.invoiceRepository.find({ 
      where: { customerId },
      order: { createdAt: 'DESC' }
    });
  }

  async markInvoiceAsProcessing(invoiceId: string): Promise<SubscriptionInvoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Invoice is not in pending status');
    }

    invoice.status = InvoiceStatus.PROCESSING;
    return this.invoiceRepository.save(invoice);
  }

  async markInvoiceAsPaid(invoiceId: string, transactionHash: string): Promise<SubscriptionInvoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    invoice.transactionHash = transactionHash;
    invoice.retryCount = 0;
    invoice.nextRetryAt = null;

    return this.invoiceRepository.save(invoice);
  }

  async markInvoiceAsFailed(invoiceId: string, errorMessage: string): Promise<SubscriptionInvoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    invoice.status = InvoiceStatus.FAILED;
    invoice.failedAt = new Date();
    invoice.errorMessage = errorMessage;
    invoice.retryCount += 1;

    const plan = await this.getPlanForInvoice(invoice);
    const retryIntervalHours = 24; // Default retry interval
    invoice.nextRetryAt = new Date(Date.now() + retryIntervalHours * 60 * 60 * 1000);

    return this.invoiceRepository.save(invoice);
  }

  async voidInvoice(invoiceId: string, reason?: string): Promise<SubscriptionInvoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.REFUNDED) {
      throw new BadRequestException('Cannot void a paid or refunded invoice');
    }

    invoice.status = InvoiceStatus.VOID;
    invoice.voidedAt = new Date();
    invoice.metadata = { ...invoice.metadata, voidReason: reason };

    return this.invoiceRepository.save(invoice);
  }

  async refundInvoice(invoiceId: string, reason?: string): Promise<SubscriptionInvoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Can only refund paid invoices');
    }

    invoice.status = InvoiceStatus.REFUNDED;
    invoice.refundedAt = new Date();
    invoice.metadata = { ...invoice.metadata, refundReason: reason };

    return this.invoiceRepository.save(invoice);
  }

  async calculateLateFee(invoice: SubscriptionInvoice): Promise<number> {
    if (!invoice.dueDate || invoice.status === InvoiceStatus.PAID) {
      return 0;
    }

    const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue <= 0) {
      return 0;
    }

    const plan = await this.getPlanForInvoice(invoice);
    const lateFeePercentage = plan.lateFeePercentage || 0;
    
    return (invoice.total * lateFeePercentage) / 100;
  }

  private async getPlanForInvoice(invoice: SubscriptionInvoice): Promise<SubscriptionPlan> {
    // This would typically fetch from the plan repository
    // For now, returning a mock plan
    return {
      lateFeePercentage: 5,
      maxRetryAttempts: 3,
    } as any;
  }
}
