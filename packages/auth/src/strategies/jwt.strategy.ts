import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
    /** userId */
    sub: string;
    tenantId: string;
    email: string;
    role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-production',
        });
    }

    async validate(payload: JwtPayload) {
        return {
            userId: payload.sub,
            tenantId: payload.tenantId,
            email: payload.email,
            role: payload.role,
        };
    }
}
