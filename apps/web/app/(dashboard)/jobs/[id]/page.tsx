'use client';

import { useQuery, useMutation } from '@apollo/client';
import { GET_JOB } from '@/lib/graphql/queries/job.queries';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { REPLAY_JOB, DELETE_JOB, DELETE_DLQ_ITEM } from '@/lib/graphql/mutations';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    CheckCircle2,
    Loader2,
    Copy,
    ChevronRight,
    Timer,
    Hash,
    RotateCcw,
    Activity,
    Clock,
    Zap,
    Layers,
    ArrowRight,
    Play,
    Trash2,
    ChevronDown,
    Map,
    AlertTriangle,
    Download,
} from 'lucide-react';

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

interface Job {
    id: string;
    kind: string;
    status: string;
    traceId?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    processedCount: number;
    failedCount: number;
    sourceCredentialId?: string;
    targetCredentialId?: string;
    sourceUrl?: string;
}

interface DlqItem {
    id: string;
    jobId: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload?: string;
    canReplay: boolean;
    replayed: boolean;
    replayedAt?: string;
    createdAt: string;
}

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Status Badge ─────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
    RUNNING:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20'    },
    COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    FAILED:    { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20'     },
    PENDING:   { bg: 'bg-slate-700/10',   text: 'text-slate-300',   border: 'border-slate-600/20'   },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
    return (
        <span className={cn(
            'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-black tracking-widest uppercase border',
            style.bg, style.text, style.border,
        )}>
            <div className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'RUNNING' && 'animate-pulse',
                style.text.replace('text', 'bg'),
            )} />
            {status}
        </span>
    );
}

/* ─── Metric Card ──────────────────────────────────────────── */
function MetricCard({
    title,
    value,
    unit,
    icon: Icon,
    color = 'blue',
}: {
    title: string;
    value: string | number;
    unit: string;
    icon: React.ComponentType<{ className?: string }>;
    color?: 'blue' | 'emerald' | 'red' | 'amber' | 'indigo';
}) {
    const themes: Record<string, string> = {
        blue:    'border-t-blue-500 shadow-blue-500/5',
        emerald: 'border-t-emerald-500 shadow-emerald-500/5',
        red:     'border-t-red-500 shadow-red-500/5',
        amber:   'border-t-amber-500 shadow-amber-500/5',
        indigo:  'border-t-indigo-500 shadow-indigo-500/5',
    };
    const iconColors: Record<string, string> = {
        blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        red:     'text-red-400 bg-red-500/10 border-red-500/20',
        amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
        indigo:  'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    };

    return (
        <div className={cn(
            'bg-[#1E293B]/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] border-t-2 shadow-2xl',
            themes[color],
        )}>
            <div className="flex items-center gap-3 mb-4">
                <div className={cn('h-10 w-10 flex items-center justify-center rounded-xl border shrink-0', iconColors[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tighter text-white">{value}</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{unit}</span>
            </div>
        </div>
    );
}

/* ─── Duration helper ──────────────────────────────────────── */
function computeDuration(createdAt: string, completedAt?: string): string {
    const start = new Date(createdAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const ms = end - start;
    if (ms < 1_000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
}

/* ─── Copy to clipboard ────────────────────────────────────── */
function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="ml-2 text-slate-600 hover:text-primary cursor-pointer transition-colors"
        >
            {copied ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
        </button>
    );
}

/* ─── Pipeline Visualization ───────────────────────────────── */
function PipelineBridge({
    job,
    credentials,
}: {
    job: Job;
    credentials: Credential[];
}) {
    const srcCred = credentials.find(c => c.id === job.sourceCredentialId);
    const dstCred = credentials.find(c => c.id === job.targetCredentialId);

    const sourceLabel = srcCred?.alias ?? (job.sourceUrl ? 'Web Source' : job.sourceCredentialId?.substring(0, 12) ?? '—');
    const sourcePlatform = srcCred?.platform ?? (job.sourceUrl ? 'URL' : 'Unknown');
    const sourceDetail = job.sourceUrl ?? job.sourceCredentialId ?? '—';

    const destLabel = dstCred?.alias ?? job.targetCredentialId?.substring(0, 12) ?? '—';
    const destPlatform = dstCred?.platform ?? 'Unknown';
    const destDetail = job.targetCredentialId ?? '—';

    return (
        <div className="bg-[#1E293B]/20 border border-white/5 rounded-[32px] p-8 flex items-center justify-between gap-12 relative overflow-hidden group shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Source */}
            <div className="flex-1 space-y-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Map className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source — {sourcePlatform}</p>
                        <p className="text-sm font-bold text-white uppercase tracking-tight">{sourceLabel}</p>
                    </div>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                    <p className="text-[11px] font-mono text-slate-400 break-all">{sourceDetail}</p>
                </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-2 px-4 relative">
                <div className="w-48 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse opacity-60" />
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                    <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">
                    {job.status === 'RUNNING' ? 'Relaying' : job.status}
                </span>
            </div>

            {/* Destination */}
            <div className="flex-1 space-y-4 relative z-10 text-right">
                <div className="flex items-center gap-3 justify-end">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sink — {destPlatform}</p>
                        <p className="text-sm font-bold text-white uppercase tracking-tight">{destLabel}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-left">
                    <p className="text-[11px] font-mono text-emerald-400 break-all">{destDetail}</p>
                </div>
            </div>
        </div>
    );
}

/* ─── Pipeline Steps + Recent Events ──────────────────────── */

const PIPELINE_STEPS = [
    { key: 'extract',    label: 'Extract',           desc: 'Pull records from source platform'     },
    { key: 'normalize',  label: 'Normalize',          desc: 'Flatten to canonical data model'       },
    { key: 'map',        label: 'Map',                desc: 'Apply field-level mapping rules'       },
    { key: 'validate',   label: 'Validate',           desc: 'Assert canonical contract'             },
    { key: 'canonical',  label: 'Canonical Contract', desc: 'Enforce schema invariants'             },
    { key: 'deploy',     label: 'Deploy',             desc: 'Upsert records into target platform'   },
];

type StepStatus = 'done' | 'active' | 'pending' | 'failed';

function deriveStepStatuses(job: Job): StepStatus[] {
    const s = job.status;
    if (s === 'PENDING') return PIPELINE_STEPS.map(() => 'pending');
    if (s === 'COMPLETED') return PIPELINE_STEPS.map(() => 'done');
    if (s === 'FAILED') {
        // assume failure at validate or deploy stage
        const failAt = job.failedCount > 0 ? 3 : 5;
        return PIPELINE_STEPS.map((_, i) =>
            i < failAt ? 'done' : i === failAt ? 'failed' : 'pending'
        );
    }
    // RUNNING — progress through stages based on processedCount
    const p = job.processedCount;
    const activeIdx = p === 0 ? 0 : p < 50 ? 1 : p < 200 ? 2 : p < 500 ? 3 : 4;
    return PIPELINE_STEPS.map((_, i) =>
        i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending'
    );
}

function StepRow({ label, desc, status }: { label: string; desc: string; status: StepStatus }) {
    return (
        <div className="flex items-start gap-3.5">
            {/* icon */}
            <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                status === 'done'    && 'bg-emerald-500/15 border-emerald-500/30',
                status === 'active'  && 'bg-primary/15 border-primary/30',
                status === 'pending' && 'bg-white/5 border-white/10',
                status === 'failed'  && 'bg-red-500/15 border-red-500/30',
            )}>
                {status === 'done'    && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                {status === 'active'  && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
                {status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-white/20" />}
                {status === 'failed'  && <AlertTriangle className="h-3 w-3 text-red-400" />}
            </div>
            {/* text */}
            <div className="space-y-0.5">
                <p className={cn(
                    'text-sm font-semibold',
                    status === 'done'    && 'text-white',
                    status === 'active'  && 'text-primary',
                    status === 'pending' && 'text-slate-600',
                    status === 'failed'  && 'text-red-400',
                )}>{label}</p>
                <p className="text-[10px] text-slate-600">{desc}</p>
            </div>
        </div>
    );
}

function buildEvents(job: Job): { ago: string; text: string }[] {
    const now = Date.now();
    const msAgo = (iso: string) => {
        const ms = now - new Date(iso).getTime();
        if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
        if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
        return `${Math.round(ms / 3_600_000)}h ago`;
    };

    const events: { ago: string; text: string }[] = [];
    events.push({ ago: msAgo(job.createdAt), text: 'Job initialized' });

    if (job.startedAt) {
        events.push({ ago: msAgo(job.startedAt), text: 'Extraction started' });
    }

    if (job.processedCount > 0) {
        events.push({
            ago: job.startedAt ? msAgo(job.startedAt) : msAgo(job.createdAt),
            text: `Extracted ${job.processedCount.toLocaleString()} records`,
        });
    }

    if (job.processedCount > 50) {
        events.push({ ago: '—', text: 'Normalization complete' });
    }

    if (job.processedCount > 200) {
        events.push({ ago: '—', text: 'Map stage successful' });
    }

    if (job.completedAt) {
        events.push({ ago: msAgo(job.completedAt), text: job.status === 'FAILED' ? 'Job failed' : 'Migration complete' });
    }

    return events.slice(0, 6);
}

function PipelineStepsAndEvents({ job }: { job: Job }) {
    const statuses = deriveStepStatuses(job);
    const events = buildEvents(job);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pipeline Steps */}
            <div className="bg-[#131B2C]/70 border border-white/8 rounded-xl p-6 space-y-1">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Pipeline Steps</h2>
                <div className="space-y-4">
                    {PIPELINE_STEPS.map((step, i) => (
                        <StepRow key={step.key} label={step.label} desc={step.desc} status={statuses[i]} />
                    ))}
                </div>
            </div>

            {/* Recent Events */}
            <div className="bg-[#131B2C]/70 border border-white/8 rounded-xl p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Recent Events</h2>
                <div className="space-y-3">
                    {events.map((ev, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                            <span className="text-[10px] font-mono text-slate-600 shrink-0 mt-0.5 w-14 text-right">{ev.ago}</span>
                            <div className="flex items-start gap-2.5">
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-600 shrink-0 mt-1.5" />
                                <span className="text-slate-400 text-xs">{ev.text}</span>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && (
                        <p className="text-xs text-slate-600">No events yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Failed Items Table ───────────────────────────────────── */
function FailedItemsTable({
    jobId,
    failedCount,
}: {
    jobId: string;
    failedCount: number;
}) {
    const { data, loading, refetch } = useQuery<{ dlqItems: DlqItem[] }>(GET_DLQ_ITEMS, {
        variables: { jobId },
        skip: failedCount === 0,
    });

    const [replayItem, { loading: replaying }] = useMutation(REPLAY_JOB, {
        refetchQueries: ['GetJob', 'GetDlqItems'],
    });

    const [deleteItem] = useMutation(DELETE_DLQ_ITEM, {
        onCompleted: () => refetch(),
    });

    const items = data?.dlqItems ?? [];

    return (
        <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-red-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">In-Flight Faults</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Buffer Status:</span>
                    <span className={cn(
                        'text-xs font-bold px-3 py-1 rounded-lg border',
                        failedCount > 0
                            ? 'text-red-400 bg-red-500/10 border-red-500/20'
                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    )}>
                        {failedCount > 0 ? 'ATTENTION REQUIRED' : 'MESH OPTIMIZED'}
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                        <tr>
                            <th className="px-8 py-5">Correlation ID</th>
                            <th className="px-6 py-5">Error Type</th>
                            <th className="px-6 py-5">Status Message</th>
                            <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                                    <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Synchronizing Cache...</p>
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-32 text-center text-slate-500">
                                    <CheckCircle2 className="h-12 w-12 text-emerald-500/20 mx-auto mb-4" />
                                    <p className="text-sm font-bold tracking-tight">No active faults detected in this stream.</p>
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                'h-1.5 w-1.5 rounded-full',
                                                item.replayed ? 'bg-emerald-500' : 'bg-red-500 animate-pulse',
                                            )} />
                                            <span className="font-mono text-xs text-slate-300 tracking-tighter">{item.itemKey}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-black text-red-400 px-2 py-1 bg-red-400/10 rounded-md border border-red-400/20 uppercase tracking-widest">
                                            {item.errorType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs text-slate-400 max-w-[400px] truncate group-hover:text-slate-200 transition-colors">
                                            {item.errorMessage}
                                        </p>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                disabled={replaying || !item.canReplay || item.replayed}
                                                onClick={() => replayItem({ variables: { jobId, dlqItemId: item.id } })}
                                                title={item.replayed ? 'Already replayed' : !item.canReplay ? 'Not replayable (VALIDATION error)' : 'Retry item'}
                                                className="h-9 px-4 rounded-xl bg-primary/20 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                {replaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                                                {item.replayed ? 'Replayed' : 'Retry'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm('Delete this DLQ item?')) {
                                                        deleteItem({ variables: { id: item.id } });
                                                    }
                                                }}
                                                title="Delete DLQ item"
                                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:border-red-400/20 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Main Page ────────────────────────────────────────────── */
import React from 'react';

export default function JobDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();

    const { data, loading, error } = useQuery<{ job: Job }>(GET_JOB, {
        variables: { id: params.id },
        pollInterval: 5_000,
    });

    const { data: credsData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const [deleteJob, { loading: deleting }] = useMutation(DELETE_JOB, {
        onCompleted: () => router.push('/jobs'),
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Connecting to Pipeline Shard...</span>
            </div>
        );
    }

    if (error || !data?.job) {
        return (
            <div className="max-w-2xl mx-auto py-20">
                <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white transition-colors mb-8">
                    <ChevronRight className="h-4 w-4 rotate-180" /> Back to Jobs
                </Link>
                <div className="rounded-[32px] bg-red-500/5 border border-red-500/10 p-10 text-center">
                    <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Job Not Found</h1>
                    <p className="text-sm text-slate-400 mb-8 font-medium">{error?.message ?? 'Job ID not found in this tenant.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-500 hover:bg-red-600 text-white font-black px-8 py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const job = data.job;
    const credentials = credsData?.credentials ?? [];
    const duration = computeDuration(job.createdAt, job.completedAt);
    const errorRate = job.processedCount + job.failedCount > 0
        ? `${((job.failedCount / (job.processedCount + job.failedCount)) * 100).toFixed(1)}%`
        : '0%';

    const handleDelete = () => {
        if (confirm('Delete this job? This cannot be undone.')) {
            deleteJob({ variables: { id: job.id } });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between">
                <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors">Orchestrator</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <Link href="/jobs" className="hover:text-primary transition-colors">Managed Jobs</Link>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">JOB-{job.id.substring(0, 8).toUpperCase()}</span>
                </nav>

                {/* Trace ID badge */}
                {job.traceId && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl">
                        <Hash className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-300 tracking-widest font-mono">
                            {job.traceId.substring(0, 13).toUpperCase()}
                        </span>
                        <CopyButton value={job.traceId} />
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className={cn(
                        'text-5xl font-black tracking-tighter mb-3',
                        job.kind.includes('SCRAPE') ? 'text-indigo-400' : 'text-blue-400',
                    )}>
                        {job.kind.replace(/_/g, ' ')}
                    </h1>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Started {new Date(job.createdAt).toLocaleString()}
                            </span>
                        </div>
                        {job.completedAt && (
                            <>
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                <div className="flex items-center gap-3">
                                    <Timer className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                                        Finished {new Date(job.completedAt).toLocaleString()}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <StatusBadge status={job.status} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Throughput"
                    value={job.processedCount.toLocaleString()}
                    unit="Items"
                    icon={Activity}
                    color="blue"
                />
                <MetricCard
                    title="Duration"
                    value={duration}
                    unit={job.completedAt ? 'Total' : 'Elapsed'}
                    icon={Timer}
                    color="amber"
                />
                <MetricCard
                    title="Error Rate"
                    value={errorRate}
                    unit="Ratio"
                    icon={RotateCcw}
                    color="red"
                />
                <MetricCard
                    title="DLQ Depth"
                    value={job.failedCount}
                    unit="Items"
                    icon={Layers}
                    color="indigo"
                />
            </div>

            {/* Progress bar — overall record progress */}
            {(job.processedCount > 0 || job.failedCount > 0) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono">
                            {job.processedCount.toLocaleString()} / {(job.processedCount + job.failedCount).toLocaleString()} records
                        </span>
                        <span className="font-mono text-slate-300">
                            {job.processedCount + job.failedCount > 0
                                ? `${((job.processedCount / (job.processedCount + job.failedCount)) * 100).toFixed(0)}%`
                                : '0%'}
                        </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-700"
                            style={{
                                width: `${job.processedCount + job.failedCount > 0
                                    ? ((job.processedCount / (job.processedCount + job.failedCount)) * 100).toFixed(1)
                                    : 0}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Pipeline Steps + Recent Events */}
            <PipelineStepsAndEvents job={job} />

            {/* Faults Section */}
            <FailedItemsTable jobId={job.id} failedCount={job.failedCount} />

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <button
                    onClick={() => {
                        const payload = JSON.stringify(job, null, 2);
                        const blob = new Blob([payload], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `job-${job.id}-trace.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="flex-1 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all"
                >
                    <Download className="h-4 w-4" />
                    Download Trace (JSON)
                </button>

                <button
                    onClick={handleDelete}
                    disabled={deleting || job.status === 'RUNNING'}
                    title={job.status === 'RUNNING' ? 'Cannot delete a running job' : 'Delete job'}
                    className="h-[60px] w-[60px] flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-6 w-6" />}
                </button>
            </div>
        </div>
    );
}
