import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    const port = process.env.PORT ?? 4000;
    const host = process.env.HOST ?? 'localhost';
    await app.listen(port, host);
    console.log(`🚀 API server running on http://${host}:${port}/graphql`);
}

bootstrap();
