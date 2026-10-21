import { Logger } from '@nestjs/common';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const TEXT_FORMATTER_TOOL_NAME = 'formatEditorialText';

const logger = new Logger('TextFormatterTool');

export const textFormatterInputSchema = z.object({
  text: z.string().describe('The raw text to format or normalize.'),
  operation: z
    .enum(['bullet_list', 'slugify', 'clean_quotes', 'title_case'])
    .describe('The text transformation operation to apply.'),
});

export type TextFormatterInput = z.infer<typeof textFormatterInputSchema>;

export const textFormatterOutputSchema = z.object({
  formattedText: z.string(),
  operation: z.string(),
});

export type TextFormatterOutput = z.infer<typeof textFormatterOutputSchema>;

export function createTextFormatterTool(): FunctionTool<
  typeof textFormatterInputSchema
> {
  return new FunctionTool({
    name: TEXT_FORMATTER_TOOL_NAME,
    description:
      'Normalizes and formats editorial copy, concert summaries, venue slugs, and markdown bullet lists across agents.',
    parameters: textFormatterInputSchema,
    execute: async (
      input: TextFormatterInput,
    ): Promise<TextFormatterOutput> => {
      logger.log(
        `[ADK Tool Executed] formatEditorialText({ operation: "${input.operation}" })`,
      );

      let formattedText = input.text;

      switch (input.operation) {
        case 'bullet_list': {
          const lines = input.text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) =>
              line.startsWith('* ') || line.startsWith('- ')
                ? line
                : `* ${line}`,
            );
          formattedText = lines.join('\n');
          break;
        }

        case 'slugify': {
          formattedText = input.text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
          break;
        }

        case 'clean_quotes': {
          formattedText = input.text
            .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
            .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
            .replace(/[\u2014]/g, '--') // Em dash
            .replace(/[\u2013]/g, '-'); // En dash
          break;
        }

        case 'title_case': {
          const minorWords = new Set([
            'and',
            'as',
            'but',
            'for',
            'if',
            'nor',
            'or',
            'so',
            'yet',
            'a',
            'an',
            'the',
            'at',
            'by',
            'for',
            'in',
            'of',
            'on',
            'per',
            'to',
            'with',
          ]);
          formattedText = input.text
            .toLowerCase()
            .split(' ')
            .map((word, index) => {
              if (index === 0 || !minorWords.has(word)) {
                return word.charAt(0).toUpperCase() + word.slice(1);
              }
              return word;
            })
            .join(' ');
          break;
        }
      }

      return textFormatterOutputSchema.parse({
        formattedText,
        operation: input.operation,
      });
    },
  });
}
