import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { WebhookService } from './webhook/webhook.service';
import { EmailService } from './email/email.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { SendEmailDto } from './dto/send-email.dto';

@Controller('notifications')
export class NotificationServiceController {
  constructor(
    private webhookService: WebhookService,
    private emailService: EmailService,
  ) {}

  // ==================== Webhook Management ====================

  @Post('webhooks/register')
  async registerWebhook(@Body() dto: RegisterWebhookDto, @Request() req) {
    return this.webhookService.registerWebhook({ ...dto, merchantId: req.user.userId });
  }

  @Get('webhooks/:webhookId')
  async getWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookService.getWebhook(webhookId);
  }

  @Get('webhooks')
  async getMerchantWebhooks(@Request() req, @Query('status') status?: string) {
    return this.webhookService.getMerchantWebhooks(req.user.userId, status as any);
  }

  @Put('webhooks/:webhookId')
  async updateWebhook(
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.updateWebhook(webhookId, dto);
  }

  @Delete('webhooks/:webhookId')
  async deleteWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookService.deleteWebhook(webhookId);
  }

  @Post('webhooks/:webhookId/disable')
  async disableWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookService.disableWebhook(webhookId);
  }

  @Post('webhooks/:webhookId/enable')
  async enableWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookService.enableWebhook(webhookId);
  }

  @Post('webhooks/:webhookId/regenerate-secret')
  async regenerateSecret(@Param('webhookId') webhookId: string) {
    return this.webhookService.regenerateSecret(webhookId);
  }

  @Get('webhooks/:webhookId/deliveries')
  async getWebhookDeliveries(
    @Param('webhookId') webhookId: string,
    @Query('status') status?: string,
  ) {
    return this.webhookService.getWebhookDeliveries(webhookId, status as any);
  }

  @Get('webhooks/:webhookId/stats')
  async getWebhookStats(@Param('webhookId') webhookId: string) {
    return this.webhookService.getWebhookStats(webhookId);
  }

  @Get('deliveries/:deliveryId')
  async getDeliveryStatus(@Param('deliveryId') deliveryId: string) {
    return this.webhookService.getDeliveryStatus(deliveryId);
  }

  @Get('deliveries')
  async getMerchantDeliveries(@Request() req, @Query('eventType') eventType?: string) {
    return this.webhookService.getMerchantDeliveries(req.user.userId, eventType);
  }

  // ==================== Email Management ====================

  @Post('email/send')
  async sendEmail(@Body() dto: SendEmailDto, @Request() req) {
    return this.emailService.sendEmail({ ...dto, merchantId: req.user.userId });
  }

  @Post('email/bulk')
  async sendBulkEmail(@Body() emails: SendEmailDto[], @Request() req) {
    const emailsWithMerchantId = emails.map(e => ({ ...e, merchantId: req.user.userId }));
    return this.emailService.sendBulkEmail(emailsWithMerchantId);
  }

  @Get('email/:emailId')
  async getEmailLog(@Param('emailId') emailId: string) {
    return this.emailService.getEmailLog(emailId);
  }

  @Get('email')
  async getMerchantEmails(@Request() req, @Query('status') status?: string) {
    return this.emailService.getMerchantEmails(req.user.userId, status as any);
  }

  @Get('email/stats')
  async getEmailStats(@Request() req) {
    return this.emailService.getEmailStats(req.user.userId);
  }

  // ==================== Event Triggering ====================

  @Post('events/trigger')
  async triggerEvent(@Body('eventType') eventType: string, @Body('payload') payload: Record<string, any>) {
    await this.webhookService.sendWebhook(eventType, payload);
    return { success: true, message: 'Event triggered' };
  }

  @Post('events/payment-created')
  async triggerPaymentCreated(@Body() payload: Record<string, any>) {
    await this.webhookService.sendWebhook('payment.created', payload);
    return { success: true };
  }

  @Post('events/payment-confirmed')
  async triggerPaymentConfirmed(@Body() payload: Record<string, any>) {
    await this.webhookService.sendWebhook('payment.confirmed', payload);
    return { success: true };
  }

  @Post('events/payment-failed')
  async triggerPaymentFailed(@Body() payload: Record<string, any>) {
    await this.webhookService.sendWebhook('payment.failed', payload);
    return { success: true };
  }

  @Post('events/escrow-created')
  async triggerEscrowCreated(@Body() payload: Record<string, any>) {
    await this.webhookService.sendWebhook('escrow.created', payload);
    return { success: true };
  }

  @Post('events/subscription-billed')
  async triggerSubscriptionBilled(@Body() payload: Record<string, any>) {
    await this.webhookService.sendWebhook('subscription.billed', payload);
    return { success: true };
  }
}
