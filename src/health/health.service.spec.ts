import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { FirebaseService } from '../firebase/firebase.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  function createService(options?: {
    query?: jest.Mock;
    firebaseInitialized?: boolean;
    env?: Record<string, string | undefined>;
  }) {
    const env = {
      FIREBASE_PROJECT_ID: 'nido-api-9ed65',
      FIREBASE_CLIENT_EMAIL:
        'firebase-adminsdk-fbsvc@nido-api-9ed65.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: 'set',
      GCS_INGESTION_BUCKET: 'nido-concert-image-ingestion-dev',
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL:
        'sync-doctor-calendar@nido-api.iam.gserviceaccount.com',
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY: 'set',
      GEMINI_API_KEY: 'set',
      GEMINI_MODEL: 'gemini-2.5-flash',
      ...options?.env,
    };
    const dataSource = {
      isInitialized: true,
      query: options?.query ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource;
    const configService = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    const firebaseService = {
      isInitialized: jest.fn(() => options?.firebaseInitialized ?? true),
    } as unknown as FirebaseService;

    return new HealthService(dataSource, configService, firebaseService);
  }

  it('returns process health', () => {
    const service = createService();

    expect(service.getHealth()).toMatchObject({
      status: 'ok',
      service: 'nido-api',
    });
  });

  it('returns ok deep health when dependencies are configured', async () => {
    const service = createService();

    await expect(service.getDeepHealth()).resolves.toMatchObject({
      status: 'ok',
      checks: {
        database: { status: 'ok' },
        firebase: { status: 'ok' },
        gcs: { status: 'ok' },
        googleCalendar: { status: 'ok' },
        gemini: { status: 'ok' },
      },
    });
  });

  it('returns degraded deep health when database check fails', async () => {
    const service = createService({
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(service.getDeepHealth()).resolves.toMatchObject({
      status: 'degraded',
      checks: {
        database: {
          status: 'degraded',
          message: 'connection refused',
        },
      },
    });
  });

  it('returns degraded deep health when Firebase config is incomplete', async () => {
    const service = createService({
      firebaseInitialized: false,
      env: {
        FIREBASE_PRIVATE_KEY: undefined,
      },
    });

    await expect(service.getDeepHealth()).resolves.toMatchObject({
      status: 'degraded',
      checks: {
        firebase: {
          status: 'degraded',
          details: {
            privateKey: false,
            initialized: false,
          },
        },
      },
    });
  });
});
