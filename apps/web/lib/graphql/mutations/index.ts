import { gql } from '@apollo/client';

// ── Migration Project Mutations ─────────────────────────────────────────────

export const CREATE_MIGRATION_PROJECT = gql`
  mutation CreateMigrationProject($input: CreateMigrationProjectInput!) {
    createMigrationProject(input: $input) {
      id
      name
      sourceConnectionId
      targetConnectionId
      entityTypes
      status
      createdAt
    }
  }
`;

export const UPDATE_MIGRATION_PROJECT = gql`
  mutation UpdateMigrationProject($id: ID!, $input: UpdateMigrationProjectInput!) {
    updateMigrationProject(id: $id, input: $input) {
      id
      name
      status
      updatedAt
    }
  }
`;

export const ARCHIVE_MIGRATION_PROJECT = gql`
  mutation ArchiveMigrationProject($id: ID!) {
    archiveMigrationProject(id: $id)
  }
`;

export const CREATE_MIGRATION_RUN = gql`
  mutation CreateMigrationRun($input: CreateMigrationRunInput!) {
    createMigrationRun(input: $input) {
      id
      migrationProjectId
      status
      dryRun
      processedCount
      failedCount
      waves {
        entityType
        status
        processedCount
        failedCount
      }
      createdAt
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      tenantId
    }
  }
`;

export const CREATE_TENANT = gql`
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      id
      name
      email
    }
  }
`;

export const STORE_CREDENTIAL = gql`
  mutation StoreCredential($input: StoreCredentialInput!) {
    storeCredential(input: $input) {
      id
      platform
      alias
      createdAt
    }
  }
`;

export const DELETE_CREDENTIAL = gql`
  mutation DeleteCredential($id: String!) {
    deleteCredential(id: $id)
  }
`;
