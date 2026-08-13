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

export type JobKind =
  | "CROSS_PLATFORM_MIGRATION"
  | "EXPORT"
  | "PLATFORM_CLONE"
  | "SCRAPE_IMPORT";

export type JobStatus =
  | "COMPLETED"
  | "FAILED"
  | "PAUSED"
  | "PENDING"
  | "RUNNING";

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
