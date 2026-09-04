import { IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateStateBLandRecordDto {
  @IsString()
  @MaxLength(50)
  plotId: string;

  @IsString()
  @MaxLength(100)
  holderName: string;

  @IsString()
  @MaxLength(30)
  localityId: string;

  @IsNumber()
  @IsPositive()
  landExtentSqft: number;

  @IsString()
  @MaxLength(30)
  recordCategory: string;
}

export class UpdateStateBLandRecordDto extends PartialType(CreateStateBLandRecordDto) {}
