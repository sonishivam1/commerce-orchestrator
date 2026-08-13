import { NestFactory } from '@nestjs/core';
import { PinoLogger } from './common/logger/pino.logger';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new PinoLogger();
    const app = await NestFactory.create(AppModule, { logger });
    app.enableCors();
    const port = process.env.PORT ?? 4000;
    const host = process.env.HOST ?? 'localhost';
    await app.listen(port, host);
    logger.log(`🚀 API server running on http://${host}:${port}/graphql`);
}

bootstrap();
