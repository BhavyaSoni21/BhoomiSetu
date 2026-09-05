import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateZoningOverlayDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsIn(['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL'])
  zoneType: string;

  @IsString()
  @MaxLength(10)
  stateCode: string;

  @IsString()
  @MaxLength(40)
  district: string;

  // A GeoJSON Polygon object - validated for real shape (type === 'Polygon')
  // in the service rather than here, since class-validator has no built-in
  // GeoJSON schema and a bespoke nested-array validator would be overkill
  // for this scope.
  @IsObject()
  geometry: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parcelIds?: string[];
}

export class UpdateZoningOverlayDto extends PartialType(CreateZoningOverlayDto) {}
