'use client';

import { useQuery } from '@apollo/client';
import {
    GET_MIGRATION_RUN,
    GET_RECONCILIATION_REPORT,
} from '@/lib/graphql/queries/migration-project.queries';
import { GET_MIGRATION_PROJECT } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';
import {
    ChevronLeft,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    FlaskConical,
    BarChart3,
    ArrowRight,
    Layers,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface WaveRecord {
    entityType: string;
    status: string;
    processedCount: number;
    failedCount: number;
    startedAt?: string;
    completedAt?: string;
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
    correlationId?: string;
    createdAt: string;
}

interface MigrationProject {
    id: string;
    name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const WAVE_META: Record<string, { label: string; color: string; progressColor: string; bg: string; border: string }> = {
    CATEGORIES: {
        label: 'Categories',
        color: 'text-purple-400',
        progressColor: 'bg-purple-500',
        bg: 'bg-purple-500/8',
        border: 'border-purple-500/20',
    },
    PRODUCTS: {
        label: 'Products',
        color: 'text-blue-400',
        progressColor: 'bg-blue-500',
        bg: 'bg-blue-500/8',
        border: 'border-blue-500/20',
    },
    CUSTOMERS: {
        label: 'Customers',
        color: 'text-cyan-400',
        progressColor: 'bg-cyan-500',
        bg: 'bg-cyan-500/8',
        border: 'border-cyan-500/20',
    },
    ORDERS: {
        label: 'Orders',
        color: 'text-amber-400',
        progressColor: 'bg-amber-500',
        bg: 'bg-amber-500/8',
        border: 'border-amber-500/20',
    },
};

const WAVE_STATUS_ICONS: Record<string, React.ReactNode> = {
    PENDING:   <Clock className="h-4 w-4 text-slate-500" />,
    RUNNING:   <Zap className="h-4 w-4 text-blue-400" />,
    COMPLETED: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    FAILED:    <XCircle className="h-4 w-4 text-red-400" />,
    SKIPPED:   <Clock className="h-4 w-4 text-slate-600" />,
};

// Wave card — prototype-style with progress bar + stats
function WaveCard({ wave, isActive }: { wave: WaveRecord; isActive: boolean }) {
    const meta = WAVE_META[wave.entityType];
    const total = wave.processedCount + wave.failedCount;
    const progressPct = total > 0
        ? Math.min(100, (wave.processedCount / total) * 100)
        : wave.status === 'COMPLETED' ? 100 : 0;

    const duration =
        wave.startedAt && wave.completedAt
            ? `${Math.round((new Date(wave.completedAt).getTime() - new Date(wave.startedAt).getTime()) / 1000)}s`
            : wave.startedAt
            ? 'Running…'
            : null;

    return (
        <div className={cn(
            'relative bg-[#131B2C]/70 border rounded-xl p-5 space-y-4 transition-all duration-300',
            meta ? meta.border : 'border-white/8',
            meta ? meta.bg : '',
            isActive && 'ring-1 ring-blue-500/30',
        )}>
            {/* Wave header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {WAVE_STATUS_ICONS[wave.status] ?? WAVE_STATUS_ICONS.PENDING}
                    <span className={cn('text-sm font-semibold', meta?.color ?? 'text-slate-300')}>
                        {meta?.label ?? wave.entityType}
                    </span>
                    {isActive && wave.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /> Live
                        </span>
                    )}
                </div>
                <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    wave.status === 'COMPLETED' ? 'text-emerald-400' :
                    wave.status === 'RUNNING'   ? 'text-blue-400'    :
                    wave.status === 'FAILED'    ? 'text-red-400'     :
                    wave.status === 'SKIPPED'   ? 'text-slate-600'   : 'text-slate-500',
                )}>
                    {wave.status}
                </span>
            </div>

            {/* Progress bar */}
            {(wave.status !== 'PENDING' && wave.status !== 'SKIPPED') && (
                <div className="space-y-1.5">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700', meta?.progressColor ?? 'bg-blue-500')}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                        <span>{progressPct.toFixed(0)}%</span>
                        {duration && <span>{duration}</span>}
                    </div>
                </div>
            )}

            {/* Counts */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">Processed</p>
                    <p className={cn('text-lg font-bold font-mono', meta?.color ?? 'text-white')}>
                        {wave.processedCount.toLocaleString()}
                    </p>
                </div>
                {wave.failedCount > 0 && (
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">Failed</p>
                        <p className="text-lg font-bold font-mono text-red-400">
                            {wave.failedCount.toLocaleString()}
                        </p>
                    </div>
                )}
            </div>

            {/* Shimmer for running waves */}
            {wave.status === 'RUNNING' && (
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
                </div>
            )}
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function RunDetail({ runId }: { runId: string }) {
    const { data: runData, loading: runLoading } = useQuery<{ migrationRun: MigrationRun }>(
        GET_MIGRATION_RUN,
        {
            variables: { id: runId },
            pollInterval: 3000,
        },
    );

    const run = runData?.migrationRun;

    const { data: projectData } = useQuery<{ migrationProject: MigrationProject }>(
        GET_MIGRATION_PROJECT,
        {
            variables: { id: run?.migrationProjectId },
            skip: !run?.migrationProjectId,
        },
    );

    const { data: reportData } = useQuery(GET_RECONCILIATION_REPORT, {
        variables: { migrationRunId: runId },
        skip: run?.status !== 'COMPLETED',
    });

    const project = projectData?.migrationProject;
    const report = reportData?.reconciliationReport;

    if (runLoading && !run) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!run) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <p className="text-white font-semibold">Run not found</p>
                <Link href="/runs" className="text-primary text-sm hover:underline">Back to Live Execution</Link>
            </div>
        );
    }

    const activeWave = run.waves.find(w => w.status === 'RUNNING');
    const totalRecords = run.processedCount + run.failedCount;
    const successRate = totalRecords > 0
        ? ((run.processedCount / totalRecords) * 100).toFixed(1)
        : null;

    const startTime = run.startedAt
        ? new Date(run.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Back */}
            <div className="flex items-center gap-3">
                <Link
                    href={project ? `/projects/${project.id}` : '/runs'}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    {project ? project.name : 'Live Execution'}
                </Link>
            </div>

            {/* Run header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-white">Migration Run</h1>
                        {run.dryRun && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 uppercase tracking-wider">
                                <FlaskConical className="h-3 w-3" /> Dry Run
                            </span>
                        )}
                        <span className={cn(
                            'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border',
                            run.status === 'RUNNING'   ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'       :
                            run.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                            run.status === 'FAILED'    ? 'text-red-400 bg-red-500/10 border-red-500/20'          :
                            run.status === 'PENDING'   ? 'text-slate-400 bg-slate-700/30 border-slate-600/20'    :
                            'text-slate-500 bg-slate-800/50 border-slate-700/20',
                        )}>
                            {run.status === 'RUNNING' && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
                            {run.status}
                        </span>
                    </div>
                    <p className="text-xs font-mono text-slate-500">{runId}</p>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Processed', value: run.processedCount.toLocaleString(), color: 'text-emerald-400' },
                    { label: 'Failed',    value: run.failedCount.toLocaleString(),    color: run.failedCount > 0 ? 'text-red-400' : 'text-slate-500' },
                    { label: 'Success',   value: successRate ? `${successRate}%` : '—',  color: 'text-white' },
                    { label: 'Waves',     value: `${run.waves.filter(w => w.status === 'COMPLETED').length} / ${run.waves.length}`, color: 'text-white' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-4 space-y-1">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
                        <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Started at */}
            {startTime && (
                <p className="text-xs text-slate-600 font-mono">
                    Started: {startTime}
                    {run.correlationId && <> · Correlation: {run.correlationId}</>}
                </p>
            )}

            {/* Waves — prototype-style grid */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-300">Wave Execution</h2>
                    {(run.status === 'RUNNING' || run.status === 'PENDING') && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {run.waves.map(wave => (
                        <WaveCard
                            key={wave.entityType}
                            wave={wave}
                            isActive={activeWave?.entityType === wave.entityType}
                        />
                    ))}
                </div>
            </div>

            {/* Reconciliation link when completed */}
            {run.status === 'COMPLETED' && (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-white">Migration complete</p>
                            <p className="text-xs text-slate-500">
                                {report
                                    ? `Overall success rate: ${report.overallSuccessRate.toFixed(1)}%`
                                    : 'Reconciliation report available'}
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/reports/${runId}`}
                        className="inline-flex items-center gap-2 text-primary text-xs font-semibold hover:underline shrink-0"
                    >
                        <BarChart3 className="h-4 w-4" /> View Report <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}
