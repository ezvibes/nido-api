import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateIngestionUploadDto } from './create-ingestion-upload.dto';

describe('CreateIngestionUploadDto', () => {
  it('defaults state to NC when omitted or empty', async () => {
    const dto = plainToInstance(CreateIngestionUploadDto, {
      city: 'Raleigh',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.state).toBe('NC');
  });

  it('normalizes full state name "North Carolina" to "NC"', async () => {
    const dto = plainToInstance(CreateIngestionUploadDto, {
      city: 'Carrboro',
      state: 'North Carolina',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.state).toBe('NC');
  });

  it('normalizes lowercase "nc" to uppercase "NC"', async () => {
    const dto = plainToInstance(CreateIngestionUploadDto, {
      city: 'Asheville',
      state: 'nc',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.state).toBe('NC');
  });

  it('normalizes other state names to their 2-letter codes', async () => {
    const dto = plainToInstance(CreateIngestionUploadDto, {
      city: 'Richmond',
      state: 'Virginia',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.state).toBe('VA');
  });

  it('preserves existing 2-letter state codes', async () => {
    const dto = plainToInstance(CreateIngestionUploadDto, {
      city: 'Columbia',
      state: 'SC',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.state).toBe('SC');
  });
});
