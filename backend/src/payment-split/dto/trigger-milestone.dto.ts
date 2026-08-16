import { IsString, IsNotEmpty } from 'class-validator';

export class TriggerMilestoneDto {
  @IsString()
  @IsNotEmpty()
  splitId: string;

  @IsString()
  @IsNotEmpty()
  milestoneId: string;

  @IsString()
  @IsNotEmpty()
  triggerer: string;
}
