import { NestFactory } from '@nestjs/core';
import { PinoLogger } from './common/logger/pino.logger';
import { ScrapeWorkerModule } from './scrape-worker.module';

async function bootstrap() {
    const logger = new PinoLogger();
    const app = await NestFactory.createApplicationContext(ScrapeWorkerModule, { logger });
    await app.init();
    logger.log('🕷️  Scrape Worker started — listening to scrape-queue');
}

bootstrap();
