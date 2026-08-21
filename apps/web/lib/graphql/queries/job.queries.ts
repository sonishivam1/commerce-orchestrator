import { gql } from '@apollo/client';

export const GET_JOBS = gql`
  query GetJobs {
    jobs {
      id
      tenantId
      kind
      status
      entityTypes
      traceId
      createdAt
      startedAt
      completedAt
      processedCount
      failedCount
      sourceCredentialId
      targetCredentialId
      sourceUrl
      exportFilePath
    }
  }
`;

export const GET_JOB = gql`
  query GetJob($id: String!) {
    job(id: $id) {
      id
      tenantId
      kind
      status
      entityTypes
      traceId
      createdAt
      startedAt
      completedAt
      processedCount
      failedCount
      sourceCredentialId
      targetCredentialId
      sourceUrl
      exportFilePath
    }
  }
`;
