import { NestFactory } from '@nestjs/core';
import { ScrapeWorkerModule } from './scrape-worker.module';

async function bootstrap() {
    const app = await NestFactory.create(ScrapeWorkerModule);
    await app.init();
    console.log('🕷️  Scrape Worker started — listening to scrape-queue');
}

bootstrap();
