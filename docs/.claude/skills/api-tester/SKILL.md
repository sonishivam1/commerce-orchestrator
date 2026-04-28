---
name: api-tester
description: API testing skill for Metafy AI Platform. Encodes how to manually test REST endpoints using curl and the GitHub CLI, how to write automated API test scenarios, how to test auth flows, multi-tenant isolation, and how to regression-test all endpoints in a service.
user-invocable: true
---

# API Tester Skill — Metafy AI Platform

## Getting a Test JWT Token

```bash
# 1. Register a test user (dev only)
curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}' | jq .

# 2. Login and capture token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | jq -r '.accessToken')

echo "Token: $TOKEN"

# 3. Export for reuse in the session
export AUTH_TOKEN=$TOKEN
export BASE_URL=http://localhost:9000  # via gateway
```

---

## curl Test Recipes

### CRUD Tests
```bash
# CREATE — expect 201
curl -s -X POST $BASE_URL/products \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","status":"active","description":"A test product"}' | jq .

# READ ALL — expect 200
curl -s $BASE_URL/products \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.[] | {id, name, status}'

# READ ONE — expect 200
PRODUCT_ID="replace-with-id"
curl -s $BASE_URL/products/$PRODUCT_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq .

# UPDATE — expect 200
curl -s -X PUT $BASE_URL/products/$PRODUCT_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}' | jq .

# DELETE — expect 200 or 204
curl -s -X DELETE $BASE_URL/products/$PRODUCT_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq .
```

### Auth Failure Tests
```bash
# Expect 401 — no token
curl -s -X GET $BASE_URL/products | jq .

# Expect 401 — expired/invalid token
curl -s -X GET $BASE_URL/products \
  -H "Authorization: Bearer invalid-token" | jq .

# Expect 400 — missing required field
curl -s -X POST $BASE_URL/products \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}' | jq .   # missing 'name'

# Expect 400 — extra field (whitelist validation)
curl -s -X POST $BASE_URL/products \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","status":"active","orgId":"attacker-org"}' | jq .
```

### Tenant Isolation Test
```bash
# Login as org-1 user
ORG1_TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -d '{"email":"org1user@example.com","password":"pass"}' | jq -r '.accessToken')

# Login as org-2 user
ORG2_TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -d '{"email":"org2user@example.com","password":"pass"}' | jq -r '.accessToken')

# Create product as org-1
PRODUCT_ID=$(curl -s -X POST $BASE_URL/products \
  -H "Authorization: Bearer $ORG1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Org1 Secret","status":"active"}' | jq -r '.id')

# Verify org-2 CANNOT see it — expect 404
curl -s $BASE_URL/products/$PRODUCT_ID \
  -H "Authorization: Bearer $ORG2_TOKEN" | jq .
# Should be: {"statusCode":404,"message":"Product not found"}
```

---

## Agent Commerce API Tests

```bash
# Start a checkout session
SESSION=$(curl -s -X POST $BASE_URL/agent-commerce/sessions \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.sessionId')

echo "Session: $SESSION"

# Send a chat message
curl -s -X POST $BASE_URL/agent-commerce/sessions/$SESSION/chat \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Find me running shoes under $100"}' | jq .

# Check session state
curl -s $BASE_URL/agent-commerce/sessions/$SESSION \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '{state, cartItems}'
```

---

## Streaming Endpoint Tests (SSE)

```bash
# Test SSE streaming (agent chat)
curl -N -s $BASE_URL/agent-commerce/sessions/$SESSION/stream \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Accept: text/event-stream"

# Expected output:
# data: {"text":"I'll search for running shoes..."}
# data: {"text":" Here are my top picks:"}
# data: [DONE]
```

---

## Automated API Test Script

```bash
#!/bin/bash
# test-api.sh — smoke test all key endpoints

set -e
BASE_URL=${1:-http://localhost:9000}
PASS=0; FAIL=0

check() {
  local desc=$1; local expected=$2; local actual=$3
  if echo "$actual" | grep -q "$expected"; then
    echo "  PASS: $desc"; ((PASS++))
  else
    echo "  FAIL: $desc (expected '$expected', got: $actual)"; ((FAIL++))
  fi
}

# Auth
echo "--- Auth ---"
TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | jq -r '.accessToken')
check "Login returns token" "ey" "$TOKEN"

# Products
echo "--- Products ---"
PRODUCT=$(curl -s -X POST $BASE_URL/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test","status":"active"}')
check "Create product returns id" '"id"' "$PRODUCT"

PRODUCTS=$(curl -s $BASE_URL/products -H "Authorization: Bearer $TOKEN")
check "List products returns array" '\[' "$PRODUCTS"

NO_AUTH=$(curl -s $BASE_URL/products)
check "No auth returns 401" '401' "$NO_AUTH"

# Summary
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
```

---

## Swagger UI Testing

All services expose Swagger at `/api-docs` in non-production:

```
Auth service:          http://localhost:8080/api-docs
Product service:       http://localhost:8083/api-docs
AEO service:           http://localhost:3003/api-docs
Agent commerce:        http://localhost:3004/api-docs
```

**How to authenticate in Swagger:**
1. Use `POST /auth/login` to get a token
2. Click "Authorize" button (top right)
3. Paste token in Bearer field
4. All subsequent requests will include the token

---

## Load / Performance Testing

```bash
# Basic load test with hey (install: brew install hey)
hey -n 1000 -c 50 \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:9000/products

# Watch for:
# - P99 latency > 500ms (investigate)
# - Error rate > 0% (investigate immediately)
# - Requests/sec baseline (compare after changes)
```

---

## Response Validation Checklist

When testing any endpoint:
- [ ] 201/200 on valid input
- [ ] 401 without Authorization header
- [ ] 401 with invalid token
- [ ] 400 on missing required fields
- [ ] 400 on extra/unknown fields (whitelist validation)
- [ ] 404 when resource doesn't exist
- [ ] 404 when authenticated as wrong org (tenant isolation)
- [ ] Response shape matches documented API (id, orgId present)
- [ ] `orgId` in response matches authenticated user's org
- [ ] No internal implementation details in error messages
