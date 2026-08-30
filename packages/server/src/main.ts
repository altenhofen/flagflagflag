import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

const trustedOrigins = (process.env.ADMIN_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
