const API_URL = 'http://localhost:3001/graphql';
const HEALTH_URL = 'http://localhost:3001/health';

async function fetchGraphQL(query, variables, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  
  const data = await res.json();
  if (data.errors) {
    throw new Error('GraphQL Errors: ' + JSON.stringify(data.errors, null, 2));
  }
  return data.data;
}

async function run() {
  console.log('1. Checking health endpoint...');
  const healthRes = await fetch(HEALTH_URL);
  console.log('Health status:', healthRes.status, await healthRes.text());

  const email = `test-${Date.now()}@example.com`;
  
  console.log('\n2. Creating tenant & logging in...');
  const createTenantQuery = `
    mutation CreateTenant($input: CreateTenantInput!) {
      createTenant(input: $input) {
        id
        name
      }
    }
  `;
  await fetchGraphQL(createTenantQuery, {
    input: {
      name: 'E2E Test Tenant',
      email,
      password: 'password123'
    }
  });
  
  const loginQuery = `
    mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        accessToken
      }
    }
  `;
  const loginData = await fetchGraphQL(loginQuery, {
    email,
    password: 'password123'
  });
  
  const token = loginData.login.accessToken;
  console.log('Obtained JWT token.');

  console.log('\n3. Creating source credential...');
  const storeCredQuery = `
    mutation StoreCredential($input: StoreCredentialInput!) {
      storeCredential(input: $input) {
        id
        alias
      }
    }
  `;
  const sourceCredData = await fetchGraphQL(storeCredQuery, {
    input: {
      platform: 'commercetools',
      alias: 'ct-source',
      rawPayload: JSON.stringify({ clientId: 'src-123', secret: 'abc' })
    }
  }, token);
  const sourceCredId = sourceCredData.storeCredential.id;
  console.log('Source Cred ID:', sourceCredId);

  console.log('\n4. Creating target credential...');
  const targetCredData = await fetchGraphQL(storeCredQuery, {
    input: {
      platform: 'shopify',
      alias: 'sh-target',
      rawPayload: JSON.stringify({ shop: 'target-shop', accessToken: 'xyz' })
    }
  }, token);
  const targetCredId = targetCredData.storeCredential.id;
  console.log('Target Cred ID:', targetCredId);

  console.log('\n5. Submitting createJob mutation...');
  const createJobQuery = `
    mutation CreateJob($input: CreateJobInput!) {
      createJob(input: $input) {
        id
        kind
        status
      }
    }
  `;
  const jobData = await fetchGraphQL(createJobQuery, {
    input: {
      kind: 'CROSS_PLATFORM_MIGRATION',
      sourceCredentialId: sourceCredId,
      targetCredentialId: targetCredId
    }
  }, token);
  
  const jobId = jobData.createJob.id;
  console.log('Created Job:', jobData.createJob);

  console.log('\n6. Polling job status...');
  const jobQuery = `
    query GetJob($id: String!) {
      job(id: $id) {
        id
        status
      }
    }
  `;
  
  for (let i = 0; i < 15; i++) {
    const checkData = await fetchGraphQL(jobQuery, { id: jobId }, token);
    const status = checkData.job.status;
    console.log(`Poll ${i+1}: Job status is ${status}`);
    if (status === 'COMPLETED' || status === 'FAILED') {
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('E2E test finished successfully!');
}

run().catch(err => {
  console.error('Error running E2E test:', err);
  process.exit(1);
});
