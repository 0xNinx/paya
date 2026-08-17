import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmailLog, EmailStatus } from '../entities/email-log.entity';
import { SendEmailDto } from '../dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
    @InjectQueue('email-delivery')
    private emailQueue: Queue,
  ) {}

  async sendEmail(dto: SendEmailDto): Promise<EmailLog> {
    const emailLog = this.emailLogRepository.create({
      ...dto,
      status: EmailStatus.PENDING,
      retryCount: 0,
    });

    const saved = await this.emailLogRepository.save(emailLog);

    await this.emailQueue.add(
      'send-email',
      {
        emailId: saved.id,
        recipientEmail: dto.recipientEmail,
        recipientName: dto.recipientName,
        template: dto.template,
        templateData: dto.templateData,
        subject: dto.subject,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(`Queued email for ${dto.recipientEmail} using template ${dto.template}`);
    return saved;
  }

  async sendBulkEmail(emails: SendEmailDto[]): Promise<EmailLog[]> {
    const savedLogs = [];
    for (const email of emails) {
      const log = await this.sendEmail(email);
      savedLogs.push(log);
    }
    return savedLogs;
  }

  async getEmailLog(emailId: string): Promise<EmailLog> {
    const log = await this.emailLogRepository.findOne({ where: { id: emailId } });
    if (!log) {
      throw new NotFoundException('Email log not found');
    }
    return log;
  }

  async getMerchantEmails(merchantId: string, status?: EmailStatus): Promise<EmailLog[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    return this.emailLogRepository.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async getEmailStats(merchantId: string): Promise<{
    totalEmails: number;
    sentEmails: number;
    deliveredEmails: number;
    failedEmails: number;
    bouncedEmails: number;
    openRate: number;
    clickRate: number;
  }> {
    const emails = await this.emailLogRepository.find({ where: { merchantId } });

    const sent = emails.filter(e => e.status === EmailStatus.SENT || e.status === EmailStatus.DELIVERED);
    const delivered = emails.filter(e => e.status === EmailStatus.DELIVERED);
    const failed = emails.filter(e => e.status === EmailStatus.FAILED);
    const bounced = emails.filter(e => e.status === EmailStatus.BOUNCED);

    const opened = emails.filter(e => e.openedAt !== null);
    const clicked = emails.filter(e => e.clickedAt !== null);

    const openRate = sent.length > 0 ? (opened.length / sent.length) * 100 : 0;
    const clickRate = sent.length > 0 ? (clicked.length / sent.length) * 100 : 0;

    return {
      totalEmails: emails.length,
      sentEmails: sent.length,
      deliveredEmails: delivered.length,
      failedEmails: failed.length,
      bouncedEmails: bounced.length,
      openRate,
      clickRate,
    };
  }

  async markEmailAsSent(emailId: string, providerMessageId: string, provider: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    log.status = EmailStatus.SENT;
    log.provider = provider;
    log.providerMessageId = providerMessageId;
    log.sentAt = new Date();
    await this.emailLogRepository.save(log);
  }

  async markEmailAsDelivered(emailId: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    log.status = EmailStatus.DELIVERED;
    log.deliveredAt = new Date();
    await this.emailLogRepository.save(log);
  }

  async markEmailAsFailed(emailId: string, errorMessage: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    log.status = EmailStatus.FAILED;
    log.errorMessage = errorMessage;
    log.retryCount += 1;
    await this.emailLogRepository.save(log);
  }

  async markEmailAsBounced(emailId: string, errorMessage: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    log.status = EmailStatus.BOUNCED;
    log.errorMessage = errorMessage;
    await this.emailLogRepository.save(log);
  }

  async markEmailAsOpened(emailId: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    if (!log.openedAt) {
      log.openedAt = new Date();
      await this.emailLogRepository.save(log);
    }
  }

  async markEmailAsClicked(emailId: string): Promise<void> {
    const log = await this.getEmailLog(emailId);
    if (!log.clickedAt) {
      log.clickedAt = new Date();
      await this.emailLogRepository.save(log);
    }
  }
}
