import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FirebaseService } from '../firebase/firebase.service';

export type HealthStatus = 'ok' | 'degraded';

export interface DependencyHealth {
  status: HealthStatus;
  message?: string;
  details?: Record<string, boolean | string | number | null>;
}

export interface BasicHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface DeepHealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
  checks: Record<string, DependencyHealth>;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
  ) {}

  getHealth(): BasicHealthResponse {
    return {
      status: 'ok',
      service: 'nido-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getDeepHealth(): Promise<DeepHealthResponse> {
    const checks = {
      database: await this.checkDatabase(),
      firebase: this.checkFirebase(),
      gcs: this.checkGcsConfig(),
      googleCalendar: this.checkGoogleCalendarConfig(),
      gemini: this.checkGeminiConfig(),
    };
    const status = Object.values(checks).every((check) => check.status === 'ok')
      ? 'ok'
      : 'degraded';

    return {
      status,
      service: 'nido-api',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    try {
      const startedAt = Date.now();
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        details: {
          connected: this.dataSource.isInitialized,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        message: this.toSafeErrorMessage(error),
        details: {
          connected: false,
        },
      };
    }
  }

  private checkFirebase(): DependencyHealth {
    const required = {
      projectId: this.hasConfig('FIREBASE_PROJECT_ID'),
      clientEmail: this.hasConfig('FIREBASE_CLIENT_EMAIL'),
      privateKey: this.hasConfig('FIREBASE_PRIVATE_KEY'),
    };
    const configured = Object.values(required).every(Boolean);
    const initialized = this.firebaseService.isInitialized();

    return {
      status: configured && initialized ? 'ok' : 'degraded',
      message:
        configured && initialized
          ? undefined
          : 'Firebase Admin credentials are incomplete or not initialized.',
      details: {
        ...required,
        initialized,
      },
    };
  }

  private checkGcsConfig(): DependencyHealth {
    const bucket = this.configService.get<string>('GCS_INGESTION_BUCKET');
    const configured = Boolean(bucket?.trim());

    return {
      status: configured ? 'ok' : 'degraded',
      message: configured ? undefined : 'GCS_INGESTION_BUCKET is not set.',
      details: {
        bucketConfigured: configured,
      },
    };
  }

  private checkGoogleCalendarConfig(): DependencyHealth {
    const required = {
      serviceAccountEmail: this.hasConfig(
        'GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL',
      ),
      serviceAccountPrivateKey: this.hasConfig(
        'GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY',
      ),
    };
    const configured = Object.values(required).every(Boolean);

    return {
      status: configured ? 'ok' : 'degraded',
      message: configured
        ? undefined
        : 'Google Calendar service account config is incomplete.',
      details: required,
    };
  }

  private checkGeminiConfig(): DependencyHealth {
    const apiKey = this.hasConfig('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_MODEL')?.trim();

    return {
      status: apiKey ? 'ok' : 'degraded',
      message: apiKey ? undefined : 'GEMINI_API_KEY is not set.',
      details: {
        apiKeyConfigured: apiKey,
        model: model || null,
      },
    };
  }

  private hasConfig(key: string) {
    return Boolean(this.configService.get<string>(key)?.trim());
  }

  private toSafeErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown health check error.';
  }
}
