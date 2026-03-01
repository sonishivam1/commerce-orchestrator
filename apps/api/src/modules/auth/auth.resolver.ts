import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayloadType } from './dto/auth-payload.type';

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) { }

    @Mutation(() => AuthPayloadType, { description: 'Login and receive a signed JWT token.' })
    login(
        @Args('email') email: string,
        @Args('password') password: string,
    ) {
        return this.authService.login(email, password);
    }
}
