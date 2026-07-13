import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './apis/users/user.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { ConcertModule } from './apis/concerts/concert.module';
import { VenueModule } from './apis/venues/venue.module';
import { BandModule } from './apis/bands/band.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IngestionModule } from './ingestion/ingestion.module';
import { ConcertSyncModule } from './concert-sync/concert-sync.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN') === 'true',
      }),
      inject: [ConfigService],
    }),
    UserModule,
    FirebaseModule,
    AuthModule,
    ConcertModule,
    VenueModule,
    BandModule,
    IngestionModule,
    ConcertSyncModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
