import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    @InjectQueue('subscription-payments')
    private paymentQueue: Queue,
    @InjectQueue('subscription-trials')
    private trialQueue: Queue,
    @InjectQueue('subscription-resume')
    private resumeQueue: Queue,
  ) {}

  async scheduleNextPayment(subscriptionId: string, paymentDate: Date): Promise<void> {
    try {
      const delay = paymentDate.getTime() - Date.now();
      
      if (delay > 0) {
        await this.paymentQueue.add(
          'process-payment',
          { subscriptionId },
          {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // 1 minute
            },
            removeOnComplete: 10,
            removeOnFail: 50,
          },
        );
        
        this.logger.log(`Scheduled payment for subscription ${subscriptionId} at ${paymentDate}`);
      }
    } catch (error) {
      this.logger.error(`Failed to schedule payment for subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async scheduleTrialEnd(subscriptionId: string, trialEndDate: Date): Promise<void> {
    try {
      const delay = trialEndDate.getTime() - Date.now();
      
      if (delay > 0) {
        await this.trialQueue.add(
          'end-trial',
          { subscriptionId },
          {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000,
            },
            removeOnComplete: 10,
            removeOnFail: 50,
          },
        );
        
        this.logger.log(`Scheduled trial end for subscription ${subscriptionId} at ${trialEndDate}`);
      }
    } catch (error) {
      this.logger.error(`Failed to schedule trial end for subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async scheduleResume(subscriptionId: string, resumeDate: Date): Promise<void> {
    try {
      const delay = resumeDate.getTime() - Date.now();
      
      if (delay > 0) {
        await this.resumeQueue.add(
          'resume-subscription',
          { subscriptionId },
          {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000,
            },
            removeOnComplete: 10,
            removeOnFail: 50,
          },
        );
        
        this.logger.log(`Scheduled resume for subscription ${subscriptionId} at ${resumeDate}`);
      }
    } catch (error) {
      this.logger.error(`Failed to schedule resume for subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  async cancelScheduledPayments(subscriptionId: string): Promise<void> {
    try {
      const jobs = await this.paymentQueue.getJobs(['waiting', 'delayed']);
      
      for (const job of jobs) {
        if (job.data.subscriptionId === subscriptionId) {
          await job.remove();
          this.logger.log(`Cancelled scheduled payment for subscription ${subscriptionId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled payments for subscription ${subscriptionId}:`, error);
    }
  }

  async cancelScheduledTrialEnd(subscriptionId: string): Promise<void> {
    try {
      const jobs = await this.trialQueue.getJobs(['waiting', 'delayed']);
      
      for (const job of jobs) {
        if (job.data.subscriptionId === subscriptionId) {
          await job.remove();
          this.logger.log(`Cancelled scheduled trial end for subscription ${subscriptionId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled trial end for subscription ${subscriptionId}:`, error);
    }
  }

  async cancelScheduledResume(subscriptionId: string): Promise<void> {
    try {
      const jobs = await this.resumeQueue.getJobs(['waiting', 'delayed']);
      
      for (const job of jobs) {
        if (job.data.subscriptionId === subscriptionId) {
          await job.remove();
          this.logger.log(`Cancelled scheduled resume for subscription ${subscriptionId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled resume for subscription ${subscriptionId}:`, error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncScheduledPayments(): Promise<void> {
    this.logger.log('Running scheduled payment sync...');
    
    try {
      const waitingJobs = await this.paymentQueue.getJobs(['waiting', 'delayed']);
      this.logger.log(`Found ${waitingJobs.length} waiting/delayed payment jobs`);
      
      const trialJobs = await this.trialQueue.getJobs(['waiting', 'delayed']);
      this.logger.log(`Found ${trialJobs.length} waiting/delayed trial jobs`);
      
      const resumeJobs = await this.resumeQueue.getJobs(['waiting', 'delayed']);
      this.logger.log(`Found ${resumeJobs.length} waiting/delayed resume jobs`);
    } catch (error) {
      this.logger.error('Error during scheduled payment sync:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldJobs(): Promise<void> {
    this.logger.log('Cleaning up old completed/failed jobs...');
    
    try {
      await this.paymentQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'); // Clean jobs older than 7 days
      await this.paymentQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      await this.trialQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
      await this.trialQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      await this.resumeQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
      await this.resumeQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      
      this.logger.log('Job cleanup completed');
    } catch (error) {
      this.logger.error('Error during job cleanup:', error);
    }
  }
}
