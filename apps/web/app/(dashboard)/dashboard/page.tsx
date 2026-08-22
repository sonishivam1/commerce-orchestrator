'use client';

import { useQuery } from '@apollo/client';
import { GET_RECENT_MIGRATION_RUNS, GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import {
    Play,
    CheckCircle2,
    XCircle,
    Clock,
    KeyRound,
    ArrowRight,
    Plus,
    Loader2,
    Activity,
    TrendingUp,
    Zap,
    FolderKanban,
    AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaveRecord {
    entityType: string;
    status: string;
    processedCount: number;
    failedCount: number;
}

interface MigrationRun {
    id: string;
    migrationProjectId: string;
    status: string;
    dryRun: boolean;
    processedCount: number;
    failedCount: number;
    waves: WaveRecord[];
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

interface MigrationProject {
    id: string;
    name: string;
    sourceConnectionId: string;
    targetConnectionId: string;
    entityTypes: string[];
    status: string;
}

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function duration(start?: string, end?: string): string {
    if (!start) return '—';
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diff = endTime - new Date(start).getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
}

const PLATFORM_LABEL: Record<string, string> = {
    commercetools: 'CT',
    shopify:       'Shopify',
    bigcommerce:   'BigCommerce',
    scraper:       'Scraper',
};

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'text-purple-400',
    PRODUCTS:   'text-blue-400',
    CUSTOMERS:  'text-cyan-400',
    ORDERS:     'text-amber-400',
};

const STATUS_CONFIG: Record<string, { icon: typeof Play; color: string; label: string; dot: string }> = {
    RUNNING:   { icon: Play,         color: 'text-blue-400',    label: 'RUNNING',   dot: 'bg-blue-400 animate-pulse' },
    COMPLETED: { icon: CheckCircle2, color: 'text-emerald-400', label: 'COMPLETE',  dot: 'bg-emerald-400' },
    FAILED:    { icon: XCircle,      color: 'text-red-400',     label: 'FAILED',    dot: 'bg-red-400' },
    PENDING:   { icon: Clock,        color: 'text-slate-400',   label: 'PENDING',   dot: 'bg-slate-500' },
};

// ── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
    label, value, sub, subHighlight = false, icon: Icon, accentBg, accentText, loading,
}: {
    label: string; value: string | number; sub?: string;
    subHighlight?: boolean; icon: React.ComponentType<{ className?: string }>;
    accentBg: string; accentText: string; loading?: boolean;
}) {
    return (
        <div className="bg-[#111827]/80 border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', accentBg)}>
                    <Icon className={cn('h-4 w-4', accentText)} />
                </div>
            </div>
            {loading ? (
                <div className="h-9 w-20 bg-white/5 rounded-lg animate-pulse" />
            ) : (
                <p className={cn('text-3xl font-bold font-mono', accentText)}>{value}</p>
            )}
            {sub && !loading && (
                <p className={cn('text-xs', subHighlight ? 'text-emerald-400' : 'text-slate-500')}>{sub}</p>
            )}
        </div>
    );
}

// ── Wave Progress Bar ─────────────────────────────────────────────────────────

function WaveProgress({ wave, totalProcessed }: { wave: WaveRecord; totalProcessed: number }) {
    const pct = totalProcessed > 0 ? Math.round((wave.processedCount / totalProcessed) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className={cn('font-semibold', ENTITY_COLOR[wave.entityType] ?? 'text-slate-400')}>
                    {wave.entityType}
                </span>
                <span className="text-slate-500 font-mono">{wave.processedCount.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-700',
                        wave.status === 'COMPLETED' ? 'bg-emerald-500' :
                        wave.status === 'RUNNING'   ? 'bg-blue-500 animate-pulse' :
                        wave.status === 'FAILED'    ? 'bg-red-500' :
                                                      'bg-slate-600',
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { data: runsData, loading: runsLoading } = useQuery<{ recentMigrationRuns: MigrationRun[] }>(
        GET_RECENT_MIGRATION_RUNS,
        { variables: { limit: 10 }, pollInterval: 5000 },
    );
    const { data: projectsData, loading: projectsLoading } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
        { pollInterval: 10000 },
    );
    const { data: credsData, loading: credsLoading } = useQuery<{ credentials: Credential[] }>(
        GET_CREDENTIALS,
    );

    const runs        = runsData?.recentMigrationRuns ?? [];
    const projects    = projectsData?.migrationProjects ?? [];
    const credentials = credsData?.credentials ?? [];

    const loading = runsLoading && projectsLoading && credsLoading;

    // Build lookup maps
    const projectById = Object.fromEntries(projects.map(p => [p.id, p]));
    const credById    = Object.fromEntries(credentials.map(c => [c.id, c]));

    // Stats
    const runningRuns   = runs.filter(r => r.status === 'RUNNING');
    const liveRun       = runningRuns[0] ?? null;
    const liveProject   = liveRun ? projectById[liveRun.migrationProjectId] : null;

    // Records today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const recordsToday = runs
        .filter(r => new Date(r.createdAt) >= todayStart)
        .reduce((sum, r) => sum + r.processedCount, 0);

    // Success rate (last 10 runs that are done)
    const doneRuns = runs.filter(r => r.status === 'COMPLETED' || r.status === 'FAILED');
    const totalProcessed = doneRuns.reduce((s, r) => s + r.processedCount + r.failedCount, 0);
    const totalFailed    = doneRuns.reduce((s, r) => s + r.failedCount, 0);
    const successRate    = totalProcessed > 0
        ? ((1 - totalFailed / totalProcessed) * 100).toFixed(1) + '%'
        : '—';

    // Platform chips for connections tile
    const platformSet = [...new Set(credentials.map(c => c.platform))];

    return (
        <div className="flex gap-6 pb-16 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* ── Left: main content ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Commerce Data Orchestrator
                            {liveProject && (
                                <span className="text-slate-600"> · <span className="text-blue-400/80">{liveProject.name} running</span></span>
                            )}
                        </p>
                    </div>
                    <Link
                        href="/projects/new"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                    >
                        <Plus className="h-4 w-4" />
                        New Migration
                    </Link>
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatTile
                        label="Active Connections"
                        value={loading ? '—' : credentials.length}
                        sub={platformSet.map(p => PLATFORM_LABEL[p] ?? p).join(', ') || undefined}
                        icon={KeyRound}
                        accentBg="bg-slate-700/50"
                        accentText="text-slate-300"
                        loading={credsLoading}
                    />
                    <StatTile
                        label="Running Migrations"
                        value={loading ? '—' : runningRuns.length}
                        sub={liveProject ? liveProject.name : (runs.length > 0 ? 'No active runs' : 'No runs yet')}
                        subHighlight={runningRuns.length > 0}
                        icon={Activity}
                        accentBg="bg-blue-500/10"
                        accentText="text-blue-400"
                        loading={runsLoading}
                    />
                    <StatTile
                        label="Records Today"
                        value={loading ? '—' : formatCount(recordsToday)}
                        sub={recordsToday > 0 ? 'processed this session' : 'No activity today'}
                        icon={TrendingUp}
                        accentBg="bg-emerald-500/10"
                        accentText="text-emerald-400"
                        loading={runsLoading}
                    />
                    <StatTile
                        label="Success Rate"
                        value={loading ? '—' : successRate}
                        sub={doneRuns.length > 0 ? `Last ${doneRuns.length} completed run${doneRuns.length > 1 ? 's' : ''}` : 'No completed runs'}
                        subHighlight={parseFloat(successRate) > 95}
                        icon={Zap}
                        accentBg="bg-indigo-500/10"
                        accentText="text-indigo-400"
                        loading={runsLoading}
                    />
                </div>

                {/* Recent Executions */}
                <div className="bg-[#111827]/80 border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-200">Recent Executions</h2>
                        <Link href="/runs" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors">
                            View all <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {/* Loading state */}
                    {runsLoading && (
                        <div className="divide-y divide-white/[0.04]">
                            {[0,1,2,3].map(i => (
                                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                                    <div className="h-8 w-8 bg-white/5 rounded-xl shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-3.5 w-48 bg-white/5 rounded" />
                                        <div className="h-2.5 w-32 bg-white/5 rounded" />
                                    </div>
                                    <div className="h-5 w-20 bg-white/5 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!runsLoading && runs.length === 0 && (
                        <div className="py-16 flex flex-col items-center gap-3 text-center">
                            <FolderKanban className="h-10 w-10 text-slate-600" />
                            <p className="text-sm font-medium text-slate-400">No runs yet</p>
                            <p className="text-xs text-slate-600">Create a project and trigger a migration run to see executions here.</p>
                            <Link href="/projects/new" className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                Create your first project →
                            </Link>
                        </div>
                    )}

                    {/* Run rows */}
                    {!runsLoading && runs.length > 0 && (
                        <div className="divide-y divide-white/[0.04]">
                            {runs.map(run => {
                                const cfg     = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.PENDING;
                                const Icon    = cfg.icon;
                                const project = projectById[run.migrationProjectId];
                                const src     = project ? credById[project.sourceConnectionId] : null;
                                const tgt     = project ? credById[project.targetConnectionId] : null;
                                const srcLabel = src ? (PLATFORM_LABEL[src.platform] ?? src.platform) : '—';
                                const tgtLabel = tgt ? (PLATFORM_LABEL[tgt.platform] ?? tgt.platform) : '—';
                                const entityTypes = project?.entityTypes ?? run.waves.map(w => w.entityType);

                                return (
                                    <Link
                                        key={run.id}
                                        href={`/runs/${run.id}`}
                                        className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                                    >
                                        {/* Status icon */}
                                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border',
                                            run.status === 'RUNNING'   ? 'bg-blue-500/10 border-blue-500/20' :
                                            run.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                            run.status === 'FAILED'    ? 'bg-red-500/10 border-red-500/20' :
                                                                          'bg-white/5 border-white/8',
                                        )}>
                                            <Icon className={cn('h-4 w-4', cfg.color)} />
                                        </div>

                                        {/* Name + entity types */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                                                {project?.name ?? 'Migration Run'}
                                                <span className="font-normal text-slate-500 ml-1.5">
                                                    · {srcLabel} → {tgtLabel}
                                                </span>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {entityTypes.map(et => (
                                                    <span key={et} className={cn('text-[10px] font-semibold', ENTITY_COLOR[et] ?? 'text-slate-500')}>
                                                        {et.charAt(0) + et.slice(1).toLowerCase()}
                                                    </span>
                                                ))}
                                                {run.dryRun && (
                                                    <span className="text-[10px] font-semibold text-amber-500/80 border border-amber-500/20 rounded px-1 py-0.5">DRY RUN</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Counts */}
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-mono font-semibold text-white">
                                                {run.processedCount.toLocaleString()}
                                            </p>
                                            {run.failedCount > 0 && (
                                                <p className="text-xs text-red-400/80 font-mono">{run.failedCount} failed</p>
                                            )}
                                        </div>

                                        {/* Status + time */}
                                        <div className="text-right shrink-0 space-y-1">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                                                <span className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.color)}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-600">
                                                {run.status === 'RUNNING'
                                                    ? duration(run.startedAt)
                                                    : timeAgo(run.createdAt)}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right: sidebar ─────────────────────────────────────────── */}
            <div className="w-72 shrink-0 space-y-4">

                {/* Live Migration */}
                <div className="bg-[#111827]/80 border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">Live Migration</h3>
                        {liveRun && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                                RUNNING
                            </span>
                        )}
                    </div>

                    {!liveRun ? (
                        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
                            <Activity className="h-8 w-8 text-slate-700" />
                            <p className="text-xs text-slate-600">No active migration</p>
                            <Link href="/projects" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1">
                                Start a run →
                            </Link>
                        </div>
                    ) : (
                        <div className="px-5 py-4 space-y-4">
                            {/* Project + source→target */}
                            <div>
                                <p className="text-sm font-semibold text-white truncate">
                                    {liveProject?.name ?? 'Migration Run'}
                                </p>
                                {liveProject && (() => {
                                    const s = credById[liveProject.sourceConnectionId];
                                    const t = credById[liveProject.targetConnectionId];
                                    return (
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {s ? (PLATFORM_LABEL[s.platform] ?? s.platform) : '—'}
                                            {' → '}
                                            {t ? (PLATFORM_LABEL[t.platform] ?? t.platform) : '—'}
                                        </p>
                                    );
                                })()}
                            </div>

                            {/* Wave progress */}
                            <div className="space-y-3">
                                {liveRun.waves.map(wave => (
                                    <WaveProgress
                                        key={wave.entityType}
                                        wave={wave}
                                        totalProcessed={liveRun.processedCount}
                                    />
                                ))}
                            </div>

                            {/* Total */}
                            <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-xs">
                                <span className="text-slate-500">Total processed</span>
                                <span className="font-mono font-semibold text-white">
                                    {liveRun.processedCount.toLocaleString()}
                                </span>
                            </div>

                            <Link
                                href={`/runs/${liveRun.id}`}
                                className="block text-center text-xs text-slate-500 hover:text-white transition-colors"
                            >
                                View Details →
                            </Link>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-[#111827]/80 border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                        <h3 className="text-sm font-semibold text-slate-200">Quick Actions</h3>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        <Link
                            href="/connections"
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                        >
                            <div className="h-7 w-7 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 group-hover:text-white transition-colors">Add Connection</p>
                                <p className="text-[11px] text-slate-600">Connect a new platform</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </Link>
                        <Link
                            href="/projects/new"
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                        >
                            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                <Play className="h-3.5 w-3.5 text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 group-hover:text-white transition-colors">New Migration</p>
                                <p className="text-[11px] text-slate-600">Select source & target</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </Link>
                        <Link
                            href="/reports"
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
                        >
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 group-hover:text-white transition-colors">View Reports</p>
                                <p className="text-[11px] text-slate-600">Reconciliation & audit</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </Link>
                    </div>
                </div>

                {/* Error/DLQ notice */}
                {!runsLoading && runs.some(r => r.failedCount > 0) && (
                    <Link
                        href="/dlq"
                        className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/15 rounded-2xl hover:border-red-500/25 transition-colors group"
                    >
                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-red-400">Failed items detected</p>
                            <p className="text-xs text-red-400/60 mt-0.5">Check the Dead Letter Queue</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-red-400/50 group-hover:text-red-400 transition-colors ml-auto" />
                    </Link>
                )}
            </div>
        </div>
    );
}
