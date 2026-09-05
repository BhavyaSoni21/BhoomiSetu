import { IsIn, IsObject, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateInfrastructureFeatureDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsIn(['ROAD', 'WATER_LINE', 'ELECTRICITY'])
  featureType: string;

  @IsString()
  @MaxLength(10)
  stateCode: string;

  @IsString()
  @MaxLength(40)
  district: string;

  // GeoJSON LineString (roads/water lines) or Point (e.g. a substation) -
  // real shape checked in the service, see zoning-overlay.dto.ts's note.
  @IsObject()
  geometry: Record<string, unknown>;
}

export class UpdateInfrastructureFeatureDto extends PartialType(CreateInfrastructureFeatureDto) {}
