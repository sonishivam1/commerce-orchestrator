import { gql } from '@apollo/client';

export const GET_JOBS = gql`
  query GetJobs {
    jobs {
      id
      tenantId
      kind
      status
      traceId
      createdAt
      completedAt
      processedCount
      failedCount
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
      traceId
      createdAt
      completedAt
      processedCount
      failedCount
    }
  }
`;
