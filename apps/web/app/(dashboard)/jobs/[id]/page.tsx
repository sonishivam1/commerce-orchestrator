'use client';

import { useQuery, useMutation } from '@apollo/client';
import { GET_JOB } from '@/lib/graphql/queries/job.queries';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { REPLAY_JOB } from '@/lib/graphql/mutations';
import Link from 'next/link';
import {
    CheckCircle2,
    Loader2,
    Copy,
    ChevronRight,
    Timer,
    Hash,
    RotateCcw,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────── */
interface Job {
    id: string;
    kind: string;
    status: string;
    traceId?: string;
    createdAt: string;
    completedAt?: string;
    processedCount: number;
    failedCount: number;
}

interface DlqItem {
    id: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload?: string;
}

/* ─── Status Badge ─────────────────────────────────────────── */
const STATUS_STYLE: Record<string, string> = {
    RUNNING: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
    COMPLETED: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    FAILED: 'bg-red-500/15 text-red-400 border border-red-500/30',
    PENDING: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    PAUSED: 'bg-slate-700/50 text-slate-300 border border-slate-600',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-bold tracking-wider uppercase ${STATUS_STYLE[status] ?? STATUS_STYLE.PENDING}`}>
            {status}
        </span>
    );
}

/* ─── Stat Card ────────────────────────────────────────────── */
function StatCard({
    label,
    value,
    unit,
    isError,
    canCopy,
}: {
    label: string;
    value: string;
    unit?: string;
    isError?: boolean;
    canCopy?: boolean;
}) {
    return (
        <div className={`bg-[#131B2C] border rounded-xl p-5 space-y-1 ${isError ? 'border-red-500/20' : 'border-slate-800/80'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isError ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
            <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tracking-tight ${isError ? 'text-red-400' : 'text-white'}`}>{value}</span>
                {unit && <span className="text-sm text-slate-500">{unit}</span>}
                {canCopy && (
                    <button className="ml-auto text-slate-500 hover:text-white transition-colors">
                        <Copy className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── Error Type Badge (DLQ table) ────────────────────────── */
const ERROR_TYPE_STYLE: Record<string, string> = {
    VALIDATION_ERROR: 'bg-red-500/15 text-red-400 border border-red-500/25',
    TRANSIENT: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    FATAL: 'bg-red-600/20 text-red-400 border border-red-600/30',
};

function ErrorTypeBadge({ type }: { type: string }) {
    const normalized = type === 'VALIDATION' ? 'VALIDATION_ERROR' : type;
    const style = ERROR_TYPE_STYLE[normalized] ?? 'bg-slate-800 text-slate-300 border border-slate-700';
    return (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${style}`}>
            {normalized}
        </span>
    );
}

/* ─── DLQ Sub-table ────────────────────────────────────────── */
function FailedItemsTable({ jobId, failedCount }: { jobId: string; failedCount: number }) {
    const { data, loading } = useQuery<{ dlqItems: DlqItem[] }>(GET_DLQ_ITEMS, {
        variables: { jobId },
        skip: failedCount === 0,
    });

    const [replayItem, { loading: replaying }] = useMutation(REPLAY_JOB, {
        refetchQueries: ['GetJob'],
    });

    const items = data?.dlqItems ?? [];

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Failed Items ({failedCount})</h2>

            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#1A253C]/40 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
                                <tr>
                                    <th className="px-5 py-3.5">Item Key</th>
                                    <th className="px-5 py-3.5">Error Type</th>
                                    <th className="px-5 py-3.5">Error Message</th>
                                    <th className="px-5 py-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                                            {failedCount > 0 ? 'Failed items not yet available.' : 'No failed items.'}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{item.itemKey}</td>
                                            <td className="px-5 py-3.5">
                                                <ErrorTypeBadge type={item.errorType} />
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-slate-400 max-w-[260px] truncate">
                                                {item.errorMessage}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button
                                                    disabled={replaying || item.errorType === 'FATAL'}
                                                    onClick={() => replayItem({ variables: { jobId, dlqItemId: item.id } })}
                                                    className="text-xs font-medium text-white bg-[#1E293B] hover:bg-slate-700/60 border border-slate-700/40 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
                                                >
                                                    {replaying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Replay'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Pipeline Steps ───────────────────────────────────────── */
const STEPS = ['Extract', 'Normalize', 'Map', 'Validate', 'Canonical Contract', 'Deploy'];

function PipelineSteps({ activeStep = 3 }: { activeStep?: number }) {
    return (
        <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-6 space-y-1">
            <h3 className="text-sm font-semibold text-white mb-4">Pipeline Steps</h3>
            <div className="space-y-0">
                {STEPS.map((step, i) => {
                    const isDone = i < activeStep;
                    const isActive = i === activeStep;
                    const isPending = i > activeStep;

                    return (
                        <div key={step} className="relative flex items-center gap-4 pb-6 last:pb-0">
                            {/* Connector line */}
                            {i < STEPS.length - 1 && (
                                <div className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${isDone ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                            )}

                            {/* Step circle */}
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center z-10 shrink-0 border-2 transition-all ${
                                isDone
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : isActive
                                    ? 'bg-transparent border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                    : 'bg-[#0A101C] border-slate-700'
                            }`}>
                                {isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                ) : isActive ? (
                                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-slate-700" />
                                )}
                            </div>

                            {/* Step label */}
                            <div className={`flex items-center gap-3 py-2 px-4 rounded-lg flex-1 ${isActive ? 'bg-white/5 border border-white/5' : ''}`}>
                                <span className={`text-sm font-medium ${
                                    isDone ? 'text-white' : isActive ? 'text-amber-400' : 'text-slate-600'
                                }`}>
                                    {step}
                                </span>
                                {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 ml-auto" />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Recent Events ────────────────────────────────────────── */
const MOCK_EVENTS = [
    { time: '2h ago', msg: 'Job initialized' },
    { time: '1h ago', msg: 'Extracted 1672 records' },
    { time: '45m ago', msg: 'Completed normalization' },
    { time: '12m ago', msg: 'Map stage successful' },
];

function RecentEvents() {
    return (
        <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-5">Recent Events</h3>
            <div className="space-y-5">
                {MOCK_EVENTS.map((evt, i) => (
                    <div key={i} className="flex items-baseline gap-4">
                        <div className="relative flex flex-col items-center shrink-0">
                            <div className={`h-2.5 w-2.5 rounded-full ${i < 3 ? 'bg-slate-500' : 'bg-slate-700'}`} />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 mr-2">{evt.time}</span>
                            <span className="text-sm text-slate-300">{evt.msg}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function JobDetailPage({ params }: { params: { id: string } }) {
    const { data, loading, error } = useQuery<{ job: Job }>(GET_JOB, {
        variables: { id: params.id },
        pollInterval: 5_000,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-slate-400 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading pipeline…
            </div>
        );
    }

    if (error || !data?.job) {
        return (
            <div className="max-w-3xl space-y-4">
                <Link href="/jobs" className="text-sm text-slate-400 hover:text-white transition-colors">
                    ← Back to Jobs
                </Link>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-5 text-sm text-red-400">
                    {error?.message ?? 'Job not found'}
                </div>
            </div>
        );
    }

    const job = data.job;
    const totalRecords = 1672;
    const percentage = totalRecords > 0 ? Math.min(100, Math.floor((job.processedCount / totalRecords) * 100)) : 0;

    return (
        <div className="space-y-6 pb-10">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Link href="/jobs" className="hover:text-white transition-colors">Jobs</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-white font-medium">JOB-{job.id.substring(0, 8).toUpperCase()}</span>
            </div>

            {/* Header */}
            <div className="space-y-1">
                <p className="text-xs text-slate-400">Commerce Data Orchestrator</p>
                <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-2xl font-bold text-white tracking-tight uppercase">{job.kind}</h1>
                    <StatusBadge status={job.status} />
                    <span className="text-sm text-slate-400 ml-auto">
                        Started 2h ago ({new Date(job.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })} GMT)
                    </span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Processed" value={job.processedCount.toLocaleString()} unit="items" />
                <StatCard label="Failed" value={job.failedCount.toLocaleString()} unit="items" isError={job.failedCount > 0} />
                <StatCard label="Duration" value="00:12:43" />
                <StatCard label="Trace ID" value={`tr-${job.id.substring(0, 8)}`} canCopy />
            </div>

            {/* Progress Bar */}
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-5 space-y-3">
                <div className="h-3 w-full bg-[#0A101C] rounded-full overflow-hidden border border-slate-800/60">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-primary rounded-full transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{job.processedCount.toLocaleString()} / {totalRecords.toLocaleString()} records</span>
                    <span className="text-primary font-bold">{percentage}%</span>
                </div>
            </div>

            {/* Pipeline + Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <PipelineSteps />
                <RecentEvents />
            </div>

            {/* Failed Items Table */}
            <FailedItemsTable jobId={job.id} failedCount={job.failedCount} />
        </div>
    );
}
