import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    // Point at running NestJS API or a local schema file
    schema: process.env.GQL_SCHEMA_URL ?? `http://${process.env.HOST ?? 'localhost'}:${process.env.PORT ?? 4000}/graphql`,

    // Scan all apps and packages for GraphQL operations and fragments
    documents: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],

    generates: {
        // 1. Full TypeScript type definitions from the schema
        './src/generated/types.ts': {
            plugins: ['typescript'],
            config: {
                scalars: {
                    Date: 'string',
                    DateTime: 'string',
                    JSON: 'Record<string, unknown>',
                    Upload: 'File',
                },
                enumsAsTypes: true,
                nonOptionalTypename: true,
            },
        },

        // 2. Operation-specific types (queries/mutations used in the frontend)
        './src/generated/operations.ts': {
            plugins: ['typescript', 'typescript-operations'],
            config: {
                enumsAsTypes: true,
            },
        },

        // 3. React Apollo hooks (auto-generated typed useQuery / useMutation hooks)
        './src/generated/hooks.ts': {
            plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
            config: {
                withHooks: true,
                withComponent: false,
                withHOC: false,
            },
        },

        // 4. Schema introspection JSON (for tooling / IDE support)
        './src/generated/schema.json': {
            plugins: ['introspection'],
        },
    },

    hooks: {
        afterAllFileWrite: ['prettier --write'],
    },
};

export default config;
