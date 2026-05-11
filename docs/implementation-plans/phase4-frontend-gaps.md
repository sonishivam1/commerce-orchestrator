# Sub-Plan: Phase 4 — Frontend Gaps

> **Status:** AWAITING APPROVAL  
> **Priority:** 🟡 Medium — UX and security completeness  
> **Depends on:** Phase 2 API (done), Phase 0–3 pipeline (done)  
> **Blocks:** Full user flow (unauthenticated users can currently access dashboard), codegen types  
> **Skill references:** `.claude/skills/frontend-dashboard/SKILL.md`  
> **Agent:** `frontend-architect` (to be created)  
> **Rules:** `.claude/rules/nextjs-ui.md`

---

## Problem Statement

Four gaps prevent the frontend from being production-ready:

1. **No auth middleware** — `apps/web/middleware.ts` does not exist. Unauthenticated users can navigate directly to `/dashboard`, `/jobs`, `/credentials`, etc. with no redirect.

2. **No session utility** — JWT token management is inline in `LoginForm`. There is no centralized `getToken()`, `setToken()`, `clearToken()`, `isAuthenticated()`. Components that need auth state cannot share it cleanly.

3. **Missing `@cdo/gql` codegen** — The generated types and hooks in `packages/gql/src/generated/` are stubs. The web app uses hand-written `gql` documents instead of the typed hooks (`useGetJobsQuery`, `useCreateJobMutation`, etc.).

4. **Missing UI components** — `@cdo/ui` only has 4 components (Button, Card, Badge, Progress). The plan requires 8 more: Input, Label, Dialog, Select, Table, Toast, Skeleton, Separator.

5. **No `JobProgressCard`** — The job detail page (`/jobs/[id]`) has no live progress visualization. This is a core feature of the dashboard.

6. **Single-step job form** — The create job flow is a flat form, not the intended 3-step wizard (`CreateJobWizard`).

---

## Acceptance Criteria

- [ ] Unauthenticated requests to any `/dashboard/*`, `/jobs/*`, `/credentials/*` route redirect to `/login`
- [ ] `apps/web/lib/auth/session.ts` exports `getToken()`, `setToken()`, `clearToken()`, `isAuthenticated()`
- [ ] All components that previously read token inline now use `session.ts`
- [ ] `pnpm --filter @cdo/gql codegen` runs successfully against live API and generates typed hooks
- [ ] At least 3 web components migrated to use generated hooks (jobs list, credentials list, DLQ)
- [ ] 8 new shadcn components added to `@cdo/ui` (Input, Label, Dialog, Select, Table, Toast, Skeleton, Separator)
- [ ] `JobProgressCard` component shows live progress bar + status transition log
- [ ] `CreateJobWizard` has 3 steps: Kind → Credentials → Review & Launch
- [ ] `npx tsc --noEmit` = 0 errors in `apps/web`

---

## Files to Change

### CREATE

| File | Purpose |
|------|---------|
| `apps/web/middleware.ts` | Next.js middleware — auth redirect |
| `apps/web/lib/auth/session.ts` | Centralized JWT token management |
| `apps/web/components/jobs/job-progress-card.tsx` | Live progress bar + event log |
| `apps/web/components/jobs/create-job-wizard.tsx` | 3-step job creation wizard |
| `packages/ui/src/components/ui/input.tsx` | shadcn Input |
| `packages/ui/src/components/ui/label.tsx` | shadcn Label |
| `packages/ui/src/components/ui/dialog.tsx` | shadcn Dialog / Modal |
| `packages/ui/src/components/ui/select.tsx` | shadcn Select dropdown |
| `packages/ui/src/components/ui/table.tsx` | shadcn Table |
| `packages/ui/src/components/ui/toast.tsx` | shadcn Toast notifications |
| `packages/ui/src/components/ui/skeleton.tsx` | shadcn Skeleton loader |
| `packages/ui/src/components/ui/separator.tsx` | shadcn Separator |

### MODIFY

| File | Change |
|------|--------|
| `packages/ui/src/index.ts` | Export all 8 new components |
| `apps/web/components/auth/login-form.tsx` | Use `session.ts` instead of inline localStorage |
| `apps/web/app/(dashboard)/jobs/[id]/page.tsx` | Render `<JobProgressCard>` |
| `apps/web/app/(dashboard)/jobs/new/page.tsx` | Render `<CreateJobWizard>` |
| `packages/gql/src/codegen.ts` | Point to live API schema URL |

---

## Implementation Detail

### 1. `apps/web/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/_next', '/favicon.ico', '/api'];
const DASHBOARD_PREFIX = '/';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths through
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
    if (isPublic) return NextResponse.next();

    // Check for JWT token in cookie (preferred) or check via header
    const token = request.cookies.get('cdo-token')?.value;

    if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

> **Note on token storage:** The plan uses `localStorage`. For middleware (server-side), we need the token in a cookie. `session.ts` must store in both `localStorage` (for Apollo headers) AND a `cdo-token` cookie (for middleware). Cookie should be `SameSite=Strict; Secure; HttpOnly=false` (readable by JS for Apollo).

### 2. `apps/web/lib/auth/session.ts`

```typescript
'use client';

const TOKEN_KEY = 'cdo-token';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    // Also set cookie for middleware auth check
    document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Strict`;
}

export function clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export function isAuthenticated(): boolean {
    return !!getToken();
}
```

### 3. `JobProgressCard` Component

```tsx
// apps/web/components/jobs/job-progress-card.tsx
'use client';

import { useQuery } from '@apollo/client';
import { GET_JOB } from '@/lib/graphql/queries';
import { Progress } from '@cdo/ui';
import { Badge } from '@cdo/ui';

const STATUS_CONFIG = {
    COMPLETED: { label: 'Completed', class: 'bg-emerald-500/10 text-emerald-700' },
    RUNNING:   { label: 'Running',   class: 'bg-blue-500/10 text-blue-700' },
    FAILED:    { label: 'Failed',    class: 'bg-red-500/10 text-red-700' },
    PENDING:   { label: 'Pending',   class: 'bg-amber-500/10 text-amber-700' },
};

interface Props {
    jobId: string;
}

export function JobProgressCard({ jobId }: Props) {
    const { data, loading } = useQuery(GET_JOB, {
        variables: { id: jobId },
        pollInterval: 3000,   // Refresh every 3s while running
    });

    const job = data?.job;
    if (loading || !job) return <ProgressCardSkeleton />;

    const percent = job.totalItems > 0
        ? Math.round((job.processedItems / job.totalItems) * 100)
        : 0;

    const statusConfig = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG];

    return (
        <div className="rounded-2xl border border-white/20 bg-white/70 backdrop-blur-xl shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 font-body">Job ID</p>
                    <p className="font-heading font-semibold text-indigo-950 text-sm font-mono">{job.id}</p>
                </div>
                <Badge className={statusConfig.class}>{statusConfig.label}</Badge>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>{job.processedItems} / {job.totalItems ?? '?'} items</span>
                    <span>{percent}%</span>
                </div>
                <Progress value={percent} className="h-2" />
            </div>

            <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pipeline</p>
                <PipelineSteps kind={job.kind} status={job.status} />
            </div>

            {job.failedItems > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                    {job.failedItems} item(s) sent to DLQ
                </div>
            )}
        </div>
    );
}

function PipelineSteps({ kind, status }: { kind: string; status: string }) {
    const steps = ['Extract', 'Transform', 'Load'];
    const activeStep = status === 'PENDING' ? -1 : status === 'RUNNING' ? 1 : steps.length - 1;

    return (
        <div className="flex items-center gap-2">
            {steps.map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                        i <= activeStep ? 'bg-indigo-500' : 'bg-gray-200'
                    }`} />
                    <span className={`text-xs ${i <= activeStep ? 'text-indigo-700' : 'text-gray-400'}`}>
                        {step}
                    </span>
                    {i < steps.length - 1 && <div className="h-px w-6 bg-gray-200" />}
                </div>
            ))}
        </div>
    );
}

function ProgressCardSkeleton() {
    return (
        <div className="rounded-2xl border border-white/20 bg-white/70 backdrop-blur-xl p-6 space-y-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-2 bg-gray-200 rounded" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
        </div>
    );
}
```

### 4. `CreateJobWizard` — 3-Step Wizard

```tsx
// apps/web/components/jobs/create-job-wizard.tsx  (structure only)

// Step 1: Kind selector — 4 cards: CROSS_PLATFORM_MIGRATION, PLATFORM_CLONE, SCRAPE_IMPORT, EXPORT
// Step 2: Credential dropdowns (source + target) + sourceUrl field (SCRAPE_IMPORT only)
// Step 3: Review summary + "Launch Job" button → useMutation(CREATE_JOB)

// State managed with useState({ step: 1, kind: '', sourceCredId: '', targetCredId: '', sourceUrl: '' })
// Navigation: "Back" / "Next" buttons with validation before advancing
// On step 3 submit: call mutation, redirect to /jobs/{newJobId} on success
```

### 5. GraphQL Codegen Setup

```typescript
// packages/gql/src/codegen.ts — update schema URL
const config = {
    schema: process.env.GRAPHQL_SCHEMA_URL ?? 'http://localhost:4000/graphql',
    documents: ['src/operations.ts'],
    generates: {
        'src/generated/types.ts': { plugins: ['typescript', 'typescript-operations'] },
        'src/generated/hooks.ts': { plugins: ['typescript-react-apollo'] },
    },
};
```

**Codegen run steps:**
1. Start API: `pnpm --filter @cdo/api dev`
2. Run: `pnpm --filter @cdo/gql codegen`
3. Commit generated files (they are part of the package, not gitignored)
4. Update `packages/gql/src/index.ts` to export from `./generated/hooks`

---

## Test Plan

### Manual (no unit tests for UI — test via browser)

| Scenario | Steps | Expected |
|----------|-------|----------|
| Auth redirect | Navigate to `/jobs` without token | Redirects to `/login?redirect=/jobs` |
| Auth redirect with cookie | Set `cdo-token` cookie, navigate to `/jobs` | Passes through |
| Logout clears cookie | Click logout | Cookie cleared, redirect to `/login` |
| Progress card | Create a job, open `/jobs/{id}` | Progress bar visible, polls every 3s |
| Wizard step 1 | Click "CROSS_PLATFORM_MIGRATION" card | Step 2 appears |
| Wizard step 2 | Leave source credential blank, click Next | Validation error shown |
| Wizard submit | Complete all steps, click Launch | Job created, redirect to `/jobs/{id}` |

---

## UI Component Install Commands

```bash
# Run from apps/web — shadcn adds to packages/ui via monorepo config
pnpm dlx shadcn@latest add input label dialog select table toast skeleton separator
```

> Verify each component lands in `packages/ui/src/components/ui/` and is exported from `packages/ui/src/index.ts`.

---

## Out of Scope for This Plan

- Full `@cdo/gql` migration of all components (start with 3, migrate rest incrementally)
- Real-time WebSocket job updates (polling covers MVP)
- Settings page implementation
- DLQ bulk replay UI
