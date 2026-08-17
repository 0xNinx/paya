import { PartialType } from '@nestjs/mapped-types';
import { RegisterWebhookDto } from './register-webhook.dto';

export class UpdateWebhookDto extends PartialType(RegisterWebhookDto) {}
