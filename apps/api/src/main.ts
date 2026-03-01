import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 4000);
    console.log(`🚀 API server running on http://localhost:${process.env.PORT ?? 4000}/graphql`);
}

bootstrap();
