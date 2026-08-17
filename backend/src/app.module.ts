import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RefundModule } from './refund/refund.module';
import { PaymentSplitModule } from './payment-split/payment-split.module';
import { WebhookModule } from './webhook/webhook.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { NotificationServiceModule } from './notification-service/notification-service.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'paya',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    RefundModule,
    PaymentSplitModule,
    WebsocketModule,
    WebhookModule,
    SubscriptionModule,
    NotificationServiceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
