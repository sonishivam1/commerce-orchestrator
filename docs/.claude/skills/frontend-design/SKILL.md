---
name: frontend-design
description: Metafy dashboard design system standards. Encodes the visual language, component patterns, dark mode strategy, and spacing system for apps/dashboard. Invoke when building or reviewing any UI component, page layout, or design decision.
user-invocable: true
---

# Frontend Design Skill — Metafy AI Platform Dashboard

This skill encodes the complete design system for `apps/dashboard`. Apply every rule here whenever building or reviewing UI.

---

## Design Philosophy
- **Dark-first** — design for dark mode first, then verify light mode works
- **Dense & professional** — this is a B2B SaaS tool, not a consumer app. Compact layouts, data-dense tables, minimal decoration
- **Clarity over creativity** — every element must serve a function. No decorative flourishes
- **Consistency at all costs** — use the shared component library. Never invent one-off styles

---

## Color Palette

### Semantic Color Usage
```
Background layers (dark → light depth):
  bg-gray-950   — deepest background (page canvas)
  bg-gray-900   — surface (cards, panels)
  bg-gray-800   — elevated surface (modals, dropdowns)
  bg-gray-700   — interactive hover states

Text:
  text-white          — primary headings
  text-gray-100       — primary body text
  text-gray-400       — secondary / muted text
  text-gray-500       — disabled / placeholder

Brand / Accent:
  text-blue-400       — primary actions, links, active states (dark mode)
  text-blue-600       — primary actions (light mode)
  bg-blue-500         — primary button fill
  bg-blue-600 hover:bg-blue-700

Status Colors:
  text-green-400 / bg-green-500/10   — success, active, healthy
  text-yellow-400 / bg-yellow-500/10  — warning, pending, in-progress
  text-red-400 / bg-red-500/10        — error, critical, destructive
  text-gray-400 / bg-gray-500/10      — neutral, inactive, disabled

AEO-specific:
  text-purple-400     — AI/LLM related features
  text-indigo-400     — agent commerce features
```

### Dark Mode Implementation
Always use Tailwind's `dark:` variant. Never use CSS variables for colors unless adding to the design token system.

```tsx
// CORRECT — dark mode aware
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">

// WRONG — hardcoded color (broken in dark mode)
<div style={{ backgroundColor: '#1a1a1a' }}>
```

---

## Typography

```
Headings:
  Page title      font-semibold text-2xl text-white
  Section title   font-semibold text-lg text-white
  Card title      font-medium text-base text-white
  Label           font-medium text-sm text-gray-400 uppercase tracking-wider

Body:
  Primary         text-sm text-gray-100
  Secondary       text-sm text-gray-400
  Caption         text-xs text-gray-500

Code/Mono:
  font-mono text-sm text-green-400 bg-gray-900
```

---

## Spacing System
Follow an 8px base grid via Tailwind:
```
Tight (within components):  gap-1 (4px), gap-2 (8px)
Normal (between elements):  gap-3 (12px), gap-4 (16px)
Loose (between sections):   gap-6 (24px), gap-8 (32px)
Page padding:               p-6 (24px) or p-8 (32px)
Card padding:               p-4 (16px) or p-6 (24px)
```

---

## Component Standards

### Cards
```tsx
// Standard card — always use this pattern, never raw divs
<div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
  <h3 className="font-semibold text-white mb-4">{title}</h3>
  {/* content */}
</div>

// Stat card
<div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
  <p className="text-2xl font-semibold text-white mt-1">{value}</p>
  <p className="text-xs text-gray-500 mt-1">{delta}</p>
</div>
```

### Buttons
```tsx
// Primary
<Button className="bg-blue-500 hover:bg-blue-600 text-white">Action</Button>

// Secondary
<Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
  Action
</Button>

// Destructive
<Button variant="destructive">Delete</Button>

// Ghost (table row actions, icon buttons)
<Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
  <PencilIcon className="h-4 w-4" />
</Button>
```

### Status Badges
```tsx
const statusConfig = {
  active:   { label: 'Active',   class: 'bg-green-500/10 text-green-400 border-green-500/20' },
  pending:  { label: 'Pending',  class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  failed:   { label: 'Failed',   class: 'bg-red-500/10 text-red-400 border-red-500/20' },
  inactive: { label: 'Inactive', class: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

// Usage
<span className={cn(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
  statusConfig[status].class
)}>
  {statusConfig[status].label}
</span>
```

### Data Tables
```tsx
// Use this pattern for all data tables
<div className="rounded-xl border border-gray-800 overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gray-900 border-b border-gray-800">
      <tr>
        <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
          {header}
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-800 bg-gray-950">
      <tr className="hover:bg-gray-900/50 transition-colors">
        <td className="px-4 py-3 text-gray-100">{cell}</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Empty States
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="rounded-full bg-gray-800 p-4 mb-4">
    <IconComponent className="h-8 w-8 text-gray-500" />
  </div>
  <h3 className="font-medium text-white mb-1">No {noun} yet</h3>
  <p className="text-sm text-gray-400 mb-4 max-w-sm">
    {description of what the user should do next}
  </p>
  <Button>Create {noun}</Button>
</div>
```

### Loading States
```tsx
// Skeleton for cards (use while SWR isLoading)
<div className="rounded-xl border border-gray-800 bg-gray-900 p-6 animate-pulse">
  <div className="h-4 bg-gray-800 rounded w-1/3 mb-4" />
  <div className="h-3 bg-gray-800 rounded w-2/3 mb-2" />
  <div className="h-3 bg-gray-800 rounded w-1/2" />
</div>
```

### Forms
```tsx
// Label + Input pair (always together)
<div className="space-y-1.5">
  <Label htmlFor="name" className="text-sm font-medium text-gray-300">
    Product Name
  </Label>
  <Input
    id="name"
    placeholder="Enter product name"
    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500
               focus:border-blue-500 focus:ring-blue-500/20"
    {...register('name')}
  />
  {errors.name && (
    <p className="text-xs text-red-400">{errors.name.message}</p>
  )}
</div>
```

---

## Page Layout Structure
```tsx
// Standard page layout
<div className="min-h-screen bg-gray-950">
  {/* Sidebar — fixed, 240px */}
  <Sidebar />

  {/* Main content */}
  <div className="ml-60">
    {/* Page header */}
    <div className="border-b border-gray-800 bg-gray-950 px-8 py-5">
      <h1 className="text-xl font-semibold text-white">{pageTitle}</h1>
      <p className="text-sm text-gray-400 mt-0.5">{pageDescription}</p>
    </div>

    {/* Page body */}
    <div className="p-8 space-y-6">
      {/* content */}
    </div>
  </div>
</div>
```

---

## AI / Agent UI Patterns
For agent commerce and AEO features:
```tsx
// AI message bubble
<div className="flex gap-3">
  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-500/20 border border-purple-500/30
                  flex items-center justify-center">
    <SparklesIcon className="h-4 w-4 text-purple-400" />
  </div>
  <div className="rounded-2xl rounded-tl-sm bg-gray-800 border border-gray-700 px-4 py-3
                  text-sm text-gray-100 max-w-lg">
    {message}
  </div>
</div>

// User message bubble
<div className="flex gap-3 justify-end">
  <div className="rounded-2xl rounded-tr-sm bg-blue-500 px-4 py-3
                  text-sm text-white max-w-lg">
    {message}
  </div>
</div>

// Tool execution indicator
<div className="flex items-center gap-2 text-xs text-gray-500 my-2">
  <div className="h-px flex-1 bg-gray-800" />
  <span className="flex items-center gap-1.5">
    <WrenchIcon className="h-3 w-3" />
    {toolName}
  </span>
  <div className="h-px flex-1 bg-gray-800" />
</div>
```

---

## Checklist (Apply Before Finishing Any UI Component)
- [ ] Does it look correct in dark mode?
- [ ] Does it look acceptable in light mode (`dark:` variants applied)?
- [ ] Colors match the palette above (no hardcoded hex values)?
- [ ] Spacing follows the 8px grid?
- [ ] Loading state handled (skeleton or spinner)?
- [ ] Empty state handled?
- [ ] Error state handled?
- [ ] Responsive at `sm` (640px) and `lg` (1024px) breakpoints?
- [ ] Interactive elements have `hover:` transitions?
- [ ] Icon-only buttons have `aria-label`?
- [ ] Uses shared components from `src/components/ui/` (no re-invented primitives)?

---

## What NOT to Do
```tsx
// Never — random colors not in the palette
className="bg-slate-700 text-zinc-300"

// Never — inline styles for anything in the palette
style={{ color: '#94a3b8' }}

// Never — light-mode-only design
className="bg-white text-black"  // no dark: variant

// Never — consumer-app aesthetic (rounded-3xl, pastel gradients, decorative blobs)
```

> **Customize:** Update this color palette section when `tailwind.config.ts` color tokens are finalized.
