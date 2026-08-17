import { io, Socket } from 'socket.io-client';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface PaymentStatusUpdate {
  paymentId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount?: number;
  currency?: string;
  depositAddress?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
  txHash?: string;
  timestamp: string;
}

interface WebSocketCallbacks {
  onStatusUpdate?: (update: PaymentStatusUpdate) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onConnectionError?: (error: Error) => void;
}

export class PaymentWebSocket {
  private socket: Socket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private watchedPayments: Set<string> = new Set();
  private callbacks: WebSocketCallbacks = {};
  private serverUrl: string;

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || 
      (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'ws://localhost:3001');
  }

  connect(callbacks?: WebSocketCallbacks) {
    if (this.socket?.connected) {
      return;
    }

    this.callbacks = callbacks || {};
    this.status = 'connecting';

    try {
      this.socket = io(`${this.serverUrl}/payments`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      this.setupEventListeners();
    } catch (error) {
      this.status = 'disconnected';
      this.callbacks.onConnectionError?.(error as Error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.callbacks.onConnected?.();
      this.startHeartbeat();

      // Re-join all previously watched payments
      this.watchedPayments.forEach(paymentId => {
        this.joinPayment(paymentId);
      });
    });

    this.socket.on('disconnect', () => {
      this.status = 'disconnected';
      this.stopHeartbeat();
      this.callbacks.onDisconnected?.();
    });

    this.socket.on('reconnect_attempt', () => {
      this.status = 'reconnecting';
      this.reconnectAttempts++;
      this.callbacks.onReconnecting?.();
    });

    this.socket.on('reconnect_failed', () => {
      this.status = 'disconnected';
      this.callbacks.onConnectionError?.(new Error('Failed to reconnect after maximum attempts'));
    });

    this.socket.on('connect_error', (error) => {
      this.callbacks.onConnectionError?.(error);
    });

    this.socket.on('payment-status-update', (update: PaymentStatusUpdate) => {
      this.callbacks.onStatusUpdate?.(update);
    });

    this.socket.on('connected', (data) => {
      console.log('WebSocket connected:', data);
    });

    this.socket.on('heartbeat', (data) => {
      console.log('Heartbeat received:', data.timestamp);
    });

    this.socket.on('pong', (data) => {
      console.log('Pong received:', data.timestamp);
    });
  }

  joinPayment(paymentId: string) {
    if (!this.socket?.connected) {
      console.warn('Cannot join payment: socket not connected');
      this.watchedPayments.add(paymentId);
      return;
    }

    this.socket.emit('join-payment', { paymentId });
    this.watchedPayments.add(paymentId);
  }

  leavePayment(paymentId: string) {
    if (!this.socket?.connected) {
      this.watchedPayments.delete(paymentId);
      return;
    }

    this.socket.emit('leave-payment', { paymentId });
    this.watchedPayments.delete(paymentId);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    
    // Leave all payments
    this.watchedPayments.forEach(paymentId => {
      this.leavePayment(paymentId);
    });
    this.watchedPayments.clear();

    this.socket?.disconnect();
    this.socket = null;
    this.status = 'disconnected';
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.socket?.connected === true;
  }

  updateCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Singleton instance
let paymentWebSocketInstance: PaymentWebSocket | null = null;

export function getPaymentWebSocket(serverUrl?: string): PaymentWebSocket {
  if (!paymentWebSocketInstance) {
    paymentWebSocketInstance = new PaymentWebSocket(serverUrl);
  }
  return paymentWebSocketInstance;
}
