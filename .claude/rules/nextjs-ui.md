---
paths:
  - "apps/web/**/*.tsx"
  - "apps/web/**/*.ts"
  - "apps/web/**/*.css"
---

# Next.js Frontend Rules

## Architecture
- Uses Next.js App Router with route groups: `(auth)` for login/register, `(dashboard)` for authenticated pages.
- Layouts: `app/layout.tsx` (root), `app/(dashboard)/layout.tsx` (sidebar nav).
- Apollo Client is wrapped via a provider component. GraphQL operations live in `@cdo/gql`.

## Component Patterns
- Use React Server Components by default. Only add `"use client"` when the component needs browser APIs, state, or event handlers.
- Components are organized by domain: `components/auth/`, `components/jobs/`, `components/credentials/`, `components/layout/`, `components/shared/`.
- Use `@cdo/ui` (shadcn) for all base UI primitives (Button, Card, Badge, Progress, etc.).
- Never create ad-hoc styled elements when a shadcn component exists.

## Styling
- Tailwind CSS is configured and active (`tailwind.config.ts`, `postcss.config.js`).
- Global styles live in `app/globals.css`.
- Follow the SaaS Design System: Glassmorphism aesthetic, Space Grotesk headings, DM Sans body text.
- Color tokens: Primary `#6366F1` (indigo), CTA `#10B981` (emerald), Background `#F5F3FF`, Text `#1E1B4B`.

## Data Fetching
- GraphQL queries and mutations go through Apollo Client hooks.
- Auto-polling for live data (e.g., job list refreshes every few seconds).
- Token management: JWT stored in localStorage. Session utilities in `lib/auth/session.ts`.

## Anti-Patterns
- No emojis as icons — use Lucide React icons exclusively.
- No `cursor: default` on clickable elements — always `cursor-pointer`.
- No layout-shifting hover effects — use `translateY` transforms, not size changes.
- No instant state changes — all transitions must be 150-300ms.
- No hidden content behind fixed navbars — account for navbar height in scroll offsets.
- Always implement visible `:focus` states for keyboard accessibility.
- Always respect `prefers-reduced-motion`.
