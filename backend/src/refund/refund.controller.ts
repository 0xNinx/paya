import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { RefundService } from './refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { RefundQueryDto } from './dto/refund-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  async createRefund(
    @Body() createRefundDto: CreateRefundDto,
    @Request() req,
  ) {
    return this.refundService.createRefund(
      createRefundDto,
      req.user.merchantId,
      req.user.id,
      req.user.role,
    );
  }

  @Post(':refundId/process')
  async processRefund(
    @Param('refundId') refundId: string,
    @Request() req,
  ) {
    return this.refundService.processRefund(refundId, req.user.id, req.user.role);
  }

  @Post(':refundId/fail')
  async failRefund(
    @Param('refundId') refundId: string,
    @Body('failureReason') failureReason: string,
    @Request() req,
  ) {
    return this.refundService.failRefund(refundId, failureReason, req.user.id, req.user.role);
  }

  @Post(':refundId/reverse')
  async reverseRefund(
    @Param('refundId') refundId: string,
    @Request() req,
  ) {
    return this.refundService.reverseRefund(refundId, req.user.id, req.user.role);
  }

  @Get(':refundId')
  async getRefund(@Param('refundId') refundId: string) {
    return this.refundService.getRefund(refundId);
  }

  @Get()
  async getRefunds(
    @Query() query: RefundQueryDto,
    @Request() req,
  ) {
    return this.refundService.getRefundsByMerchant(req.user.merchantId, query);
  }

  @Get(':refundId/audit')
  async getRefundAuditTrail(@Param('refundId') refundId: string) {
    return this.refundService.getAuditTrail(refundId);
  }
}

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  async createDispute(
    @Body() createDisputeDto: CreateDisputeDto,
    @Request() req,
  ) {
    return this.refundService.createDispute(
      createDisputeDto,
      req.user.merchantId,
      req.user.id,
      req.user.role,
    );
  }

  @Put(':disputeId')
  async updateDispute(
    @Param('disputeId') disputeId: string,
    @Body() updateDisputeDto: UpdateDisputeDto,
    @Request() req,
  ) {
    return this.refundService.updateDispute(
      disputeId,
      updateDisputeDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':disputeId')
  async getDispute(@Param('disputeId') disputeId: string) {
    return this.refundService.getDispute(disputeId);
  }

  @Get()
  async getDisputes(
    @Query() query: any,
    @Request() req,
  ) {
    return this.refundService.getDisputesByMerchant(req.user.merchantId, query);
  }

  @Get(':disputeId/evidence')
  async getDisputeEvidence(@Param('disputeId') disputeId: string) {
    return this.refundService.getDisputeEvidence(disputeId);
  }

  @Post(':disputeId/evidence')
  async uploadEvidence(
    @Param('disputeId') disputeId: string,
    @Body() uploadEvidenceDto: UploadEvidenceDto,
    @Request() req,
  ) {
    uploadEvidenceDto.disputeId = disputeId;
    return this.refundService.uploadEvidence(
      uploadEvidenceDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':disputeId/audit')
  async getDisputeAuditTrail(@Param('disputeId') disputeId: string) {
    return this.refundService.getAuditTrail(undefined, disputeId);
  }
}

@Controller('analytics/refunds')
@UseGuards(JwtAuthGuard)
export class RefundAnalyticsController {
  constructor(private readonly refundService: RefundService) {}

  @Get()
  async getRefundAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req,
  ) {
    return this.refundService.getRefundAnalytics(
      req.user.merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}

@Controller('analytics/disputes')
@UseGuards(JwtAuthGuard)
export class DisputeAnalyticsController {
  constructor(private readonly refundService: RefundService) {}

  @Get()
  async getDisputeAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req,
  ) {
    return this.refundService.getDisputeAnalytics(
      req.user.merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
