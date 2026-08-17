import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentGateway } from './payment.gateway';
import { PaymentWebSocketService } from './payment-websocket.service';
import { PaymentBroadcastService } from './payment-broadcast.service';
import { Payment } from '../payment/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  providers: [PaymentGateway, PaymentWebSocketService, PaymentBroadcastService],
  exports: [PaymentWebSocketService, PaymentBroadcastService],
})
export class WebsocketModule {}
