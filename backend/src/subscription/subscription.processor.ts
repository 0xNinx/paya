import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SubscriptionService } from './subscription.service';
import { DunningService } from './dunning.service';

@Processor('subscription-payments')
export class SubscriptionProcessor {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private dunningService: DunningService,
  ) {}

  @Process('process-payment')
  async handlePaymentProcess(job: Job<{ subscriptionId: string }>) {
    this.logger.log(`Processing payment for subscription: ${job.data.subscriptionId}`);
    
    try {
      const invoice = await this.subscriptionService.processSubscriptionPayment(job.data.subscriptionId);
      this.logger.log(`Payment processed successfully for subscription: ${job.data.subscriptionId}`);
      return invoice;
    } catch (error) {
      this.logger.error(`Payment processing failed for subscription: ${job.data.subscriptionId}`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}. Result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}. Error: ${error.message}`, error.stack);
  }
}

@Processor('subscription-trials')
export class TrialProcessor {
  private readonly logger = new Logger(TrialProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {}

  @Process('end-trial')
  async handleTrialEnd(job: Job<{ subscriptionId: string }>) {
    this.logger.log(`Ending trial for subscription: ${job.data.subscriptionId}`);
    
    try {
      await this.subscriptionService.handleTrialEnd(job.data.subscriptionId);
      this.logger.log(`Trial ended successfully for subscription: ${job.data.subscriptionId}`);
    } catch (error) {
      this.logger.error(`Trial end failed for subscription: ${job.data.subscriptionId}`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing trial job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed trial job ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed trial job ${job.id}: ${error.message}`, error.stack);
  }
}

@Processor('subscription-resume')
export class ResumeProcessor {
  private readonly logger = new Logger(ResumeProcessor.name);

  constructor(private subscriptionService: SubscriptionService) {}

  @Process('resume-subscription')
  async handleResume(job: Job<{ subscriptionId: string }>) {
    this.logger.log(`Resuming subscription: ${job.data.subscriptionId}`);
    
    try {
      await this.subscriptionService.resumeSubscription(
        job.data.subscriptionId,
        'system',
        {},
      );
      this.logger.log(`Subscription resumed successfully: ${job.data.subscriptionId}`);
    } catch (error) {
      this.logger.error(`Resume failed for subscription: ${job.data.subscriptionId}`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing resume job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed resume job ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed resume job ${job.id}: ${error.message}`, error.stack);
  }
}
