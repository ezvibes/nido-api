import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: 'http://localhost:5173', // Allow only your frontend to access
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Allow cookies/sessions if needed
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nido API')
    .setDescription(
      'Nido concert ingestion, calendar sync, Top Picks, and admin review APIs.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api-docs-json',
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
