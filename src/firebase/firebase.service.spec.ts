import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  let service: FirebaseService;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirebaseService],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves FIREBASE_PRIVATE_KEY when present', () => {
    process.env.FIREBASE_PRIVATE_KEY = 'line1\\nline2';
    expect((service as any).resolvePrivateKey()).toBe('line1\nline2');
  });

  it('falls back to legacy FIREBASE_PRIVATE_KEY_ID when it contains a PEM key', () => {
    process.env.FIREBASE_PRIVATE_KEY = '';
    process.env.FIREBASE_PRIVATE_KEY_ID = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n';

    expect((service as any).resolvePrivateKey()).toContain('BEGIN PRIVATE KEY');
  });
});
