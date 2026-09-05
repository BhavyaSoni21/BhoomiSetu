import { IsString, MinLength } from 'class-validator';

export class NaturalLanguageQueryDto {
  @IsString()
  @MinLength(1)
  query: string;
}
