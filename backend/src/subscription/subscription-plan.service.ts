import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionPlan, PlanStatus, BillingInterval } from './entities/subscription-plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
  ) {}

  async createPlan(merchantId: string, createPlanDto: CreatePlanDto): Promise<SubscriptionPlan> {
    const plan = this.planRepository.create({
      planId: uuidv4(),
      merchantId,
      ...createPlanDto,
      status: PlanStatus.ACTIVE,
    });

    return this.planRepository.save(plan);
  }

  async getPlan(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  async getMerchantPlans(merchantId: string, status?: PlanStatus): Promise<SubscriptionPlan[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    return this.planRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async updatePlan(planId: string, merchantId: string, updatePlanDto: UpdatePlanDto): Promise<SubscriptionPlan> {
    const plan = await this.getPlan(planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to update this plan');
    }

    Object.assign(plan, updatePlanDto);
    return this.planRepository.save(plan);
  }

  async archivePlan(planId: string, merchantId: string): Promise<SubscriptionPlan> {
    const plan = await this.getPlan(planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to archive this plan');
    }

    plan.status = PlanStatus.ARCHIVED;
    return this.planRepository.save(plan);
  }

  async activatePlan(planId: string, merchantId: string): Promise<SubscriptionPlan> {
    const plan = await this.getPlan(planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to activate this plan');
    }

    plan.status = PlanStatus.ACTIVE;
    return this.planRepository.save(plan);
  }

  async deactivatePlan(planId: string, merchantId: string): Promise<SubscriptionPlan> {
    const plan = await this.getPlan(planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to deactivate this plan');
    }

    plan.status = PlanStatus.INACTIVE;
    return this.planRepository.save(plan);
  }

  async deletePlan(planId: string, merchantId: string): Promise<void> {
    const plan = await this.getPlan(planId);
    
    if (plan.merchantId !== merchantId) {
      throw new BadRequestException('You do not have permission to delete this plan');
    }

    await this.planRepository.remove(plan);
  }

  calculateNextBillingDate(currentDate: Date, interval: BillingInterval, cycleCount: number = 1): Date {
    const nextDate = new Date(currentDate);
    
    switch (interval) {
      case BillingInterval.DAILY:
        nextDate.setDate(nextDate.getDate() + cycleCount);
        break;
      case BillingInterval.WEEKLY:
        nextDate.setDate(nextDate.getDate() + (7 * cycleCount));
        break;
      case BillingInterval.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + cycleCount);
        break;
      case BillingInterval.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + cycleCount);
        break;
    }
    
    return nextDate;
  }

  calculateProration(
    oldPlanAmount: number,
    newPlanAmount: number,
    daysInPeriod: number,
    daysRemaining: number,
    isUpgrade: boolean,
  ): number {
    const dailyRateOld = oldPlanAmount / daysInPeriod;
    const dailyRateNew = newPlanAmount / daysInPeriod;
    
    const unusedDaysValue = dailyRateOld * daysRemaining;
    const newDaysValue = dailyRateNew * daysRemaining;
    
    if (isUpgrade) {
      return newDaysValue - unusedDaysValue;
    } else {
      return unusedDaysValue - newDaysValue;
    }
  }
}
