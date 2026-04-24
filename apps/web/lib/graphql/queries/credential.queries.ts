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
