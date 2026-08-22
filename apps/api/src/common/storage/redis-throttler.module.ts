import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Provides and exports RedisThrottlerStorage so it can be injected into
 * ThrottlerModule.forRootAsync via its `imports` array.
 */
@Module({
    providers: [RedisThrottlerStorage],
    exports:   [RedisThrottlerStorage],
})
export class RedisThrottlerModule {}
