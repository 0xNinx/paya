import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway } from './payment.gateway';
import { PaymentWebSocketService } from './payment-websocket.service';

@Injectable()
export class PaymentBroadcastService {
  private readonly logger = new Logger(PaymentBroadcastService.name);

  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly paymentWebSocketService: PaymentWebSocketService,
  ) {}

  broadcastPaymentStatus(paymentId: string, statusData: any) {
    this.logger.log(`Broadcasting status update for payment ${paymentId}: ${statusData.status}`);
    
    // Broadcast to all clients watching this payment
    this.paymentGateway.broadcastPaymentStatus(paymentId, statusData);
  }

  broadcastPaymentCreated(paymentData: any) {
    this.logger.log(`Broadcasting payment created: ${paymentData.paymentId}`);
    
    this.paymentGateway.broadcastPaymentStatus(paymentData.paymentId, {
      type: 'created',
      ...paymentData,
    });
  }

  broadcastPaymentUpdated(paymentId: string, updateData: any) {
    this.logger.log(`Broadcasting payment updated: ${paymentId}`);
    
    this.paymentGateway.broadcastPaymentStatus(paymentId, {
      type: 'updated',
      ...updateData,
    });
  }

  broadcastPaymentPaid(paymentId: string, paymentData: any) {
    this.logger.log(`Broadcasting payment paid: ${paymentId}`);
    
    this.paymentGateway.broadcastPaymentStatus(paymentId, {
      type: 'paid',
      status: 'PAID',
      ...paymentData,
    });
  }

  broadcastPaymentFailed(paymentId: string, paymentData: any) {
    this.logger.log(`Broadcasting payment failed: ${paymentId}`);
    
    this.paymentGateway.broadcastPaymentStatus(paymentId, {
      type: 'failed',
      status: 'FAILED',
      ...paymentData,
    });
  }

  getActiveWatchers() {
    return this.paymentWebSocketService.getWatcherStats();
  }
}
