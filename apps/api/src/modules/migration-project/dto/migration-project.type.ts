import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { MigrationProjectStatus, MigrationMode, ExportFormat } from '@cdo/shared';

registerEnumType(MigrationProjectStatus, { name: 'MigrationProjectStatus' });

@ObjectType()
export class MigrationProjectType {
    @Field(() => ID)
    id: string;

    @Field()
    tenantId: string;

    @Field()
    name: string;

    @Field(() => MigrationMode)
    mode: MigrationMode;

    /** References the source Credential/_id */
    @Field()
    sourceConnectionId: string;

    /** References the target Credential/_id — null for EXPORT mode */
    @Field({ nullable: true })
    targetConnectionId?: string;

    /** Output format — null for MIGRATE mode */
    @Field(() => ExportFormat, { nullable: true })
    exportFormat?: ExportFormat;

    @Field(() => [String])
    entityTypes: string[];

    /** Field mapping config — v1 is a JSON blob; returns {} when not configured */
    @Field(() => String, { description: 'JSON-serialised mapping configuration' })
    mappingConfig: string;

    @Field(() => MigrationProjectStatus)
    status: MigrationProjectStatus;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}
