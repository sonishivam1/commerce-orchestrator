import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
      role
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrganizationMembers {
    organizationMembers {
      id
      name
      email
      role
      status
      createdAt
    }
  }
`;
