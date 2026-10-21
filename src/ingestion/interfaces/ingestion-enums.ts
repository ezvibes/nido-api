export enum IngestionStage {
  QUEUED = 'queued',
  ASSET_VALIDATED = 'asset_validated',
  OCR_COMPLETED = 'ocr_completed',
  EXTRACTION_COMPLETED = 'extraction_completed',
  MATCHES_PROPOSED = 'matches_proposed',
  NEEDS_REVIEW = 'needs_review',
  COMPLETED = 'completed',
}

export enum IngestionTerminalStatus {
  RETRYABLE_FAILURE = 'retryable_failure',
  TERMINAL_FAILURE = 'terminal_failure',
  CANCELLED = 'cancelled',
  DEAD_LETTER = 'dead_letter',
}
