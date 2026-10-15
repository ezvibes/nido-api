import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const DATE_ARITHMETIC_TOOL_NAME = 'dateArithmetic';

const logger = new Logger('DateArithmeticTool');

export const dateArithmeticInputSchema = z.object({
  referenceDate: z
    .string()
    .optional()
    .describe('ISO-8601 reference date string. Defaults to current date if omitted.'),
  mode: z
    .enum(['this_weekend', 'next_weekend', 'this_week', 'next_week', 'days_offset'])
    .describe('The date calculation mode to execute.'),
  daysOffset: z
    .number()
    .int()
    .optional()
    .describe('Number of days to offset when mode is "days_offset". Positive for future, negative for past.'),
});

export type DateArithmeticInput = z.infer<typeof dateArithmeticInputSchema>;

export const dateArithmeticOutputSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  label: z.string(),
});

export type DateArithmeticOutput = z.infer<typeof dateArithmeticOutputSchema>;

export function createDateArithmeticTool(): FunctionTool<typeof dateArithmeticInputSchema> {
  return new FunctionTool({
    name: DATE_ARITHMETIC_TOOL_NAME,
    description:
      'Performs deterministic date arithmetic for live music schedules (calculating weekend ranges, upcoming weeks, or relative day offsets).',
    parameters: dateArithmeticInputSchema,
    execute: async (input: DateArithmeticInput): Promise<DateArithmeticOutput> => {
      logger.log(
        `[ADK Tool Executed] dateArithmetic({ mode: "${input.mode}", referenceDate: "${input.referenceDate || 'now'}" })`,
      );

      const ref = input.referenceDate ? new Date(input.referenceDate) : new Date();
      if (isNaN(ref.getTime())) {
        throw new Error(`Invalid referenceDate: "${input.referenceDate}"`);
      }

      let start = new Date(ref);
      let end = new Date(ref);
      let label = '';

      const dayOfWeek = ref.getUTCDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday

      switch (input.mode) {
        case 'this_weekend': {
          // Friday to Sunday of the current week
          const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
          start.setUTCDate(ref.getUTCDate() + (dayOfWeek === 0 ? -2 : daysUntilFriday));
          start.setUTCHours(0, 0, 0, 0);

          end = new Date(start);
          end.setUTCDate(start.getUTCDate() + 2);
          end.setUTCHours(23, 59, 59, 999);
          label = `Weekend of ${start.toISOString().split('T')[0]}`;
          break;
        }

        case 'next_weekend': {
          const daysUntilFriday = ((5 - dayOfWeek + 7) % 7) || 7;
          start.setUTCDate(ref.getUTCDate() + (dayOfWeek === 0 ? 5 : daysUntilFriday + 7));
          start.setUTCHours(0, 0, 0, 0);

          end = new Date(start);
          end.setUTCDate(start.getUTCDate() + 2);
          end.setUTCHours(23, 59, 59, 999);
          label = `Next Weekend (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]})`;
          break;
        }

        case 'this_week': {
          // Monday to Sunday
          const diffToMonday = (dayOfWeek + 6) % 7;
          start.setUTCDate(ref.getUTCDate() - diffToMonday);
          start.setUTCHours(0, 0, 0, 0);

          end = new Date(start);
          end.setUTCDate(start.getUTCDate() + 6);
          end.setUTCHours(23, 59, 59, 999);
          label = `Week of ${start.toISOString().split('T')[0]}`;
          break;
        }

        case 'next_week': {
          const diffToMonday = (dayOfWeek + 6) % 7;
          start.setUTCDate(ref.getUTCDate() - diffToMonday + 7);
          start.setUTCHours(0, 0, 0, 0);

          end = new Date(start);
          end.setUTCDate(start.getUTCDate() + 6);
          end.setUTCHours(23, 59, 59, 999);
          label = `Next Week (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]})`;
          break;
        }

        case 'days_offset': {
          const offset = input.daysOffset ?? 0;
          end.setUTCDate(ref.getUTCDate() + offset);
          if (offset < 0) {
            const temp = start;
            start = end;
            end = temp;
          }
          label = `Offset of ${offset} days`;
          break;
        }
      }

      return dateArithmeticOutputSchema.parse({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        label,
      });
    },
  });
}
