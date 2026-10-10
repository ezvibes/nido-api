import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { DataSource } from 'typeorm';
import { AgentMemory } from '../entities/agent-memory.entity';

export function createStoreMemoryTool(dataSource: DataSource) {
  return new FunctionTool({
    name: 'storeEditorialMemory',
    description:
      'Stores semantic facts, preferences, and community alignment rubrics for the operator, venues, or global context. This allows future invocations to remember operator instructions and evaluations over time.',
    parameters: z.object({
      scope: z
        .enum(['GLOBAL', 'OPERATOR', 'VENUE'])
        .describe(
          'The scope of the memory. Use OPERATOR for user preferences, VENUE for venue-specific notes, and GLOBAL for system-wide instructions.',
        ),
      key: z
        .string()
        .describe(
          'The identifier for the memory (e.g., "preferred_genres", "venue_scout_history_cats_cradle").',
        ),
      value: z.any().describe('The JSON payload of the memory to store.'),
    }),
    execute: async ({ scope, key, value }) => {
      console.log(
        `\n  ⚙️  [ADK Tool Executed] storeEditorialMemory({ scope: "${scope}", key: "${key}" })`,
      );
      const repo = dataSource.getRepository(AgentMemory);

      let memory = await repo.findOne({ where: { scope, key } });
      if (memory) {
        memory.value = value;
      } else {
        memory = repo.create({ scope, key, value });
      }

      await repo.save(memory);

      return { success: true, storedScope: scope, storedKey: key };
    },
  });
}

export function createRetrieveMemoryTool(dataSource: DataSource) {
  return new FunctionTool({
    name: 'retrieveEditorialMemory',
    description:
      'Retrieves previously stored semantic facts, preferences, and community alignment rubrics by scope and key.',
    parameters: z.object({
      scope: z
        .enum(['GLOBAL', 'OPERATOR', 'VENUE'])
        .describe('The scope of the memory.'),
      key: z.string().describe('The identifier for the memory.'),
    }),
    execute: async ({ scope, key }) => {
      console.log(
        `\n  ⚙️  [ADK Tool Executed] retrieveEditorialMemory({ scope: "${scope}", key: "${key}" })`,
      );
      const repo = dataSource.getRepository(AgentMemory);

      const memory = await repo.findOne({ where: { scope, key } });

      if (memory) {
        return { found: true, scope, key, value: memory.value };
      }

      return { found: false, scope, key, message: 'No memory found.' };
    },
  });
}
