import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class DistributeRecipientDto {
  @IsString()
  @IsNotEmpty()
  splitId: string;

  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  distributionId: string;
}
