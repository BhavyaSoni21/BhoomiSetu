import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateAdminMapNoteDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @MaxLength(10)
  stateCode: string;

  @IsString()
  @MaxLength(40)
  district: string;

  // GeoJSON Point, LineString, or Polygon - real shape checked in the
  // service, see zoning-overlay.dto.ts's own note.
  @IsObject()
  geometry: Record<string, unknown>;
}

export class UpdateAdminMapNoteDto extends PartialType(CreateAdminMapNoteDto) {}
