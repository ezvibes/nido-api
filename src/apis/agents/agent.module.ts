import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../users/user.module';
import { IngestionModule } from '../../ingestion/ingestion.module';
import { NewsletterModule } from '../../newsletter/newsletter.module';
import { AgentSession } from './entities/agent-session.entity';
import { AgentMemory } from './entities/agent-memory.entity';
import { IngestionJob } from '../../ingestion/entities/ingestion-job.entity';
import { IngestionCandidate } from '../../ingestion/entities/ingestion-candidate.entity';
import { AgentSupervisorService } from './agent-supervisor.service';
import { AgentSupervisorController } from './agent-supervisor.controller';

@Global()
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UserModule,
    IngestionModule,
    NewsletterModule,
    TypeOrmModule.forFeature([
      AgentSession,
      AgentMemory,
      IngestionJob,
      IngestionCandidate,
    ]),
  ],
  controllers: [AgentSupervisorController],
  providers: [AgentSupervisorService],
  exports: [AgentSupervisorService],
})
export class AgentModule {}
