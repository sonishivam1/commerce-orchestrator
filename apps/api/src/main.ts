import { NestFactory } from '@nestjs/core';
import { PinoLogger } from './common/logger/pino.logger';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new PinoLogger();
    const app = await NestFactory.create(AppModule, { logger });

    /**
     * CORS: allow the Next.js frontend to call this API.
     *
     * - credentials: true — needed for cookies (not used currently, but safe to set)
     * - methods: GraphQL uses POST for queries/mutations, GET for introspection
     * - allowedHeaders: Authorization carries the JWT token
     *
     * In production, replace `origin: true` with the exact frontend URL.
     */
    app.enableCors({
        origin: true,       // reflect the request origin (all origins in dev)
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight'],
    });

    const port = process.env.PORT ?? process.env.API_PORT ?? 4000;
    const host = process.env.HOST ?? '0.0.0.0';   // listen on all interfaces so forwarded traffic works
    await app.listen(port, host);
    logger.log(`🚀 API server listening on http://${host}:${port}/graphql`);
}

bootstrap();
