import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateRestrictionZoneDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsIn(['FLOOD', 'ENVIRONMENTAL', 'PROTECTED_AREA'])
  restrictionType: string;

  @IsString()
  @MaxLength(10)
  stateCode: string;

  @IsString()
  @MaxLength(40)
  district: string;

  @IsObject()
  geometry: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedParcelIds?: string[];
}

export class UpdateRestrictionZoneDto extends PartialType(CreateRestrictionZoneDto) {}
