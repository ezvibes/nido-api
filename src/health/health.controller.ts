import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BasicHealthResponse,
  DeepHealthResponse,
  HealthService,
} from './health.service';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API process health' })
  @ApiOkResponse({
    description: 'The API process is running.',
    schema: {
      example: {
        status: 'ok',
        service: 'nido-api',
        timestamp: '2026-06-17T00:00:00.000Z',
      },
    },
  })
  getHealth(): BasicHealthResponse {
    return this.healthService.getHealth();
  }

  @Get('deep')
  @ApiOperation({ summary: 'Check API dependencies and runtime config' })
  @ApiOkResponse({
    description:
      'Dependency readiness for database, Firebase, GCS, Google Calendar, and Gemini config.',
  })
  async getDeepHealth(): Promise<DeepHealthResponse> {
    return this.healthService.getDeepHealth();
  }
}
