import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { SubscriptionPlanService } from './subscription-plan.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionInvoiceService } from './subscription-invoice.service';
import { UsageTrackingService } from './usage-tracking.service';
import { DunningService } from './dunning.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { SubscriptionAnalyticsService } from './subscription-analytics.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CancelSubscriptionDto, PauseSubscriptionDto, ResumeSubscriptionDto } from './dto/subscription-action.dto';
import { CreateUsageRecordDto } from './dto/usage-record.dto';
import { RetryInvoicePaymentDto, VoidInvoiceDto } from './dto/invoice.dto';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private planService: SubscriptionPlanService,
    private subscriptionService: SubscriptionService,
    private invoiceService: SubscriptionInvoiceService,
    private usageService: UsageTrackingService,
    private dunningService: DunningService,
    private notificationService: SubscriptionNotificationService,
    private analyticsService: SubscriptionAnalyticsService,
  ) {}

  // ==================== Plan Management ====================

  @Post('plans')
  async createPlan(@Body() createPlanDto: CreatePlanDto, @Request() req) {
    return this.planService.createPlan(req.user.userId, createPlanDto);
  }

  @Get('plans/:planId')
  async getPlan(@Param('planId') planId: string) {
    return this.planService.getPlan(planId);
  }

  @Get('plans')
  async getMerchantPlans(@Request() req, @Query('status') status?: string) {
    return this.planService.getMerchantPlans(req.user.userId, status as any);
  }

  @Put('plans/:planId')
  async updatePlan(
    @Param('planId') planId: string,
    @Body() updatePlanDto: UpdatePlanDto,
    @Request() req,
  ) {
    return this.planService.updatePlan(planId, req.user.userId, updatePlanDto);
  }

  @Post('plans/:planId/archive')
  async archivePlan(@Param('planId') planId: string, @Request() req) {
    return this.planService.archivePlan(planId, req.user.userId);
  }

  @Post('plans/:planId/activate')
  async activatePlan(@Param('planId') planId: string, @Request() req) {
    return this.planService.activatePlan(planId, req.user.userId);
  }

  @Post('plans/:planId/deactivate')
  async deactivatePlan(@Param('planId') planId: string, @Request() req) {
    return this.planService.deactivatePlan(planId, req.user.userId);
  }

  @Delete('plans/:planId')
  async deletePlan(@Param('planId') planId: string, @Request() req) {
    return this.planService.deletePlan(planId, req.user.userId);
  }

  // ==================== Subscription Management ====================

  @Post()
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto, @Request() req) {
    return this.subscriptionService.createSubscription(req.user.userId, createSubscriptionDto);
  }

  @Get(':subscriptionId')
  async getSubscription(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionService.getSubscription(subscriptionId);
  }

  @Get()
  async getMerchantSubscriptions(@Request() req, @Query('status') status?: string) {
    return this.subscriptionService.getMerchantSubscriptions(req.user.userId, status as any);
  }

  @Get('customer/:customerId')
  async getCustomerSubscriptions(@Param('customerId') customerId: string) {
    return this.subscriptionService.getCustomerSubscriptions(customerId);
  }

  @Put(':subscriptionId')
  async updateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionService.updateSubscription(subscriptionId, req.user.userId, updateSubscriptionDto);
  }

  @Post(':subscriptionId/cancel')
  async cancelSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() cancelSubscriptionDto: CancelSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionService.cancelSubscription(subscriptionId, req.user.userId, cancelSubscriptionDto);
  }

  @Post(':subscriptionId/pause')
  async pauseSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() pauseSubscriptionDto: PauseSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionService.pauseSubscription(subscriptionId, req.user.userId, pauseSubscriptionDto);
  }

  @Post(':subscriptionId/resume')
  async resumeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() resumeSubscriptionDto: ResumeSubscriptionDto,
    @Request() req,
  ) {
    return this.subscriptionService.resumeSubscription(subscriptionId, req.user.userId, resumeSubscriptionDto);
  }

  @Post(':subscriptionId/process-payment')
  async processPayment(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionService.processSubscriptionPayment(subscriptionId);
  }

  // ==================== Invoice Management ====================

  @Get(':subscriptionId/invoices')
  async getSubscriptionInvoices(@Param('subscriptionId') subscriptionId: string) {
    return this.invoiceService.getSubscriptionInvoices(subscriptionId);
  }

  @Get('invoices/:invoiceId')
  async getInvoice(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getInvoice(invoiceId);
  }

  @Get('invoices')
  async getMerchantInvoices(@Request() req, @Query('status') status?: string) {
    return this.invoiceService.getMerchantInvoices(req.user.userId, status as any);
  }

  @Get('invoices/customer/:customerId')
  async getCustomerInvoices(@Param('customerId') customerId: string) {
    return this.invoiceService.getCustomerInvoices(customerId);
  }

  @Post('invoices/:invoiceId/retry')
  async retryInvoicePayment(
    @Param('invoiceId') invoiceId: string,
    @Body() retryDto: RetryInvoicePaymentDto,
  ) {
    const invoice = await this.invoiceService.markInvoiceAsProcessing(invoiceId);
    // Payment processing logic would go here
    return invoice;
  }

  @Post('invoices/:invoiceId/void')
  async voidInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body() voidDto: VoidInvoiceDto,
  ) {
    return this.invoiceService.voidInvoice(invoiceId, voidDto.reason);
  }

  @Post('invoices/:invoiceId/refund')
  async refundInvoice(@Param('invoiceId') invoiceId: string, @Body('reason') reason?: string) {
    return this.invoiceService.refundInvoice(invoiceId, reason);
  }

  // ==================== Usage Tracking ====================

  @Post('usage')
  async recordUsage(@Body() createUsageDto: CreateUsageRecordDto) {
    return this.usageService.recordUsage(createUsageDto);
  }

  @Post('usage/batch')
  async recordUsageBatch(@Body() usageRecords: CreateUsageRecordDto[]) {
    return this.usageService.recordUsageBatch(usageRecords);
  }

  @Get(':subscriptionId/usage')
  async getUsageRecords(
    @Param('subscriptionId') subscriptionId: string,
    @Query('metricId') metricId?: string,
  ) {
    return this.usageService.getUsageRecords(subscriptionId, metricId);
  }

  @Get(':subscriptionId/usage/summary')
  async getUsageSummary(@Param('subscriptionId') subscriptionId: string) {
    return this.usageService.getUsageSummary(subscriptionId);
  }

  @Get(':subscriptionId/usage/check-limit')
  async checkUsageLimit(
    @Param('subscriptionId') subscriptionId: string,
    @Query('metricId') metricId: string,
    @Query('additionalQuantity') additionalQuantity: string,
  ) {
    return this.usageService.checkUsageLimits(
      subscriptionId,
      metricId,
      parseFloat(additionalQuantity),
    );
  }

  @Delete('usage/:usageId')
  async deleteUsageRecord(@Param('usageId') usageId: string) {
    return this.usageService.deleteUsageRecord(usageId);
  }

  // ==================== Dunning Management ====================

  @Get(':subscriptionId/dunning')
  async getDunningRecords(
    @Param('subscriptionId') subscriptionId: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.dunningService.getDunningRecords(subscriptionId, invoiceId);
  }

  @Post('dunning/:dunningId/process')
  async processDunningRecord(@Param('dunningId') dunningId: string) {
    return this.dunningService.processDunningRecord(dunningId);
  }

  @Post('dunning/:dunningId/escalate')
  async escalateDunningRecord(@Param('dunningId') dunningId: string) {
    return this.dunningService.escalateDunningRecord(dunningId);
  }

  // ==================== Webhook Testing ====================

  @Post('webhooks/test')
  async testWebhook(@Request() req, @Body('webhookUrl') webhookUrl: string) {
    return this.notificationService.sendTestWebhook(req.user.userId, webhookUrl);
  }

  // ==================== Analytics ====================

  @Get('analytics/metrics')
  async getSubscriptionMetrics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.analyticsService.getSubscriptionMetrics(req.user.userId, start, end);
  }

  @Get('analytics/revenue')
  async getRevenueMetrics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.analyticsService.getRevenueMetrics(req.user.userId, start, end);
  }

  @Get('analytics/plans')
  async getPlanMetrics(@Request() req) {
    return this.analyticsService.getPlanMetrics(req.user.userId);
  }

  @Get('analytics/trends')
  async getSubscriptionTrends(@Request() req, @Query('days') days?: string) {
    return this.analyticsService.getSubscriptionTrends(req.user.userId, days ? parseInt(days) : 30);
  }

  @Get('analytics/lifetime-value')
  async getCustomerLifetimeValue(@Request() req) {
    return this.analyticsService.getCustomerLifetimeValue(req.user.userId);
  }
}
