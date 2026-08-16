import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { EvidenceType } from '../entities/evidence.entity';

export class UploadEvidenceDto {
  @IsNotEmpty()
  @IsString()
  disputeId: string;

  @IsEnum(EvidenceType)
  evidenceType: EvidenceType;

  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsNotEmpty()
  fileSize: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
