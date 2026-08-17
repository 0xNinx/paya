import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookTestingService } from './webhook-testing.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { ReplayWebhookDto } from './dto/replay-webhook.dto';
import { TriggerWebhookDto } from './dto/trigger-webhook.dto';
import { EventType } from './entities/webhook-event.entity';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly webhookTestingService: WebhookTestingService,
  ) {}

  @Post()
  async create(@Body() createWebhookDto: CreateWebhookDto) {
    return this.webhookService.create(createWebhookDto);
  }

  @Get()
  async findAll(@Query('merchantId') merchantId?: string) {
    return this.webhookService.findAll(merchantId);
  }

  @Get(':webhookId')
  async findOne(@Param('webhookId') webhookId: string) {
    return this.webhookService.findOne(webhookId);
  }

  @Put(':webhookId')
  async update(
    @Param('webhookId') webhookId: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(webhookId, updateWebhookDto);
  }

  @Delete(':webhookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('webhookId') webhookId: string) {
    return this.webhookService.remove(webhookId);
  }

  @Post(':webhookId/activate')
  async activate(@Param('webhookId') webhookId: string) {
    return this.webhookService.activate(webhookId);
  }

  @Post(':webhookId/deactivate')
  async deactivate(@Param('webhookId') webhookId: string) {
    return this.webhookService.deactivate(webhookId);
  }

  @Post('test')
  async test(@Body() testWebhookDto: TestWebhookDto) {
    return this.webhookService.test(testWebhookDto);
  }

  @Post('replay')
  async replay(@Body() replayWebhookDto: ReplayWebhookDto) {
    return this.webhookService.replay(replayWebhookDto);
  }

  @Post('trigger')
  async trigger(@Body() triggerWebhookDto: TriggerWebhookDto) {
    return this.webhookService.trigger(triggerWebhookDto);
  }

  @Get(':webhookId/events')
  async getEvents(
    @Param('webhookId') webhookId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.webhookService.getEvents(webhookId, limit, offset);
  }

  @Get(':webhookId/stats')
  async getStats(@Param('webhookId') webhookId: string) {
    return this.webhookService.getWebhookStats(webhookId);
  }

  @Get('events/:eventId/deliveries')
  async getDeliveries(
    @Param('eventId') eventId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.webhookService.getDeliveries(eventId, limit, offset);
  }

  @Get('deliveries/:deliveryId/logs')
  async getDeliveryLogs(
    @Param('deliveryId') deliveryId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.webhookService.getDeliveryLogs(deliveryId, limit, offset);
  }

  @Post(':webhookId/validate')
  async validateWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookTestingService.validateWebhookEndpoint(webhookId);
  }

  @Post(':webhookId/simulate')
  async simulateWebhook(
    @Param('webhookId') webhookId: string,
    @Body() body: { eventType: EventType; customPayload?: Record<string, any> },
  ) {
    return this.webhookTestingService.simulateWebhookDelivery(
      webhookId,
      body.eventType,
      body.customPayload,
    );
  }

  @Get(':webhookId/debug')
  async getDebugInfo(@Param('webhookId') webhookId: string) {
    return this.webhookTestingService.getWebhookDebugInfo(webhookId);
  }

  @Get(':webhookId/troubleshoot')
  async troubleshootWebhook(@Param('webhookId') webhookId: string) {
    return this.webhookTestingService.troubleshootWebhook(webhookId);
  }

  @Get('test/payload/:eventType')
  async getTestPayload(@Param('eventType') eventType: EventType) {
    return this.webhookTestingService.generateTestPayload(eventType);
  }
}
