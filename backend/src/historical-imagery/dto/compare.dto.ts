import { IsInt, Max, Min } from 'class-validator';

export class CompareYearsDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  fromYear: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  toYear: number;
}
