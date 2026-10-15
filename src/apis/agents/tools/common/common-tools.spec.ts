import { Context } from '@google/adk';
import {
  createDateArithmeticTool,
  DateArithmeticOutput,
} from './date-utils.tool';
import {
  createTextFormatterTool,
  TextFormatterOutput,
} from './text-formatter.tool';

describe('Common Agent Tools', () => {
  describe('createDateArithmeticTool', () => {
    it('creates a tool with the expected name and description', () => {
      const tool = createDateArithmeticTool();
      expect(tool.name).toBe('dateArithmetic');
      expect(tool.description).toContain('Performs deterministic date arithmetic');
    });

    it('calculates this_weekend starting from a Wednesday', async () => {
      const tool = createDateArithmeticTool();
      const result = (await tool.runAsync({
        args: {
          referenceDate: '2026-10-14T12:00:00.000Z', // Wednesday
          mode: 'this_weekend',
        },
        toolContext: {} as Context,
      })) as DateArithmeticOutput;

      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('endDate');
      expect(result.startDate).toContain('2026-10-16'); // Friday
      expect(result.endDate).toContain('2026-10-18'); // Sunday
      expect(result.label).toContain('Weekend of 2026-10-16');
    });

    it('calculates next_weekend starting from a Wednesday', async () => {
      const tool = createDateArithmeticTool();
      const result = (await tool.runAsync({
        args: {
          referenceDate: '2026-10-14T12:00:00.000Z',
          mode: 'next_weekend',
        },
        toolContext: {} as Context,
      })) as DateArithmeticOutput;

      expect(result.startDate).toContain('2026-10-23'); // Next Friday
      expect(result.endDate).toContain('2026-10-25'); // Next Sunday
    });

    it('calculates days_offset relative to reference date', async () => {
      const tool = createDateArithmeticTool();
      const result = (await tool.runAsync({
        args: {
          referenceDate: '2026-10-14T12:00:00.000Z',
          mode: 'days_offset',
          daysOffset: 5,
        },
        toolContext: {} as Context,
      })) as DateArithmeticOutput;

      expect(result.endDate).toContain('2026-10-19');
      expect(result.label).toBe('Offset of 5 days');
    });

    it('throws error for invalid reference date', async () => {
      const tool = createDateArithmeticTool();
      await expect(
        tool.runAsync({
          args: {
            referenceDate: 'not-a-valid-date',
            mode: 'this_weekend',
          },
          toolContext: {} as Context,
        }),
      ).rejects.toThrow('Invalid referenceDate');
    });
  });

  describe('createTextFormatterTool', () => {
    it('creates a tool with the expected name and description', () => {
      const tool = createTextFormatterTool();
      expect(tool.name).toBe('formatEditorialText');
      expect(tool.description).toContain('Normalizes and formats editorial copy');
    });

    it('formats unbulleted lines into clean markdown bullets', async () => {
      const tool = createTextFormatterTool();
      const result = (await tool.runAsync({
        args: {
          text: 'First line\nSecond line\n* Already bulleted',
          operation: 'bullet_list',
        },
        toolContext: {} as Context,
      })) as TextFormatterOutput;

      expect(result.formattedText).toBe('* First line\n* Second line\n* Already bulleted');
      expect(result.operation).toBe('bullet_list');
    });

    it('slugifies artist and venue names', async () => {
      const tool = createTextFormatterTool();
      const result = (await tool.runAsync({
        args: {
          text: "Cat's Cradle (Back Room) & The Haw River Ballroom!",
          operation: 'slugify',
        },
        toolContext: {} as Context,
      })) as TextFormatterOutput;

      expect(result.formattedText).toBe('cats-cradle-back-room-the-haw-river-ballroom');
      expect(result.operation).toBe('slugify');
    });

    it('cleans curly/smart quotes and em-dashes to standard ASCII', async () => {
      const tool = createTextFormatterTool();
      const result = (await tool.runAsync({
        args: {
          text: '“EZ Vibes” presents ‘Top Picks’—live in Durham–NC',
          operation: 'clean_quotes',
        },
        toolContext: {} as Context,
      })) as TextFormatterOutput;

      expect(result.formattedText).toBe('"EZ Vibes" presents \'Top Picks\'--live in Durham-NC');
    });

    it('converts titles to title case handling minor words', async () => {
      const tool = createTextFormatterTool();
      const result = (await tool.runAsync({
        args: {
          text: 'a night at the cradle with friends',
          operation: 'title_case',
        },
        toolContext: {} as Context,
      })) as TextFormatterOutput;

      expect(result.formattedText).toBe('A Night at the Cradle with Friends');
    });
  });
});
