import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionPlan, BillingInterval } from './entities/subscription-plan.entity';
import { SubscriptionInvoice, InvoiceStatus, InvoiceType } from './entities/subscription-invoice.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CancelSubscriptionDto, PauseSubscriptionDto, ResumeSubscriptionDto } from './dto/subscription-action.dto';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SubscriptionNotificationService } from './subscription-notification.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    private planService: SubscriptionPlanService,
    private invoiceService: SubscriptionInvoiceService,
    private schedulerService: SubscriptionSchedulerService,
    private notificationService: SubscriptionNotificationService,
  ) {}

  async createSubscription(merchantId: string, createSubscriptionDto: CreateSubscriptionDto): Promise<Subscription> {
    const plan = await this.planService.getPlan(createSubscriptionDto.planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('Plan does not belong to this merchant');
    }

    if (plan.status !== 'ACTIVE') {
      throw new BadRequestException('Plan is not active');
    }

    const now = new Date();
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let currentPeriodStart = now;
    let currentPeriodEnd = this.planService.calculateNextBillingDate(now, plan.billingInterval);
    let status = SubscriptionStatus.ACTIVE;

    if (createSubscriptionDto.trialPeriod && plan.trialPeriodDays) {
      trialStart = now;
      trialEnd = new Date(now.getTime() + plan.trialPeriodDays * 24 * 60 * 60 * 1000);
      currentPeriodStart = trialEnd;
      currentPeriodEnd = this.planService.calculateNextBillingDate(trialEnd, plan.billingInterval);
      status = SubscriptionStatus.TRIALING;
    }

    const subscription = this.subscriptionRepository.create({
      subscriptionId: uuidv4(),
      merchantId,
      customerId: createSubscriptionDto.customerId,
      customerEmail: createSubscriptionDto.customerEmail,
      planId: plan.planId,
      plan,
      status,
      currentAmount: plan.amount,
      currency: plan.currency,
      trialStart,
      trialEnd,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: createSubscriptionDto.cancelAtPeriodEnd || false,
      nextPaymentAt: currentPeriodEnd,
      billingCycleCount: 0,
      metadata: createSubscriptionDto.metadata,
      customFields: createSubscriptionDto.customFields,
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    if (status === SubscriptionStatus.ACTIVE) {
      await this.schedulerService.scheduleNextPayment(savedSubscription.subscriptionId, currentPeriodEnd);
    } else {
      await this.schedulerService.scheduleTrialEnd(savedSubscription.subscriptionId, trialEnd!);
    }

    await this.notificationService.sendSubscriptionEvent('subscription.created', savedSubscription);

    return savedSubscription;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({ 
      where: { subscriptionId },
      relations: ['plan']
    });
    
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    
    return subscription;
  }

  async getMerchantSubscriptions(merchantId: string, status?: SubscriptionStatus): Promise<Subscription[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    
    return this.subscriptionRepository.find({ 
      where, 
      relations: ['plan'],
      order: { createdAt: 'DESC' }
    });
  }

  async getCustomerSubscriptions(customerId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({ 
      where: { customerId },
      relations: ['plan'],
      order: { createdAt: 'DESC' }
    });
  }

  async updateSubscription(
    subscriptionId: string, 
    merchantId: string, 
    updateSubscriptionDto: UpdateSubscriptionDto
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    
    if (subscription.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to update this subscription');
    }

    if (updateSubscriptionDto.planId && updateSubscriptionDto.planId !== subscription.planId) {
      await this.changePlan(subscription, updateSubscriptionDto.planId);
    }

    if (updateSubscriptionDto.cancelAtPeriodEnd !== undefined) {
      subscription.cancelAtPeriodEnd = updateSubscriptionDto.cancelAtPeriodEnd;
    }

    if (updateSubscriptionDto.status) {
      subscription.status = updateSubscriptionDto.status;
    }

    if (updateSubscriptionDto.paymentMethodId) {
      subscription.customFields = { ...subscription.customFields, paymentMethodId: updateSubscriptionDto.paymentMethodId };
    }

    if (updateSubscriptionDto.metadata) {
      subscription.metadata = { ...subscription.metadata, ...updateSubscriptionDto.metadata };
    }

    const updatedSubscription = await this.subscriptionRepository.save(subscription);
    await this.notificationService.sendSubscriptionEvent('subscription.updated', updatedSubscription);

    return updatedSubscription;
  }

  async changePlan(subscription: Subscription, newPlanId: string): Promise<void> {
    const oldPlan = subscription.plan;
    const newPlan = await this.planService.getPlan(newPlanId);

    const isUpgrade = newPlan.amount > oldPlan.amount;
    const daysInPeriod = this.getDaysBetween(subscription.currentPeriodStart, subscription.currentPeriodEnd);
    const daysRemaining = this.getDaysBetween(new Date(), subscription.currentPeriodEnd);

    let proratedAmount = 0;
    if (oldPlan.prorateOnUpgrade && isUpgrade) {
      proratedAmount = this.planService.calculateProration(
        oldPlan.amount,
        newPlan.amount,
        daysInPeriod,
        daysRemaining,
        true,
      );
    } else if (oldPlan.prorateOnDowngrade && !isUpgrade) {
      proratedAmount = this.planService.calculateProration(
        oldPlan.amount,
        newPlan.amount,
        daysInPeriod,
        daysRemaining,
        false,
      );
    }

    if (proratedAmount > 0) {
      await this.invoiceService.createProrationInvoice(subscription, oldPlan, newPlan, proratedAmount);
    }

    subscription.planId = newPlanId;
    subscription.plan = newPlan;
    subscription.currentAmount = newPlan.amount;
    subscription.currency = newPlan.currency;
  }

  async cancelSubscription(
    subscriptionId: string, 
    merchantId: string, 
    cancelSubscriptionDto: CancelSubscriptionDto
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    
    if (subscription.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to cancel this subscription');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    if (cancelSubscriptionDto.cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelAt = subscription.currentPeriodEnd;
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.canceledAt = new Date();
      await this.schedulerService.cancelScheduledPayments(subscriptionId);
    }

    const updatedSubscription = await this.subscriptionRepository.save(subscription);
    await this.notificationService.sendSubscriptionEvent('subscription.cancelled', updatedSubscription);

    return updatedSubscription;
  }

  async pauseSubscription(
    subscriptionId: string, 
    merchantId: string, 
    pauseSubscriptionDto: PauseSubscriptionDto
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    
    if (subscription.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to pause this subscription');
    }

    if (subscription.status === SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription is already paused');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot pause a cancelled subscription');
    }

    subscription.status = SubscriptionStatus.PAUSED;
    subscription.pausedAt = new Date();
    
    if (pauseSubscriptionDto.resumeAt) {
      subscription.resumeAt = new Date(pauseSubscriptionDto.resumeAt);
      await this.schedulerService.scheduleResume(subscriptionId, subscription.resumeAt);
    }

    await this.schedulerService.cancelScheduledPayments(subscriptionId);

    const updatedSubscription = await this.subscriptionRepository.save(subscription);
    await this.notificationService.sendSubscriptionEvent('subscription.paused', updatedSubscription);

    return updatedSubscription;
  }

  async resumeSubscription(
    subscriptionId: string, 
    merchantId: string, 
    resumeSubscriptionDto: ResumeSubscriptionDto
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    
    if (subscription.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to resume this subscription');
    }

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription is not paused');
    }

    const resumeDate = resumeSubscriptionDto.resumeAt 
      ? new Date(resumeSubscriptionDto.resumeAt) 
      : new Date();

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.resumeAt = null;
    subscription.currentPeriodStart = resumeDate;
    subscription.currentPeriodEnd = this.planService.calculateNextBillingDate(
      resumeDate, 
      subscription.plan.billingInterval
    );
    subscription.nextPaymentAt = subscription.currentPeriodEnd;

    const updatedSubscription = await this.subscriptionRepository.save(subscription);
    await this.schedulerService.scheduleNextPayment(subscriptionId, subscription.currentPeriodEnd);
    await this.notificationService.sendSubscriptionEvent('subscription.resumed', updatedSubscription);

    return updatedSubscription;
  }

  async processSubscriptionPayment(subscriptionId: string): Promise<SubscriptionInvoice> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status === SubscriptionStatus.CANCELLED || subscription.status === SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Cannot process payment for inactive subscription');
    }

    const invoice = await this.invoiceService.createRecurringInvoice(subscription);

    subscription.billingCycleCount += 1;
    subscription.currentPeriodStart = subscription.currentPeriodEnd;
    subscription.currentPeriodEnd = this.planService.calculateNextBillingDate(
      subscription.currentPeriodEnd,
      subscription.plan.billingInterval
    );
    subscription.nextPaymentAt = subscription.currentPeriodEnd;

    await this.subscriptionRepository.save(subscription);

    if (subscription.cancelAtPeriodEnd) {
      await this.cancelSubscription(subscriptionId, subscription.merchantId, { cancelAtPeriodEnd: false });
    } else {
      await this.schedulerService.scheduleNextPayment(subscriptionId, subscription.currentPeriodEnd);
    }

    return invoice;
  }

  async handleTrialEnd(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    
    if (subscription.status !== SubscriptionStatus.TRIALING) {
      return;
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.currentPeriodStart = subscription.trialEnd || new Date();
    subscription.currentPeriodEnd = this.planService.calculateNextBillingDate(
      subscription.currentPeriodStart,
      subscription.plan.billingInterval
    );
    subscription.nextPaymentAt = subscription.currentPeriodEnd;

    await this.subscriptionRepository.save(subscription);
    await this.schedulerService.scheduleNextPayment(subscriptionId, subscription.currentPeriodEnd);
    await this.notificationService.sendSubscriptionEvent('subscription.trial_ended', subscription);
  }

  async handlePaymentFailure(subscriptionId: string, invoiceId: string, errorMessage: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    
    subscription.failedPaymentCount += 1;
    subscription.status = SubscriptionStatus.PAST_DUE;

    await this.subscriptionRepository.save(subscription);

    await this.notificationService.sendSubscriptionEvent('subscription.payment_failed', subscription, {
      invoiceId,
      errorMessage,
      attemptCount: subscription.failedPaymentCount,
    });

    if (subscription.failedPaymentCount >= subscription.plan.maxRetryAttempts) {
      await this.cancelSubscription(subscriptionId, subscription.merchantId, { cancelAtPeriodEnd: false });
    }
  }

  async handlePaymentSuccess(subscriptionId: string, invoiceId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    
    subscription.failedPaymentCount = 0;
    subscription.lastPaymentAt = new Date();
    
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      subscription.status = SubscriptionStatus.ACTIVE;
    }

    await this.subscriptionRepository.save(subscription);
    await this.notificationService.sendSubscriptionEvent('subscription.payment_succeeded', subscription, { invoiceId });
  }

  private getDaysBetween(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
