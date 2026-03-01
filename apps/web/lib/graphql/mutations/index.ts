import { gql } from '@apollo/client';

export const CREATE_JOB = gql`
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
      kind
      status
      createdAt
    }
  }
`;

export const REPLAY_JOB = gql`
  mutation ReplayJob($jobId: String!, $dlqItemId: String!) {
    replayJob(jobId: $jobId, dlqItemId: $dlqItemId) {
      id
      status
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
