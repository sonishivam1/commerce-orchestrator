import { gql } from "@apollo/client";
import * as Apollo from "@apollo/client";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: any; output: any };
  JSONObject: { input: any; output: any };
};

export type AuthPayloadType = {
  __typename?: "AuthPayloadType";
  accessToken: Scalars["String"]["output"];
  tenantId: Scalars["String"]["output"];
};

export type CreateJobInput = {
  kind: JobKind;
  sourceCredentialId: Scalars["String"]["input"];
  sourceUrl?: InputMaybe<Scalars["String"]["input"]>;
  targetCredentialId?: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateTenantInput = {
  email: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
};

export type CredentialType = {
  __typename?: "CredentialType";
  alias: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  platform: Scalars["String"]["output"];
  tenantId: Scalars["String"]["output"];
};

export type DlqItem = {
  __typename?: "DlqItem";
  canReplay: Scalars["Boolean"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  errorMessage: Scalars["String"]["output"];
  errorType: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  itemKey: Scalars["String"]["output"];
  jobId: Scalars["String"]["output"];
  rawPayload: Scalars["JSONObject"]["output"];
  replayed: Scalars["Boolean"]["output"];
  replayedAt?: Maybe<Scalars["DateTime"]["output"]>;
  tenantId: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export enum JobKind {
  CrossPlatformMigration = "CROSS_PLATFORM_MIGRATION",
  Export = "EXPORT",
  PlatformClone = "PLATFORM_CLONE",
  ScrapeImport = "SCRAPE_IMPORT",
}

export enum JobStatus {
  Completed = "COMPLETED",
  Failed = "FAILED",
  Paused = "PAUSED",
  Pending = "PENDING",
  Running = "RUNNING",
}

export type JobType = {
  __typename?: "JobType";
  completedAt?: Maybe<Scalars["DateTime"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  failedCount: Scalars["Float"]["output"];
  id: Scalars["ID"]["output"];
  kind: JobKind;
  processedCount: Scalars["Float"]["output"];
  status: JobStatus;
  tenantId: Scalars["String"]["output"];
  traceId?: Maybe<Scalars["String"]["output"]>;
};

export type Mutation = {
  __typename?: "Mutation";
  /** Enqueue a new ETL or Scrape job. */
  createJob: JobType;
  /** Register a new tenant (onboarding). */
  createTenant: TenantType;
  /** Delete a stored credential by ID. */
  deleteCredential: Scalars["Boolean"]["output"];
  /** Login and receive a signed JWT token. */
  login: AuthPayloadType;
  replayDlqItem: Scalars["Boolean"]["output"];
  /** Store a new encrypted platform credential. */
  storeCredential: CredentialType;
};

export type MutationCreateJobArgs = {
  input: CreateJobInput;
};

export type MutationCreateTenantArgs = {
  input: CreateTenantInput;
};

export type MutationDeleteCredentialArgs = {
  id: Scalars["String"]["input"];
};

export type MutationLoginArgs = {
  email: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
};

export type MutationReplayDlqItemArgs = {
  input: ReplayDlqItemInput;
};

export type MutationStoreCredentialArgs = {
  input: StoreCredentialInput;
};

export type Query = {
  __typename?: "Query";
  /** List stored credentials for the current tenant. */
  credentials: Array<CredentialType>;
  dlqItems: Array<DlqItem>;
  /** Get a single job by ID. */
  job?: Maybe<JobType>;
  /** List all jobs for the current tenant. */
  jobs: Array<JobType>;
  /** Get the current authenticated tenant profile. */
  me?: Maybe<TenantType>;
};

export type QueryDlqItemsArgs = {
  jobId: Scalars["String"]["input"];
};

export type QueryJobArgs = {
  id: Scalars["String"]["input"];
};

export type ReplayDlqItemInput = {
  dlqItemId: Scalars["ID"]["input"];
};

export type StoreCredentialInput = {
  alias: Scalars["String"]["input"];
  platform: Scalars["String"]["input"];
  rawPayload: Scalars["String"]["input"];
};

export type TenantType = {
  __typename?: "TenantType";
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type CreateJobMutationVariables = Exact<{
  input: CreateJobInput;
}>;

export type CreateJobMutation = {
  __typename?: "Mutation";
  createJob: {
    __typename?: "JobType";
    id: string;
    kind: JobKind;
    status: JobStatus;
    createdAt: any;
  };
};

export type ReplayDlqItemMutationVariables = Exact<{
  input: ReplayDlqItemInput;
}>;

export type ReplayDlqItemMutation = {
  __typename?: "Mutation";
  replayDlqItem: boolean;
};

export type LoginMutationVariables = Exact<{
  email: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
}>;

export type LoginMutation = {
  __typename?: "Mutation";
  login: {
    __typename?: "AuthPayloadType";
    accessToken: string;
    tenantId: string;
  };
};

export type CreateTenantMutationVariables = Exact<{
  input: CreateTenantInput;
}>;

export type CreateTenantMutation = {
  __typename?: "Mutation";
  createTenant: {
    __typename?: "TenantType";
    id: string;
    name: string;
    email: string;
  };
};

export type StoreCredentialMutationVariables = Exact<{
  input: StoreCredentialInput;
}>;

export type StoreCredentialMutation = {
  __typename?: "Mutation";
  storeCredential: {
    __typename?: "CredentialType";
    id: string;
    platform: string;
    alias: string;
    createdAt: any;
  };
};

export type DeleteCredentialMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteCredentialMutation = {
  __typename?: "Mutation";
  deleteCredential: boolean;
};

export type GetCredentialsQueryVariables = Exact<{ [key: string]: never }>;

export type GetCredentialsQuery = {
  __typename?: "Query";
  credentials: Array<{
    __typename?: "CredentialType";
    id: string;
    platform: string;
    alias: string;
    createdAt: any;
  }>;
};

export type GetDlqItemsQueryVariables = Exact<{
  jobId: Scalars["String"]["input"];
}>;

export type GetDlqItemsQuery = {
  __typename?: "Query";
  dlqItems: Array<{
    __typename?: "DlqItem";
    id: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload: any;
  }>;
};

export type GetMeQueryVariables = Exact<{ [key: string]: never }>;

export type GetMeQuery = {
  __typename?: "Query";
  me?: {
    __typename?: "TenantType";
    id: string;
    name: string;
    email: string;
  } | null;
};

export type GetJobsQueryVariables = Exact<{ [key: string]: never }>;

export type GetJobsQuery = {
  __typename?: "Query";
  jobs: Array<{
    __typename?: "JobType";
    id: string;
    tenantId: string;
    kind: JobKind;
    status: JobStatus;
    traceId?: string | null;
    createdAt: any;
    completedAt?: any | null;
    processedCount: number;
    failedCount: number;
  }>;
};

export type GetJobQueryVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type GetJobQuery = {
  __typename?: "Query";
  job?: {
    __typename?: "JobType";
    id: string;
    tenantId: string;
    kind: JobKind;
    status: JobStatus;
    traceId?: string | null;
    createdAt: any;
    completedAt?: any | null;
    processedCount: number;
    failedCount: number;
  } | null;
};

export const CreateJobDocument = gql`
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
      kind
      status
      createdAt
    }
  }
`;
export type CreateJobMutationFn = Apollo.MutationFunction<
  CreateJobMutation,
  CreateJobMutationVariables
>;

/**
 * __useCreateJobMutation__
 *
 * To run a mutation, you first call `useCreateJobMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateJobMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createJobMutation, { data, loading, error }] = useCreateJobMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateJobMutation(
  baseOptions?: Apollo.MutationHookOptions<
    CreateJobMutation,
    CreateJobMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<CreateJobMutation, CreateJobMutationVariables>(
    CreateJobDocument,
    options,
  );
}
export type CreateJobMutationHookResult = ReturnType<
  typeof useCreateJobMutation
>;
export type CreateJobMutationResult = Apollo.MutationResult<CreateJobMutation>;
export type CreateJobMutationOptions = Apollo.BaseMutationOptions<
  CreateJobMutation,
  CreateJobMutationVariables
>;
export const ReplayDlqItemDocument = gql`
  mutation ReplayDlqItem($input: ReplayDlqItemInput!) {
    replayDlqItem(input: $input)
  }
`;
export type ReplayDlqItemMutationFn = Apollo.MutationFunction<
  ReplayDlqItemMutation,
  ReplayDlqItemMutationVariables
>;

/**
 * __useReplayDlqItemMutation__
 *
 * To run a mutation, you first call `useReplayDlqItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useReplayDlqItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [replayDlqItemMutation, { data, loading, error }] = useReplayDlqItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useReplayDlqItemMutation(
  baseOptions?: Apollo.MutationHookOptions<
    ReplayDlqItemMutation,
    ReplayDlqItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    ReplayDlqItemMutation,
    ReplayDlqItemMutationVariables
  >(ReplayDlqItemDocument, options);
}
export type ReplayDlqItemMutationHookResult = ReturnType<
  typeof useReplayDlqItemMutation
>;
export type ReplayDlqItemMutationResult =
  Apollo.MutationResult<ReplayDlqItemMutation>;
export type ReplayDlqItemMutationOptions = Apollo.BaseMutationOptions<
  ReplayDlqItemMutation,
  ReplayDlqItemMutationVariables
>;
export const LoginDocument = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      tenantId
    }
  }
`;
export type LoginMutationFn = Apollo.MutationFunction<
  LoginMutation,
  LoginMutationVariables
>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      email: // value for 'email'
 *      password: // value for 'password'
 *   },
 * });
 */
export function useLoginMutation(
  baseOptions?: Apollo.MutationHookOptions<
    LoginMutation,
    LoginMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<LoginMutation, LoginMutationVariables>(
    LoginDocument,
    options,
  );
}
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<
  LoginMutation,
  LoginMutationVariables
>;
export const CreateTenantDocument = gql`
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      id
      name
      email
    }
  }
`;
export type CreateTenantMutationFn = Apollo.MutationFunction<
  CreateTenantMutation,
  CreateTenantMutationVariables
>;

/**
 * __useCreateTenantMutation__
 *
 * To run a mutation, you first call `useCreateTenantMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateTenantMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createTenantMutation, { data, loading, error }] = useCreateTenantMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateTenantMutation(
  baseOptions?: Apollo.MutationHookOptions<
    CreateTenantMutation,
    CreateTenantMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    CreateTenantMutation,
    CreateTenantMutationVariables
  >(CreateTenantDocument, options);
}
export type CreateTenantMutationHookResult = ReturnType<
  typeof useCreateTenantMutation
>;
export type CreateTenantMutationResult =
  Apollo.MutationResult<CreateTenantMutation>;
export type CreateTenantMutationOptions = Apollo.BaseMutationOptions<
  CreateTenantMutation,
  CreateTenantMutationVariables
>;
export const StoreCredentialDocument = gql`
  mutation StoreCredential($input: StoreCredentialInput!) {
    storeCredential(input: $input) {
      id
      platform
      alias
      createdAt
    }
  }
`;
export type StoreCredentialMutationFn = Apollo.MutationFunction<
  StoreCredentialMutation,
  StoreCredentialMutationVariables
>;

/**
 * __useStoreCredentialMutation__
 *
 * To run a mutation, you first call `useStoreCredentialMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStoreCredentialMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [storeCredentialMutation, { data, loading, error }] = useStoreCredentialMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useStoreCredentialMutation(
  baseOptions?: Apollo.MutationHookOptions<
    StoreCredentialMutation,
    StoreCredentialMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    StoreCredentialMutation,
    StoreCredentialMutationVariables
  >(StoreCredentialDocument, options);
}
export type StoreCredentialMutationHookResult = ReturnType<
  typeof useStoreCredentialMutation
>;
export type StoreCredentialMutationResult =
  Apollo.MutationResult<StoreCredentialMutation>;
export type StoreCredentialMutationOptions = Apollo.BaseMutationOptions<
  StoreCredentialMutation,
  StoreCredentialMutationVariables
>;
export const DeleteCredentialDocument = gql`
  mutation DeleteCredential($id: String!) {
    deleteCredential(id: $id)
  }
`;
export type DeleteCredentialMutationFn = Apollo.MutationFunction<
  DeleteCredentialMutation,
  DeleteCredentialMutationVariables
>;

/**
 * __useDeleteCredentialMutation__
 *
 * To run a mutation, you first call `useDeleteCredentialMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteCredentialMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteCredentialMutation, { data, loading, error }] = useDeleteCredentialMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteCredentialMutation(
  baseOptions?: Apollo.MutationHookOptions<
    DeleteCredentialMutation,
    DeleteCredentialMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<
    DeleteCredentialMutation,
    DeleteCredentialMutationVariables
  >(DeleteCredentialDocument, options);
}
export type DeleteCredentialMutationHookResult = ReturnType<
  typeof useDeleteCredentialMutation
>;
export type DeleteCredentialMutationResult =
  Apollo.MutationResult<DeleteCredentialMutation>;
export type DeleteCredentialMutationOptions = Apollo.BaseMutationOptions<
  DeleteCredentialMutation,
  DeleteCredentialMutationVariables
>;
export const GetCredentialsDocument = gql`
  query GetCredentials {
    credentials {
      id
      platform
      alias
      createdAt
    }
  }
`;

/**
 * __useGetCredentialsQuery__
 *
 * To run a query within a React component, call `useGetCredentialsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCredentialsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCredentialsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCredentialsQuery(
  baseOptions?: Apollo.QueryHookOptions<
    GetCredentialsQuery,
    GetCredentialsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetCredentialsQuery, GetCredentialsQueryVariables>(
    GetCredentialsDocument,
    options,
  );
}
export function useGetCredentialsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    GetCredentialsQuery,
    GetCredentialsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetCredentialsQuery, GetCredentialsQueryVariables>(
    GetCredentialsDocument,
    options,
  );
}
// @ts-ignore
export function useGetCredentialsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<
    GetCredentialsQuery,
    GetCredentialsQueryVariables
  >,
): Apollo.UseSuspenseQueryResult<
  GetCredentialsQuery,
  GetCredentialsQueryVariables
>;
export function useGetCredentialsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        GetCredentialsQuery,
        GetCredentialsQueryVariables
      >,
): Apollo.UseSuspenseQueryResult<
  GetCredentialsQuery | undefined,
  GetCredentialsQueryVariables
>;
export function useGetCredentialsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        GetCredentialsQuery,
        GetCredentialsQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    GetCredentialsQuery,
    GetCredentialsQueryVariables
  >(GetCredentialsDocument, options);
}
export type GetCredentialsQueryHookResult = ReturnType<
  typeof useGetCredentialsQuery
>;
export type GetCredentialsLazyQueryHookResult = ReturnType<
  typeof useGetCredentialsLazyQuery
>;
export type GetCredentialsSuspenseQueryHookResult = ReturnType<
  typeof useGetCredentialsSuspenseQuery
>;
export type GetCredentialsQueryResult = Apollo.QueryResult<
  GetCredentialsQuery,
  GetCredentialsQueryVariables
>;
export const GetDlqItemsDocument = gql`
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

/**
 * __useGetDlqItemsQuery__
 *
 * To run a query within a React component, call `useGetDlqItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDlqItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDlqItemsQuery({
 *   variables: {
 *      jobId: // value for 'jobId'
 *   },
 * });
 */
export function useGetDlqItemsQuery(
  baseOptions: Apollo.QueryHookOptions<
    GetDlqItemsQuery,
    GetDlqItemsQueryVariables
  > &
    (
      | { variables: GetDlqItemsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetDlqItemsQuery, GetDlqItemsQueryVariables>(
    GetDlqItemsDocument,
    options,
  );
}
export function useGetDlqItemsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    GetDlqItemsQuery,
    GetDlqItemsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetDlqItemsQuery, GetDlqItemsQueryVariables>(
    GetDlqItemsDocument,
    options,
  );
}
// @ts-ignore
export function useGetDlqItemsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<
    GetDlqItemsQuery,
    GetDlqItemsQueryVariables
  >,
): Apollo.UseSuspenseQueryResult<GetDlqItemsQuery, GetDlqItemsQueryVariables>;
export function useGetDlqItemsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        GetDlqItemsQuery,
        GetDlqItemsQueryVariables
      >,
): Apollo.UseSuspenseQueryResult<
  GetDlqItemsQuery | undefined,
  GetDlqItemsQueryVariables
>;
export function useGetDlqItemsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        GetDlqItemsQuery,
        GetDlqItemsQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetDlqItemsQuery, GetDlqItemsQueryVariables>(
    GetDlqItemsDocument,
    options,
  );
}
export type GetDlqItemsQueryHookResult = ReturnType<typeof useGetDlqItemsQuery>;
export type GetDlqItemsLazyQueryHookResult = ReturnType<
  typeof useGetDlqItemsLazyQuery
>;
export type GetDlqItemsSuspenseQueryHookResult = ReturnType<
  typeof useGetDlqItemsSuspenseQuery
>;
export type GetDlqItemsQueryResult = Apollo.QueryResult<
  GetDlqItemsQuery,
  GetDlqItemsQueryVariables
>;
export const GetMeDocument = gql`
  query GetMe {
    me {
      id
      name
      email
    }
  }
`;

/**
 * __useGetMeQuery__
 *
 * To run a query within a React component, call `useGetMeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMeQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetMeQuery(
  baseOptions?: Apollo.QueryHookOptions<GetMeQuery, GetMeQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
export function useGetMeLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetMeQuery, GetMeQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
// @ts-ignore
export function useGetMeSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<
    GetMeQuery,
    GetMeQueryVariables
  >,
): Apollo.UseSuspenseQueryResult<GetMeQuery, GetMeQueryVariables>;
export function useGetMeSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetMeQuery, GetMeQueryVariables>,
): Apollo.UseSuspenseQueryResult<GetMeQuery | undefined, GetMeQueryVariables>;
export function useGetMeSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetMeQuery, GetMeQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
export type GetMeQueryHookResult = ReturnType<typeof useGetMeQuery>;
export type GetMeLazyQueryHookResult = ReturnType<typeof useGetMeLazyQuery>;
export type GetMeSuspenseQueryHookResult = ReturnType<
  typeof useGetMeSuspenseQuery
>;
export type GetMeQueryResult = Apollo.QueryResult<
  GetMeQuery,
  GetMeQueryVariables
>;
export const GetJobsDocument = gql`
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

/**
 * __useGetJobsQuery__
 *
 * To run a query within a React component, call `useGetJobsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetJobsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetJobsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetJobsQuery(
  baseOptions?: Apollo.QueryHookOptions<GetJobsQuery, GetJobsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetJobsQuery, GetJobsQueryVariables>(
    GetJobsDocument,
    options,
  );
}
export function useGetJobsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    GetJobsQuery,
    GetJobsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetJobsQuery, GetJobsQueryVariables>(
    GetJobsDocument,
    options,
  );
}
// @ts-ignore
export function useGetJobsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<
    GetJobsQuery,
    GetJobsQueryVariables
  >,
): Apollo.UseSuspenseQueryResult<GetJobsQuery, GetJobsQueryVariables>;
export function useGetJobsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetJobsQuery, GetJobsQueryVariables>,
): Apollo.UseSuspenseQueryResult<
  GetJobsQuery | undefined,
  GetJobsQueryVariables
>;
export function useGetJobsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetJobsQuery, GetJobsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetJobsQuery, GetJobsQueryVariables>(
    GetJobsDocument,
    options,
  );
}
export type GetJobsQueryHookResult = ReturnType<typeof useGetJobsQuery>;
export type GetJobsLazyQueryHookResult = ReturnType<typeof useGetJobsLazyQuery>;
export type GetJobsSuspenseQueryHookResult = ReturnType<
  typeof useGetJobsSuspenseQuery
>;
export type GetJobsQueryResult = Apollo.QueryResult<
  GetJobsQuery,
  GetJobsQueryVariables
>;
export const GetJobDocument = gql`
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

/**
 * __useGetJobQuery__
 *
 * To run a query within a React component, call `useGetJobQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetJobQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetJobQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetJobQuery(
  baseOptions: Apollo.QueryHookOptions<GetJobQuery, GetJobQueryVariables> &
    ({ variables: GetJobQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetJobQuery, GetJobQueryVariables>(
    GetJobDocument,
    options,
  );
}
export function useGetJobLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetJobQuery, GetJobQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetJobQuery, GetJobQueryVariables>(
    GetJobDocument,
    options,
  );
}
// @ts-ignore
export function useGetJobSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<
    GetJobQuery,
    GetJobQueryVariables
  >,
): Apollo.UseSuspenseQueryResult<GetJobQuery, GetJobQueryVariables>;
export function useGetJobSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetJobQuery, GetJobQueryVariables>,
): Apollo.UseSuspenseQueryResult<GetJobQuery | undefined, GetJobQueryVariables>;
export function useGetJobSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<GetJobQuery, GetJobQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetJobQuery, GetJobQueryVariables>(
    GetJobDocument,
    options,
  );
}
export type GetJobQueryHookResult = ReturnType<typeof useGetJobQuery>;
export type GetJobLazyQueryHookResult = ReturnType<typeof useGetJobLazyQuery>;
export type GetJobSuspenseQueryHookResult = ReturnType<
  typeof useGetJobSuspenseQuery
>;
export type GetJobQueryResult = Apollo.QueryResult<
  GetJobQuery,
  GetJobQueryVariables
>;
