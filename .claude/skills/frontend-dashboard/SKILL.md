---
name: frontend-dashboard
description: Next.js dashboard design system for Commerce Data Orchestrator. Glassmorphism aesthetic, component patterns, data fetching with Apollo, and route structure.
user-invocable: true
---

# Frontend Dashboard Skill — Commerce Data Orchestrator

## Design System — Glassmorphism SaaS

```
Typography:
  Headings: Space Grotesk (font-heading)
  Body:     DM Sans (font-body)

Color Tokens:
  Primary:    #6366F1 (indigo-500)
  CTA:        #10B981 (emerald-500)
  Background: #F5F3FF (violet-50)
  Surface:    rgba(255,255,255,0.7) + backdrop-blur-xl
  Text:       #1E1B4B (indigo-950)
  Muted:      #6B7280 (gray-500)

Status Colors:
  COMPLETED:  emerald-500   bg-emerald-500/10
  RUNNING:    blue-500      bg-blue-500/10
  FAILED:     red-500       bg-red-500/10
  PENDING:    amber-500     bg-amber-500/10
  PAUSED:     gray-500      bg-gray-500/10
```

## Route Structure

```
app/
├── layout.tsx                     # Root layout (fonts, providers)
├── page.tsx                       # Landing redirect
├── globals.css                    # Tailwind + design tokens
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
└── (dashboard)/
    ├── layout.tsx                 # Sidebar + topbar
    ├── jobs/page.tsx              # Job list
    ├── jobs/[id]/page.tsx         # Job detail + progress
    ├── credentials/page.tsx       # Credential vault
    ├── credentials/new/page.tsx   # Add credential
    └── settings/page.tsx          # Tenant settings
```

## Component Patterns

### Glassmorphism Card
```tsx
<div className="rounded-2xl border border-white/20 bg-white/70 backdrop-blur-xl shadow-lg p-6">
  <h3 className="font-heading text-lg font-semibold text-indigo-950">{title}</h3>
  {children}
</div>
```

### Job Status Badge
```tsx
const statusConfig = {
  COMPLETED: { class: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  RUNNING:   { class: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  FAILED:    { class: 'bg-red-500/10 text-red-700 border-red-500/20' },
  PENDING:   { class: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  PAUSED:    { class: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
};
```

### Data Fetching (Apollo)
```tsx
// Use Apollo hooks from @cdo/gql
const { data, loading } = useQuery(GET_JOBS, {
  variables: { tenantId },
  pollInterval: 5000, // Live refresh every 5s
});
```

## Anti-Patterns
- No emojis as icons — use Lucide React
- No `cursor: default` on clickable elements
- No layout-shifting hover effects — use `translateY` transforms
- All transitions 150-300ms
- Always implement `:focus` states
- Respect `prefers-reduced-motion`
