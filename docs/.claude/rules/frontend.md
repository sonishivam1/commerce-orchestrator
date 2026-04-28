---
description: Frontend rules for Metafy dashboard and admin — auto-loads when editing files in apps/dashboard or apps/platform-admin
globs:
  - "apps/dashboard/**/*.tsx"
  - "apps/dashboard/**/*.ts"
  - "apps/platform-admin/**/*.tsx"
  - "apps/platform-admin/**/*.ts"
---

# Frontend Rules (Auto-loaded for dashboard/admin files)

## Component Defaults
- **Default to Server Components** — only add `'use client'` when you need browser APIs, event handlers, or React hooks
- Never use `'use client'` just for async data fetching — use `async` server components or SWR instead
- Split large components: if a component file exceeds ~150 lines, it should be broken up

## Data Fetching
- **Server components:** fetch directly (no SWR needed)
- **Client components:** always use `SWR` (`useSWR`) — never `useState` + `useEffect` for async data
- API calls go through `src/lib/api.ts` (Axios client) — never raw `fetch()`
- Always handle `isLoading` and `error` states from SWR

```typescript
// CORRECT
const { data, error, isLoading } = useSWR('/api/products', fetcher);
if (isLoading) return <Skeleton />;
if (error) return <ErrorState />;

// WRONG — useState + useEffect for async data
const [data, setData] = useState(null);
useEffect(() => { fetch('/api/products').then(...) }, []);
```

## State Management
- **Server state** (API data): SWR
- **Client UI state** (modals open, selected items, filters): Zustand stores in `src/store/`
- **Form state**: React Hook Form — never controlled inputs with useState for forms
- Never put API response data in Zustand — that's SWR's job

## Styling
- Tailwind CSS only — no inline styles, no CSS modules
- Use `cn()` from `src/lib/utils.ts` to merge classes conditionally
- Dark mode via Tailwind `dark:` prefix — always support dark mode
- Responsive: mobile-first (`sm:`, `md:`, `lg:` breakpoints)

```typescript
// CORRECT
<div className={cn('flex items-center', isActive && 'bg-blue-500 dark:bg-blue-700')}>
```

## UI Components
- Use primitives from `src/components/ui/` (shadcn/ui pattern over Radix UI)
- Use `Button`, `Card`, `Input`, `Dialog`, etc. from the shared library — don't rebuild primitives
- Icons: Lucide React for UI icons, Heroicons for marketing/illustrative icons

## AI / Streaming
- Use Vercel AI SDK hooks: `useChat`, `useCompletion` from `@ai-sdk/react`
- Stream responses — never wait for a full LLM response before rendering
- Show loading/thinking states during streaming

## Next.js Specifics
- `next/image` for all images (never raw `<img>`)
- `next/link` for all internal navigation (never `<a href>`)
- `next/dynamic` for lazy-loading heavy client components
- Route handlers in `app/api/` — not `pages/api/`
- Layouts in `layout.tsx` — shared UI wraps child routes

## Accessibility
- Radix UI primitives are accessible by default — use them for interactive elements
- Always add `aria-label` on icon-only buttons
- Keyboard navigation must work for all interactive elements

## Performance
- `useMemo` / `useCallback` only after profiling shows a real bottleneck — not preemptively
- Avoid passing new object/array literals as props — they cause unnecessary re-renders
