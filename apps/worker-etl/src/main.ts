import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
    const app = await NestFactory.create(WorkerModule);
    await app.init();
    console.log('🔄 Worker process started — listening to BullMQ queues');
}

bootstrap();
