import { gql } from '@apollo/client';

// ── Migration Projects ──────────────────────────────────────────────────────

export const GET_MIGRATION_PROJECTS = gql`
  query GetMigrationProjects {
    migrationProjects {
      id
      name
      mode
      sourceConnectionId
      targetConnectionId
      exportFormat
      entityTypes
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_MIGRATION_PROJECT = gql`
  query GetMigrationProject($id: ID!) {
    migrationProject(id: $id) {
      id
      name
      mode
      sourceConnectionId
      targetConnectionId
      exportFormat
      entityTypes
      status
      mappingConfig
      createdAt
      updatedAt
    }
  }
`;

// ── Recent Runs (dashboard) ─────────────────────────────────────────────────

export const GET_RECENT_MIGRATION_RUNS = gql`
  query GetRecentMigrationRuns($limit: Int) {
    recentMigrationRuns(limit: $limit) {
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
      startedAt
      completedAt
      createdAt
    }
  }
`;

// ── Migration Runs ──────────────────────────────────────────────────────────

export const GET_MIGRATION_RUNS = gql`
  query GetMigrationRuns($migrationProjectId: ID!) {
    migrationRuns(migrationProjectId: $migrationProjectId) {
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
        startedAt
        completedAt
      }
      startedAt
      completedAt
      correlationId
      createdAt
    }
  }
`;

export const GET_MIGRATION_RUN = gql`
  query GetMigrationRun($id: ID!) {
    migrationRun(id: $id) {
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
        startedAt
        completedAt
      }
      failedItems {
        entityType
        sourceId
        reason
        errorType
        occurredAt
      }
      export {
        filePath
        byteSize
        format
      }
      startedAt
      completedAt
      correlationId
      createdAt
    }
  }
`;

