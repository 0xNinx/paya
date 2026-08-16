import { IsString, IsNotEmpty } from 'class-validator';

export class ExecuteSplitDto {
  @IsString()
  @IsNotEmpty()
  splitId: string;

  @IsString()
  @IsNotEmpty()
  executor: string;
}
