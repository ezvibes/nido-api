import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, FirebaseModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
