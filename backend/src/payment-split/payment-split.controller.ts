import { Controller, Get, Post, Put, Body, Param, Request } from '@nestjs/common';
import { PaymentSplitService } from './payment-split.service';
import { CreateSplitDto } from './dto/create-split.dto';
import { ExecuteSplitDto } from './dto/execute-split.dto';
import { DistributeRecipientDto } from './dto/distribute-recipient.dto';
import { TriggerMilestoneDto } from './dto/trigger-milestone.dto';

@Controller('payment-splits')
export class PaymentSplitController {
  constructor(private readonly splitService: PaymentSplitService) {}

  @Post()
  async createSplit(@Body() createSplitDto: CreateSplitDto, @Request() req) {
    return this.splitService.createSplit(
      createSplitDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':splitId/execute')
  async executeSplit(
    @Param('splitId') splitId: string,
    @Body() executeSplitDto: ExecuteSplitDto,
    @Request() req,
  ) {
    return this.splitService.executeSplit(
      { ...executeSplitDto, splitId },
      req.user.userId,
      req.user.role,
    );
  }

  @Post('distribute')
  async distributeToRecipient(
    @Body() distributeDto: DistributeRecipientDto,
    @Request() req,
  ) {
    return this.splitService.distributeToRecipient(
      distributeDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Post('distributions/:distributionId/confirm')
  async confirmDistribution(
    @Param('distributionId') distributionId: string,
    @Body('transactionHash') transactionHash: string,
  ) {
    return this.splitService.confirmDistribution(distributionId, transactionHash);
  }

  @Post('distributions/:distributionId/fail')
  async failDistribution(
    @Param('distributionId') distributionId: string,
    @Body('errorMessage') errorMessage: string,
  ) {
    return this.splitService.failDistribution(distributionId, errorMessage);
  }

  @Post(':splitId/milestones/trigger')
  async triggerMilestone(
    @Param('splitId') splitId: string,
    @Body() triggerMilestoneDto: TriggerMilestoneDto,
    @Request() req,
  ) {
    return this.splitService.triggerMilestone(
      { ...triggerMilestoneDto, splitId },
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':splitId/milestones/:milestoneId/complete')
  async completeMilestone(
    @Param('splitId') splitId: string,
    @Param('milestoneId') milestoneId: string,
    @Request() req,
  ) {
    return this.splitService.completeMilestone(
      splitId,
      milestoneId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post(':splitId/cancel')
  async cancelSplit(@Param('splitId') splitId: string, @Request() req) {
    return this.splitService.cancelSplit(splitId, req.user.userId, req.user.role);
  }

  @Post(':splitId/retry')
  async retryFailedDistributions(@Param('splitId') splitId: string, @Request() req) {
    return this.splitService.retryFailedDistributions(splitId, req.user.userId, req.user.role);
  }

  @Get(':splitId')
  async getSplit(@Param('splitId') splitId: string) {
    return this.splitService.getSplit(splitId);
  }

  @Get(':splitId/audit')
  async getSplitAudit(@Param('splitId') splitId: string) {
    return this.splitService.getSplitAudit(splitId);
  }

  @Get('analytics/summary')
  async getSplitAnalytics(
    @Request() req,
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.splitService.getSplitAnalytics(start, end);
  }
}
