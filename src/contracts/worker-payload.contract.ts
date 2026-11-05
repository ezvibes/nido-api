import { z } from 'zod';

export const CloudTasksWorkerPayloadSchema = z
  .object({
    jobId: z.string().uuid('jobId must be a valid UUID'),
    attempt: z
      .number()
      .int('attempt must be an integer')
      .min(1, 'attempt must be >= 1')
      .max(25, 'attempt cannot exceed maximum retries (25)'),
  })
  .strict();

export type CloudTasksWorkerPayload = z.infer<
  typeof CloudTasksWorkerPayloadSchema
>;

/**
 * Validates that an incoming Cloud Tasks worker payload matches the strict runtime contract.
 */
export function validateCloudTasksPayload(
  payload: unknown,
): CloudTasksWorkerPayload {
  return CloudTasksWorkerPayloadSchema.parse(payload);
}
