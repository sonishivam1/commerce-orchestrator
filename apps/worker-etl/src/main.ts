import { NestFactory } from '@nestjs/core';
import { PinoLogger } from './common/logger/pino.logger';
import { WorkerModule } from './worker.module';

async function bootstrap() {
    const logger = new PinoLogger();
    const app = await NestFactory.createApplicationContext(WorkerModule, { logger });
    await app.init();
    logger.log('🔄 Worker process started — listening to BullMQ queues');
}

bootstrap();
