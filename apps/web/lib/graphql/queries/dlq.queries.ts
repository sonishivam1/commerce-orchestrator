import { gql } from '@apollo/client';

export const GET_DLQ_ITEMS = gql`
  query GetDlqItems($jobId: String!) {
    dlqItems(jobId: $jobId) {
      id
      jobId
      itemKey
      errorType
      errorMessage
      rawPayload
      canReplay
      replayed
      replayedAt
      createdAt
    }
  }
`;

export const GET_DLQ_PENDING_COUNT = gql`
  query GetDlqPendingCount($jobId: String!) {
    dlqPendingCount(jobId: $jobId)
  }
`;

