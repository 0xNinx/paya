import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class WebhookSignatureService {
  private readonly logger = new Logger(WebhookSignatureService.name);

  generateSignature(payload: Record<string, any>, secret: string): string {
    const timestamp = Date.now().toString();
    const payloadString = JSON.stringify(payload);
    const signaturePayload = `${timestamp}.${payloadString}`;
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    return `${timestamp}.${signature}`;
  }

  verifySignature(
    payload: Record<string, any>,
    signature: string,
    secret: string,
    tolerance = 300000,
  ): boolean {
    try {
      const [timestamp, receivedSignature] = signature.split('.');
      
      if (!timestamp || !receivedSignature) {
        this.logger.warn('Invalid signature format');
        return false;
      }

      const now = Date.now();
      const signatureTime = parseInt(timestamp, 10);
      
      if (Math.abs(now - signatureTime) > tolerance) {
        this.logger.warn(`Signature timestamp too old or in the future: ${signatureTime}`);
        return false;
      }

      const payloadString = JSON.stringify(payload);
      const signaturePayload = `${timestamp}.${payloadString}`;
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('Signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error.message}`);
      return false;
    }
  }

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
