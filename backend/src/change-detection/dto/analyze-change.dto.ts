import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

// multipart/form-data fields always arrive as strings - @Type(() => Number)
// coerces them before class-validator's @IsLatitude/@IsLongitude run.
export class AnalyzeChangeDto {
  @Type(() => Number)
  @IsLongitude()
  minLng: number;

  @Type(() => Number)
  @IsLatitude()
  minLat: number;

  @Type(() => Number)
  @IsLongitude()
  maxLng: number;

  @Type(() => Number)
  @IsLatitude()
  maxLat: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
