import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdminInstagramController } from './admin-instagram.controller';
import { InstagramConnection } from './entities/instagram-connection.entity';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramMediaService } from './instagram-media.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([InstagramConnection]),
    AuthModule,
  ],
  controllers: [AdminInstagramController],
  providers: [InstagramAuthService, InstagramMediaService],
  exports: [InstagramAuthService, InstagramMediaService],
})
export class InstagramModule {}
