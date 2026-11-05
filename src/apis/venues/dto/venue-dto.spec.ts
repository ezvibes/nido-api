import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateVenueDto } from './create-venue.dto';
import { UpdateVenueDto } from './update-venue.dto';
import { ListVenuesDto } from './list-venues.dto';
import { VenueResponseDto } from './venue-response.dto';
import { VenueVerificationState } from '../entities/venue.entity';

describe('Venue DTO Validation Matrix', () => {
  describe('CreateVenueDto', () => {
    it('validates a valid full venue payload', async () => {
      const dto = plainToInstance(CreateVenueDto, {
        name: "Cat's Cradle",
        address: '300 E Main St',
        city: 'Carrboro',
        citySlug: 'carrboro',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '27510',
        capacity: 750,
        verificationState: VenueVerificationState.CANONICAL,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid capacity and non-enum verification state', async () => {
      const dto = plainToInstance(CreateVenueDto, {
        name: 'The Pour House',
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'North Carolina',
        regionSlug: 'nc',
        capacity: -50, // Must be positive
        verificationState: 'invalid-state' as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const propertyErrors = errors.map((e) => e.property);
      expect(propertyErrors).toContain('capacity');
      expect(propertyErrors).toContain('verificationState');
    });

    it('allows optional postal code and capacity to be omitted', async () => {
      const dto = plainToInstance(CreateVenueDto, {
        name: 'Minimal Venue',
        city: 'Charlotte',
        citySlug: 'charlotte',
        region: 'North Carolina',
        regionSlug: 'nc',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateVenueDto', () => {
    it('allows partial fields while respecting type constraints', async () => {
      const validUpdate = plainToInstance(UpdateVenueDto, {
        capacity: 500,
        verificationState: VenueVerificationState.VERIFIED,
      });
      const validErrors = await validate(validUpdate);
      expect(validErrors).toHaveLength(0);

      const invalidUpdate = plainToInstance(UpdateVenueDto, {
        capacity: 'not-a-number' as any,
      });
      const invalidErrors = await validate(invalidUpdate);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });
  });

  describe('ListVenuesDto', () => {
    it('validates filter parameters including verificationState', async () => {
      const validFilter = plainToInstance(ListVenuesDto, {
        citySlug: 'charlotte',
        regionSlug: 'nc',
        verificationState: VenueVerificationState.UNVERIFIED,
      });
      const errors = await validate(validFilter);
      expect(errors).toHaveLength(0);

      const invalidFilter = plainToInstance(ListVenuesDto, {
        verificationState: 'unknown-state' as any,
      });
      const invalidErrors = await validate(invalidFilter);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });
  });

  describe('VenueResponseDto', () => {
    it('properly types and maps response object', () => {
      const res: VenueResponseDto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'The Evening Muse',
        address: '3227 N Davidson St',
        city: 'Charlotte',
        citySlug: 'charlotte',
        region: 'North Carolina',
        regionSlug: 'nc',
        postalCode: '28205',
        capacity: 120,
        verificationState: VenueVerificationState.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(res.name).toBe('The Evening Muse');
      expect(res.verificationState).toBe('verified');
      expect(res.postalCode).toBe('28205');
      expect(res.capacity).toBe(120);
    });
  });
});
