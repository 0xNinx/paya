import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog, EmailStatus } from '../entities/email-log.entity';
import { EmailService } from './email.service';

@Processor('email-delivery')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
    private emailService: EmailService,
  ) {}

  @Process('send-email')
  async handleEmailDelivery(job: Job<{
    emailId: string;
    recipientEmail: string;
    recipientName: string;
    template: string;
    templateData: Record<string, any>;
    subject?: string;
  }>) {
    const { emailId, recipientEmail, template, templateData } = job.data;

    this.logger.log(`Processing email delivery ${emailId} to ${recipientEmail}`);

    try {
      // Render email template
      const { subject, html, text } = await this.renderTemplate(template, templateData);

      // Send email (integrate with your email provider like SendGrid, SES, etc.)
      const providerMessageId = await this.sendEmailViaProvider(
        recipientEmail,
        subject,
        html,
        text,
      );

      await this.emailService.markEmailAsSent(emailId, providerMessageId, 'sendgrid');

      this.logger.log(`Email ${emailId} sent successfully`);
      return { success: true, providerMessageId };

    } catch (error) {
      await this.emailService.markEmailAsFailed(emailId, error.message);
      this.logger.error(`Email ${emailId} failed: ${error.message}`);
      throw error;
    }
  }

  private async renderTemplate(template: string, data: Record<string, any>): Promise<{
    subject: string;
    html: string;
    text: string;
  }> {
    // This would integrate with a template engine like Handlebars, EJS, etc.
    // For now, return a basic template
    const templates: Record<string, (data: any) => { subject: string; html: string; text: string }> = {
      payment_confirmation: (d) => ({
        subject: `Payment Confirmation - ${d.paymentId}`,
        html: `
          <h2>Payment Confirmation</h2>
          <p>Your payment of ${d.amount} ${d.currency} has been confirmed.</p>
          <p>Payment ID: ${d.paymentId}</p>
          <p>Transaction Hash: ${d.transactionHash}</p>
        `,
        text: `Your payment of ${d.amount} ${d.currency} has been confirmed. Payment ID: ${d.paymentId}`,
      }),
      payment_failed: (d) => ({
        subject: `Payment Failed - ${d.paymentId}`,
        html: `
          <h2>Payment Failed</h2>
          <p>Your payment of ${d.amount} ${d.currency} has failed.</p>
          <p>Reason: ${d.reason}</p>
          <p>Please try again or contact support.</p>
        `,
        text: `Your payment of ${d.amount} ${d.currency} has failed. Reason: ${d.reason}`,
      }),
      escrow_created: (d) => ({
        subject: `Escrow Created - ${d.escrowId}`,
        html: `
          <h2>Escrow Created</h2>
          <p>An escrow of ${d.amount} ${d.currency} has been created.</p>
          <p>Escrow ID: ${d.escrowId}</p>
        `,
        text: `An escrow of ${d.amount} ${d.currency} has been created. Escrow ID: ${d.escrowId}`,
      }),
      subscription_billed: (d) => ({
        subject: `Subscription Billed - ${d.subscriptionId}`,
        html: `
          <h2>Subscription Billed</h2>
          <p>Your subscription has been billed ${d.amount} ${d.currency}.</p>
          <p>Subscription ID: ${d.subscriptionId}</p>
          <p>Next billing date: ${d.nextBillingDate}</p>
        `,
        text: `Your subscription has been billed ${d.amount} ${d.currency}. Next billing date: ${d.nextBillingDate}`,
      }),
      daily_summary: (d) => ({
        subject: `Daily Payment Summary - ${d.date}`,
        html: `
          <h2>Daily Payment Summary</h2>
          <p>Total payments: ${d.totalPayments}</p>
          <p>Total amount: ${d.totalAmount} ${d.currency}</p>
        `,
        text: `Daily summary: ${d.totalPayments} payments totaling ${d.totalAmount} ${d.currency}`,
      }),
    };

    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Template ${template} not found`);
    }

    return templateFn(data);
  }

  private async sendEmailViaProvider(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<string> {
    // Integrate with your email provider (SendGrid, AWS SES, Mailgun, etc.)
    // This is a placeholder - implement actual email sending
    this.logger.log(`Sending email to ${to} via provider`);
    
    // Example SendGrid integration:
    // const sgMail = require('@sendgrid/mail');
    // await sgMail.send({
    //   to,
    //   from: process.env.EMAIL_FROM,
    //   subject,
    //   html,
    //   text,
    // });
    
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing email job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Completed email job ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed email job ${job.id}: ${error.message}`);
  }
}
