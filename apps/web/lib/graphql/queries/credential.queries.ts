import { gql } from '@apollo/client';

export const GET_CREDENTIALS = gql`
  query GetCredentials {
    credentials {
      id
      platform
      alias
      createdAt
    }
  }
`;

export const GET_CREDENTIAL = gql`
  query GetCredential($id: String!) {
    credential(id: $id) {
      id
      platform
      alias
      createdAt
      rawPayload
    }
  }
`;
