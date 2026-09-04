import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateStateALandRecordDto {
  @IsString()
  @MaxLength(50)
  surveyNumber: string;

  @IsString()
  @MaxLength(20)
  subdivisionNumber: string;

  @IsString()
  @MaxLength(100)
  ownerName: string;

  @IsString()
  @MaxLength(30)
  villageCode: string;

  @IsNumber()
  @IsPositive()
  areaHectares: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recordStatus?: string;
}

export class UpdateStateALandRecordDto extends PartialType(CreateStateALandRecordDto) {}
