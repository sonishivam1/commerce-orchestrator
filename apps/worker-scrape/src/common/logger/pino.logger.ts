import { LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

/**
 * Pino-backed implementation of NestJS LoggerService.
 * Passes structured JSON logs through pino so all API log output
 * is machine-parseable and level-filterable in production.
 * In development (NODE_ENV !== 'production') logs are pretty-printed.
 */
export class PinoLogger implements LoggerService {
    private readonly logger: Logger;

    constructor() {
        const isDev = process.env.NODE_ENV !== 'production';

        this.logger = pino({
            level: process.env.LOG_LEVEL ?? 'info',
            ...(isDev
                ? {
                      transport: {
                          target: 'pino-pretty',
                          options: {
                              colorize: true,
                              translateTime: 'SYS:HH:MM:ss',
                              ignore: 'pid,hostname',
                          },
                      },
                  }
                : {}),
        });
    }

    log(message: any, context?: string): void {
        this.logger.info({ context }, this.formatMessage(message));
    }

    error(message: any, trace?: string, context?: string): void {
        this.logger.error({ context, trace }, this.formatMessage(message));
    }

    warn(message: any, context?: string): void {
        this.logger.warn({ context }, this.formatMessage(message));
    }

    debug(message: any, context?: string): void {
        this.logger.debug({ context }, this.formatMessage(message));
    }

    verbose(message: any, context?: string): void {
        this.logger.trace({ context }, this.formatMessage(message));
    }

    fatal(message: any, context?: string): void {
        this.logger.fatal({ context }, this.formatMessage(message));
    }

    private formatMessage(message: any): string {
        if (typeof message === 'string') return message;
        try {
            return JSON.stringify(message);
        } catch {
            return String(message);
        }
    }
}
