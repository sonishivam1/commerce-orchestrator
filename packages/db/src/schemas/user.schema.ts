import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '@cdo/shared';

/**
 * A person who signs in. Belongs to exactly one organization (`tenantId`).
 * Email is globally unique — a person cannot be in two organizations.
 */
export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
    /** Organization this user belongs to. */
    @Prop({ required: true, index: true })
    tenantId: string;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true })
    passwordHash: string;

    @Prop({ required: true })
    name: string;

    @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.MEMBER })
    role: string;

    @Prop({ default: 'active', enum: ['active', 'disabled'] })
    status: string;

    createdAt?: Date;
    updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1, createdAt: 1 });
