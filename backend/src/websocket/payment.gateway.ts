import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PaymentWebSocketService } from './payment-websocket.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/payments',
})
export class PaymentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentGateway.name);

  constructor(private readonly paymentWebSocketService: PaymentWebSocketService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Send initial connection acknowledgment
    client.emit('connected', {
      status: 'connected',
      timestamp: new Date().toISOString(),
    });

    // Start heartbeat for this client
    this.startHeartbeat(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up payment watchers for this client
    this.paymentWebSocketService.removeClient(client.id);
  }

  @SubscribeMessage('join-payment')
  handleJoinPayment(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { paymentId } = data;
    this.logger.log(`Client ${client.id} watching payment: ${paymentId}`);
    
    // Add client to payment watchers
    this.paymentWebSocketService.addPaymentWatcher(client.id, paymentId);
    
    // Send current payment status immediately
    this.paymentWebSocketService.sendCurrentPaymentStatus(client.id, paymentId);
    
    // Acknowledge subscription
    client.emit('payment-joined', {
      paymentId,
      status: 'watching',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leave-payment')
  handleLeavePayment(
    @MessageBody() data: { paymentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { paymentId } = data;
    this.logger.log(`Client ${client.id} stopped watching payment: ${paymentId}`);
    
    // Remove client from payment watchers
    this.paymentWebSocketService.removePaymentWatcher(client.id, paymentId);
    
    // Acknowledge unsubscription
    client.emit('payment-left', {
      paymentId,
      status: 'stopped-watching',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', {
      timestamp: new Date().toISOString(),
    });
  }

  private startHeartbeat(client: Socket) {
    const heartbeatInterval = setInterval(() => {
      if (client.connected) {
        client.emit('heartbeat', {
          timestamp: new Date().toISOString(),
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds

    client.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
  }

  // Method to broadcast payment status update to all watchers
  broadcastPaymentStatus(paymentId: string, status: any) {
    this.server.to(`payment:${paymentId}`).emit('payment-status-update', {
      paymentId,
      ...status,
      timestamp: new Date().toISOString(),
    });
  }
}
