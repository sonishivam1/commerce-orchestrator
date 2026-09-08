import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@cdo/shared';

registerEnumType(UserRole, { name: 'UserRole' });

/** A user within an organization. */
@ObjectType()
export class TenantType {
    @Field(() => ID)
    id: string;

    @Field()
    name: string;

    @Field()
    email: string;

    @Field(() => UserRole)
    role: UserRole;

    @Field()
    status: string;

    /** The organization id this user belongs to. */
    @Field()
    tenantId: string;

    @Field()
    createdAt: Date;
}
