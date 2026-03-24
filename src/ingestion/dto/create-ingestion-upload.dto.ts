import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';


export class CreateIngestionUploadDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
