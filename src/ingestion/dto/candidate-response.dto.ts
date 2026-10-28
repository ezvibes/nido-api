import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CandidateProvenanceField {
  @ApiPropertyOptional()
  rawValue?: string;

  @ApiPropertyOptional()
  normalizedValue?: any;

  @ApiPropertyOptional()
  confidence?: number;

  @ApiPropertyOptional()
  source?: 'hint' | 'ocr' | 'extraction';

  @ApiPropertyOptional()
  warnings?: string[];
}

export class CandidateProvenanceDto {
  @ApiPropertyOptional({ type: CandidateProvenanceField })
  title?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  date?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  time?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  timezone?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  venueHints?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  venueExtracted?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  performerLineup?: CandidateProvenanceField;

  @ApiPropertyOptional({ type: CandidateProvenanceField })
  genres?: CandidateProvenanceField;
}

export class IngestionCandidateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ type: CandidateProvenanceDto })
  provenance: CandidateProvenanceDto | null;

  @ApiPropertyOptional()
  suggestedVenueId: string | null;

  @ApiPropertyOptional()
  suggestedBandIds: string[] | null;

  @ApiPropertyOptional()
  suggestedGenreIds: string[] | null;

  @ApiProperty()
  ingestionJobId: string;

  @ApiPropertyOptional()
  publishedConcertId: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class IngestionCandidateListDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [IngestionCandidateDto] })
  items: IngestionCandidateDto[];
}
