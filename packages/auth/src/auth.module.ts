/**
 * @file auth.module.ts
 * @package @cdo/auth
 *
 * NestJS Authentication module — wires JWT strategy and Passport together.
 *
 * Import this module in the root AppModule of the API app.
 * Once imported, you can protect any GraphQL resolver with:
 *   @UseGuards(GqlAuthGuard)
 *
 * JWT configuration reads from environment variables:
 * - JWT_SECRET   (required) — the signing secret; must be at least 32 characters
 * - JWT_EXPIRES_IN (optional) — token lifetime, defaults to '7d'
 *
 * The module throws on startup if JWT_SECRET is not set.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { GqlAuthGuard } from './guards/gql-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/** Fallback token lifetime — 7 days if JWT_EXPIRES_IN is not set in env */
const DEFAULT_TOKEN_EXPIRY = '7d';

/** Minimum accepted secret length — short secrets are a security risk */
const MIN_SECRET_LENGTH = 32;

/**
 * Reads and validates JWT configuration from environment variables.
 * Throws descriptively if JWT_SECRET is missing or too short.
 */
function getJwtConfig(): { secret: string; signOptions: { expiresIn: string } } {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            '[AuthModule] JWT_SECRET environment variable is not set. ' +
            'Please add a secure random string (min 32 characters) to your .env file.',
        );
    }

    if (secret.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `[AuthModule] JWT_SECRET is too short (${secret.length} chars). ` +
            `Minimum is ${MIN_SECRET_LENGTH} characters for security.`,
        );
    }

    const expiresIn = process.env.JWT_EXPIRES_IN ?? DEFAULT_TOKEN_EXPIRY;

    return { secret, signOptions: { expiresIn } };
}

@Module({
    imports: [
        // Passport registers the 'jwt' strategy globally — used by GqlAuthGuard
        PassportModule.register({ defaultStrategy: 'jwt' }),

        // JwtModule is exported so apps/api AuthService can sign new tokens
        JwtModule.registerAsync({
            useFactory: () => getJwtConfig(),
        }),
    ],
    providers: [
        // JwtStrategy validates incoming tokens and extracts tenantId/email
        JwtStrategy,
        // GqlAuthGuard is provided here so apps can inject it via UseGuards()
        GqlAuthGuard,
    ],
    exports: [
        // Export so the API can inject JwtService to sign tokens during login
        JwtModule,
        // Export guard so API feature modules can use it without re-importing AuthModule
        GqlAuthGuard,
    ],
})
export class AuthModule { }
