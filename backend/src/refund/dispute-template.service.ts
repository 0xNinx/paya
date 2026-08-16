import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeTemplate, TemplateType } from './entities/dispute-template.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DisputeTemplateService {
  constructor(
    @InjectRepository(DisputeTemplate)
    private templateRepository: Repository<DisputeTemplate>,
  ) {}

  async createTemplate(
    merchantId: string,
    name: string,
    templateType: TemplateType,
    subject: string,
    body: string,
    variables?: string[],
  ): Promise<DisputeTemplate> {
    const template = this.templateRepository.create({
      templateId: `TPL_${uuidv4()}`,
      merchantId,
      name,
      templateType,
      subject,
      body,
      variables: variables || this.extractVariables(body),
      isActive: true,
      usageCount: 0,
    });

    return this.templateRepository.save(template);
  }

  async getTemplate(templateId: string): Promise<DisputeTemplate> {
    const template = await this.templateRepository.findOne({ where: { templateId } });
    
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async getTemplatesByMerchant(merchantId: string, templateType?: TemplateType): Promise<DisputeTemplate[]> {
    const queryBuilder = this.templateRepository.createQueryBuilder('template')
      .where('template.merchantId = :merchantId', { merchantId })
      .andWhere('template.isActive = :isActive', { isActive: true });

    if (templateType) {
      queryBuilder.andWhere('template.templateType = :templateType', { templateType });
    }

    return queryBuilder.orderBy('template.usageCount', 'DESC').getMany();
  }

  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      subject?: string;
      body?: string;
      variables?: string[];
      isActive?: boolean;
    },
  ): Promise<DisputeTemplate> {
    const template = await this.getTemplate(templateId);

    if (updates.name) template.name = updates.name;
    if (updates.subject) template.subject = updates.subject;
    if (updates.body) {
      template.body = updates.body;
      template.variables = updates.variables || this.extractVariables(updates.body);
    }
    if (updates.isActive !== undefined) template.isActive = updates.isActive;

    return this.templateRepository.save(template);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    template.isActive = false;
    await this.templateRepository.save(template);
  }

  async useTemplate(templateId: string): Promise<DisputeTemplate> {
    const template = await this.getTemplate(templateId);
    template.usageCount += 1;
    return this.templateRepository.save(template);
  }

  renderTemplate(templateId: string, variables: Record<string, any>): { subject: string; body: string } {
    const template = this.templateRepository.findOne({ where: { templateId } });
    
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return {
      subject: this.replaceVariables(template.subject, variables),
      body: this.replaceVariables(template.body, variables),
    };
  }

  async getDefaultTemplates(): Promise<Partial<DisputeTemplate>[]> {
    return [
      {
        name: 'Evidence Request',
        templateType: TemplateType.EVIDENCE_REQUEST,
        subject: 'Evidence Required for Dispute {{disputeId}}',
        body: 'Dear {{customerName}},\n\nWe have received your dispute for order {{orderId}}. To proceed with the investigation, please provide the following evidence:\n\n{{evidenceList}}\n\nPlease submit this evidence by {{dueDate}}.\n\nBest regards,\n{{merchantName}}',
        variables: ['disputeId', 'customerName', 'orderId', 'evidenceList', 'dueDate', 'merchantName'],
      },
      {
        name: 'Dispute Response',
        templateType: TemplateType.DISPUTE_RESPONSE,
        subject: 'Response to Dispute {{disputeId}}',
        body: 'Dear {{customerName}},\n\nWe have reviewed your dispute for order {{orderId}}. After careful consideration, we have decided to {{resolution}}.\n\n{{explanation}}\n\nIf you have any further questions, please contact our support team.\n\nBest regards,\n{{merchantName}}',
        variables: ['disputeId', 'customerName', 'orderId', 'resolution', 'explanation', 'merchantName'],
      },
      {
        name: 'Chargeback Response',
        templateType: TemplateType.CHARGEBACK_RESPONSE,
        subject: 'Chargeback Response for Transaction {{transactionId}}',
        body: 'To whom it may concern,\n\nWe are responding to the chargeback for transaction {{transactionId}}. We have attached the following evidence to support our case:\n\n{{evidenceSummary}}\n\nTransaction Details:\n- Date: {{transactionDate}}\n- Amount: {{amount}}\n- Customer: {{customerName}}\n\nWe respectfully request that this chargeback be reversed.\n\nSincerely,\n{{merchantName}}',
        variables: ['transactionId', 'evidenceSummary', 'transactionDate', 'amount', 'customerName', 'merchantName'],
      },
      {
        name: 'Refund Approval',
        templateType: TemplateType.REFUND_APPROVAL,
        subject: 'Refund Approved for Order {{orderId}}',
        body: 'Dear {{customerName}},\n\nYour refund request for order {{orderId}} has been approved. The refund amount of {{refundAmount}} will be processed to your original payment method.\n\nPlease allow 5-7 business days for the refund to appear in your account.\n\nRefund Details:\n- Refund ID: {{refundId}}\n- Amount: {{refundAmount}}\n- Reason: {{reason}}\n\nThank you for your patience.\n\nBest regards,\n{{merchantName}}',
        variables: ['customerName', 'orderId', 'refundAmount', 'refundId', 'reason', 'merchantName'],
      },
      {
        name: 'Refund Denial',
        templateType: TemplateType.REFUND_DENIAL,
        subject: 'Refund Request Update for Order {{orderId}}',
        body: 'Dear {{customerName}},\n\nWe have reviewed your refund request for order {{orderId}}. Unfortunately, we are unable to approve this request at this time.\n\n{{denialReason}}\n\nIf you believe this decision was made in error, please contact our support team with additional information.\n\nBest regards,\n{{merchantName}}',
        variables: ['customerName', 'orderId', 'denialReason', 'merchantName'],
      },
    ];
  }

  private extractVariables(text: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return variables[variableName] !== undefined ? variables[variableName] : match;
    });
  }
}
