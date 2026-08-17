import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payment/entities/payment.entity';

interface PaymentWatcher {
  clientId: string;
  paymentId: string;
  joinedAt: Date;
}

@Injectable()
export class PaymentWebSocketService {
  private readonly logger = new Logger(PaymentWebSocketService.name);
  
  // Map of clientId -> Set of paymentIds they're watching
  private clientWatchers: Map<string, Set<string>> = new Map();
  
  // Map of paymentId -> Set of clientIds watching it
  private paymentWatchers: Map<string, Set<string>> = new Map();

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

  addPaymentWatcher(clientId: string, paymentId: string) {
    // Add payment to client's watch list
    if (!this.clientWatchers.has(clientId)) {
      this.clientWatchers.set(clientId, new Set());
    }
    this.clientWatchers.get(clientId)!.add(paymentId);

    // Add client to payment's watcher list
    if (!this.paymentWatchers.has(paymentId)) {
      this.paymentWatchers.set(paymentId, new Set());
    }
    this.paymentWatchers.get(paymentId)!.add(clientId);

    this.logger.debug(`Client ${clientId} now watching payment ${paymentId}`);
  }

  removePaymentWatcher(clientId: string, paymentId: string) {
    // Remove payment from client's watch list
    const clientPayments = this.clientWatchers.get(clientId);
    if (clientPayments) {
      clientPayments.delete(paymentId);
      if (clientPayments.size === 0) {
        this.clientWatchers.delete(clientId);
      }
    }

    // Remove client from payment's watcher list
    const paymentClients = this.paymentWatchers.get(paymentId);
    if (paymentClients) {
      paymentClients.delete(clientId);
      if (paymentClients.size === 0) {
        this.paymentWatchers.delete(paymentId);
      }
    }

    this.logger.debug(`Client ${clientId} stopped watching payment ${paymentId}`);
  }

  removeClient(clientId: string) {
    // Remove all payment watchers for this client
    const clientPayments = this.clientWatchers.get(clientId);
    if (clientPayments) {
      clientPayments.forEach(paymentId => {
        const paymentClients = this.paymentWatchers.get(paymentId);
        if (paymentClients) {
          paymentClients.delete(clientId);
          if (paymentClients.size === 0) {
            this.paymentWatchers.delete(paymentId);
          }
        }
      });
      this.clientWatchers.delete(clientId);
    }

    this.logger.debug(`Removed all watchers for client ${clientId}`);
  }

  getClientsWatchingPayment(paymentId: string): string[] {
    const watchers = this.paymentWatchers.get(paymentId);
    return watchers ? Array.from(watchers) : [];
  }

  getPaymentsWatchedByClient(clientId: string): string[] {
    const payments = this.clientWatchers.get(clientId);
    return payments ? Array.from(payments) : [];
  }

  async sendCurrentPaymentStatus(clientId: string, paymentId: string) {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { paymentId },
      });

      if (payment) {
        return {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          depositAddress: payment.depositAddress,
          memo: payment.memo,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          txHash: payment.txHash,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch payment status for ${paymentId}:`, error);
      return null;
    }
  }

  getWatcherStats() {
    return {
      totalClients: this.clientWatchers.size,
      totalPaymentsWatched: this.paymentWatchers.size,
      clientWatchers: Object.fromEntries(
        Array.from(this.clientWatchers.entries()).map(([clientId, payments]) => [
          clientId,
          Array.from(payments),
        ]),
      ),
      paymentWatchers: Object.fromEntries(
        Array.from(this.paymentWatchers.entries()).map(([paymentId, clients]) => [
          paymentId,
          Array.from(clients),
        ]),
      ),
    };
  }
}
