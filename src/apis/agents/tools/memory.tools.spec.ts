import { Context } from '@google/adk';
import { DataSource, Repository } from 'typeorm';
import {
  createStoreMemoryTool,
  createRetrieveMemoryTool,
} from './memory.tools';
import { AgentMemory } from '../entities/agent-memory.entity';

describe('Editorial Memory Tools', () => {
  let mockRepository: Partial<Repository<AgentMemory>>;
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };
  });

  describe('createStoreMemoryTool', () => {
    it('should create a store memory tool with correct name and description', () => {
      const tool = createStoreMemoryTool(mockDataSource as DataSource);
      expect(tool.name).toBe('storeEditorialMemory');
      expect(tool.description).toContain('Stores semantic facts');
    });

    it('should store a new memory when none exists', async () => {
      const tool = createStoreMemoryTool(mockDataSource as DataSource);
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockRepository.create as jest.Mock).mockImplementation((data) => ({
        id: '1',
        ...data,
      }));
      (mockRepository.save as jest.Mock).mockImplementation((data) =>
        Promise.resolve(data),
      );

      const result = await tool.runAsync({
        args: {
          scope: 'OPERATOR',
          key: 'preferred_genres',
          value: ['indie', 'rock'],
        },
        toolContext: {} as Context,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { scope: 'OPERATOR', key: 'preferred_genres' },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        scope: 'OPERATOR',
        key: 'preferred_genres',
        value: ['indie', 'rock'],
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        storedScope: 'OPERATOR',
        storedKey: 'preferred_genres',
      });
    });

    it('should update an existing memory', async () => {
      const tool = createStoreMemoryTool(mockDataSource as DataSource);
      const existingMemory = {
        id: '1',
        scope: 'OPERATOR',
        key: 'preferred_genres',
        value: ['jazz'],
      };
      (mockRepository.findOne as jest.Mock).mockResolvedValue(existingMemory);
      (mockRepository.save as jest.Mock).mockImplementation((data) =>
        Promise.resolve(data),
      );

      const result = await tool.runAsync({
        args: {
          scope: 'OPERATOR',
          key: 'preferred_genres',
          value: ['indie', 'rock'],
        },
        toolContext: {} as Context,
      });

      expect(existingMemory.value).toEqual(['indie', 'rock']);
      expect(mockRepository.save).toHaveBeenCalledWith(existingMemory);
      expect(result).toEqual({
        success: true,
        storedScope: 'OPERATOR',
        storedKey: 'preferred_genres',
      });
    });
  });

  describe('createRetrieveMemoryTool', () => {
    it('should create a retrieve memory tool with correct name and description', () => {
      const tool = createRetrieveMemoryTool(mockDataSource as DataSource);
      expect(tool.name).toBe('retrieveEditorialMemory');
      expect(tool.description).toContain('Retrieves previously stored');
    });

    it('should retrieve existing memory', async () => {
      const tool = createRetrieveMemoryTool(mockDataSource as DataSource);
      const existingMemory = {
        id: '1',
        scope: 'VENUE',
        key: 'venue_notes',
        value: { seating: 'limited' },
      };
      (mockRepository.findOne as jest.Mock).mockResolvedValue(existingMemory);

      const result = await tool.runAsync({
        args: {
          scope: 'VENUE',
          key: 'venue_notes',
        },
        toolContext: {} as Context,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { scope: 'VENUE', key: 'venue_notes' },
      });
      expect(result).toEqual({
        found: true,
        scope: 'VENUE',
        key: 'venue_notes',
        value: { seating: 'limited' },
      });
    });

    it('should return found: false when memory does not exist', async () => {
      const tool = createRetrieveMemoryTool(mockDataSource as DataSource);
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await tool.runAsync({
        args: {
          scope: 'GLOBAL',
          key: 'non_existent_key',
        },
        toolContext: {} as Context,
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { scope: 'GLOBAL', key: 'non_existent_key' },
      });
      expect(result).toEqual({
        found: false,
        scope: 'GLOBAL',
        key: 'non_existent_key',
        message: 'No memory found.',
      });
    });
  });
});
