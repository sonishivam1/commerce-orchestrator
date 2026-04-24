import { gql } from '@apollo/client';

export const GET_DLQ_ITEMS = gql`
  query GetDlqItems($jobId: String!) {
    dlqItems(jobId: $jobId) {
      id
      itemKey
      errorType
      errorMessage
      rawPayload
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
    }
  }
`;
