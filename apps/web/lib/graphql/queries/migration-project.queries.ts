import { gql } from '@apollo/client';

// ── Migration Projects ──────────────────────────────────────────────────────

export const GET_MIGRATION_PROJECTS = gql`
  query GetMigrationProjects {
    migrationProjects {
      id
      name
      sourceConnectionId
      targetConnectionId
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
      sourceConnectionId
      targetConnectionId
      entityTypes
      status
      mappingConfig
      createdAt
      updatedAt
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
      startedAt
      completedAt
      correlationId
      createdAt
    }
  }
`;

// ── Reconciliation Reports ──────────────────────────────────────────────────

export const GET_RECONCILIATION_REPORT = gql`
  query GetReconciliationReport($migrationRunId: ID!) {
    reconciliationReport(migrationRunId: $migrationRunId) {
      id
      migrationRunId
      migrationProjectId
      generatedAt
      overallSuccessRate
      entitySummaries {
        entityType
        sourceCount
        migratedCount
        createdCount
        updatedCount
        failedCount
        missingRefCount
      }
    }
  }
`;

export const GET_RECONCILIATION_REPORTS = gql`
  query GetReconciliationReports($migrationProjectId: ID!) {
    reconciliationReports(migrationProjectId: $migrationProjectId) {
      id
      migrationRunId
      migrationProjectId
      generatedAt
      overallSuccessRate
      entitySummaries {
        entityType
        sourceCount
        migratedCount
        createdCount
        updatedCount
        failedCount
        missingRefCount
      }
    }
  }
`;
