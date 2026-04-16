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
    Activity,
    Clock,
    Zap,
    Layers,
    ArrowRight,
    Search,
    Filter,
    ArrowUpRight,
    Play,
    Trash2,
    ChevronDown,
    Map
} from 'lucide-react';

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

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Status Badge ─────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string, text: string, border: string }> = {
    RUNNING: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    FAILED: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    PENDING: { bg: 'bg-slate-700/10', text: 'text-slate-300', border: 'border-slate-600/20' },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
    return (
        <span className={cn(
            "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-black tracking-widest uppercase border",
            style.bg, style.text, style.border
        )}>
            <div className={cn("h-1.5 w-1.5 rounded-full", status === 'RUNNING' && "animate-pulse", style.text.replace('text', 'bg'))} />
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
    icon: any;
    color?: 'blue' | 'emerald' | 'red' | 'amber' | 'indigo';
}) {
    const themes = {
        blue: 'border-t-blue-500 shadow-blue-500/5',
        emerald: 'border-t-emerald-500 shadow-emerald-500/5',
        red: 'border-t-red-500 shadow-red-500/5',
        amber: 'border-t-amber-500 shadow-amber-500/5',
        indigo: 'border-t-indigo-500 shadow-indigo-500/5',
    };

    const iconColors = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    };

    return (
        <div className={cn(
            "bg-[#1E293B]/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] border-t-2 shadow-2xl",
            themes[color]
        )}>
            <div className="flex items-center gap-3 mb-4">
                <div className={cn("h-10 w-10 flex items-center justify-center rounded-xl border shrink-0", iconColors[color])}>
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

/* ─── Source-Destination Map Visual ────────────────────────── */
function PipelineBridge({ job }: { job: Job }) {
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
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source Entity</p>
                        <p className="text-sm font-bold text-white uppercase tracking-tight">Commercetools Dev</p>
                    </div>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                    <p className="text-[11px] font-mono text-slate-400">shard://us-central1.gcp.ct/project-alpha</p>
                </div>
            </div>

            {/* Transition Animation */}
            <div className="flex flex-col items-center gap-2 px-4 relative">
                <div className="w-48 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer" />
                </div>
                <div className="h-12 w-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                    <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">Relaying</span>
            </div>

            {/* Destination */}
            <div className="flex-1 space-y-4 relative z-10 text-right">
                <div className="flex items-center gap-3 justify-end">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sink Entity</p>
                        <p className="text-sm font-bold text-white uppercase tracking-tight">BigCommerce Prod</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 text-left">
                    <p className="text-[11px] font-mono text-emerald-400">https://api.bigcommerce.com/stores/x7z2...</p>
                </div>
            </div>
        </div>
    );
}

/* ─── Failed Items Section ─────────────────────────────────── */
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
        <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-red-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">In-Flight Faults</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Buffer Status:</span>
                    <span className={cn(
                        "text-xs font-bold px-3 py-1 rounded-lg border",
                        failedCount > 0 ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
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
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
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
                                                disabled={replaying || item.errorType === 'FATAL'}
                                                onClick={() => replayItem({ variables: { jobId, dlqItemId: item.id } })}
                                                className="h-9 px-4 rounded-xl bg-primary/20 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-30"
                                            >
                                                {replaying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />} 
                                                Retry
                                            </button>
                                            <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 transition-all">
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
export default function JobDetailPage({ params }: { params: { id: string } }) {
    const { data, loading, error } = useQuery<{ job: Job }>(GET_JOB, {
        variables: { id: params.id },
        pollInterval: 5_000,
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
            <div className="max-w-2xl mx-auto py-20 animate-in shake-1">
                <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white transition-colors mb-8">
                    <ChevronRight className="h-4 w-4 rotate-180" /> Back to Dashboard
                </Link>
                <div className="rounded-[32px] bg-red-500/5 border border-red-500/10 p-10 text-center">
                    <Activity className="h-16 w-16 text-red-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Endpoint Desynchronized</h1>
                    <p className="text-sm text-slate-400 mb-8 font-medium">{error?.message ?? 'Requested job identifier is not present in local mesh.'}</p>
                    <button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 text-white font-black px-8 py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all">
                        Retry Handshake
                    </button>
                </div>
            </div>
        );
    }

    const job = data.job;

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
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl">
                        <Hash className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-300 tracking-widest">TR-9821-X2</span>
                        <Copy className="h-3 w-3 text-slate-600 hover:text-primary cursor-pointer transition-colors ml-2" />
                    </div>
                </div>
            </div>

            {/* Header Area */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className={cn(
                        "text-5xl font-black tracking-tighter mb-3",
                        job.kind.includes('SCRAPE') ? "text-indigo-400" : "text-blue-400"
                    )}>
                        {job.kind}
                    </h1>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Started {new Date(job.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700" />
                        <div className="flex items-center gap-3">
                            <Activity className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Real-time Telemetry Active
                            </span>
                        </div>
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
                    title="Latency" 
                    value="124ms" 
                    unit="Avg" 
                    icon={Clock} 
                    color="amber" 
                />
                <MetricCard 
                    title="Error Rate" 
                    value={`${((job.failedCount / (job.processedCount || 1)) * 100).toFixed(1)}%`} 
                    unit="Ratio" 
                    icon={XCircle} 
                    color="red" 
                />
                <MetricCard 
                    title="Queue Load" 
                    value="12%" 
                    unit="Cap" 
                    icon={Layers} 
                    color="indigo" 
                />
            </div>

            {/* Pipeline Visualization */}
            <PipelineBridge job={job} />

            {/* Faults Section */}
            <FailedItemsTable jobId={job.id} failedCount={job.failedCount} />

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all">
                    Generate Post-Mortem
                </button>
                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all">
                    Download Raw Trace (JSON)
                </button>
                <button className="h-[60px] w-[60px] flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/10">
                    <Trash2 className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
}

// Helper icons missing in imports
const XCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
);

