'use client';

import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import {
    CheckCircle,
    XCircle,
    Loader2,
    Search,
    Eye,
    Trash2,
    ChevronDown,
    RefreshCw,
    Repeat,
    Plus,
    Filter,
    ArrowUpRight
} from 'lucide-react';

interface Job {
    id: string;
    kind: string;
    status: string;
    tenantId: string;
    createdAt: string;
    processedCount: number;
    failedCount: number;
}

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Status Badge ─────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    RUNNING: { 
        bg: 'bg-blue-500/10', 
        text: 'text-blue-400', 
        border: 'border-blue-500/20',
        dot: 'bg-blue-400'
    },
    COMPLETED: { 
        bg: 'bg-emerald-500/10', 
        text: 'text-emerald-400', 
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-400'
    },
    FAILED: { 
        bg: 'bg-red-500/10', 
        text: 'text-red-400', 
        border: 'border-red-500/20',
        dot: 'bg-red-400'
    },
    PENDING: { 
        bg: 'bg-slate-500/10', 
        text: 'text-slate-400', 
        border: 'border-slate-500/20',
        dot: 'bg-slate-400'
    },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border",
            style.bg, style.text, style.border
        )}>
            <span className={cn("h-1 w-1 rounded-full animate-pulse", style.dot)} />
            {status}
        </span>
    );
}

/* ─── Kind Badge ───────────────────────────────────────────── */
const KIND_STYLE: Record<string, string> = {
    CROSS_PLATFORM_MIGRATION: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    PLATFORM_CLONE: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    SCRAPE_IMPORT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    EXPORT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function KindBadge({ kind }: { kind: string }) {
    const style = KIND_STYLE[kind] || 'bg-slate-800/10 text-slate-400 border-slate-700/20';
    return (
        <span className={cn(
            "inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-extrabold tracking-tight border",
            style
        )}>
            {kind.replace(/_/g, ' ')}
        </span>
    );
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

/* ─── Metric Card ──────────────────────────────────────────── */
function MetricCard({
    title,
    value,
    icon: Icon,
    color = 'blue',
}: {
    title: string;
    value: number;
    icon: any;
    color?: 'blue' | 'emerald' | 'red' | 'amber';
}) {
    const themes = {
        blue: 'border-t-blue-500 shadow-blue-500/5',
        emerald: 'border-t-emerald-500 shadow-emerald-500/5',
        red: 'border-t-red-500 shadow-red-500/5',
        amber: 'border-t-amber-500 shadow-amber-500/5',
    };

    const iconColors = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };

    return (
        <div className={cn(
            "bg-[#1E293B]/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] border-t-2 shadow-2xl overflow-hidden relative",
            themes[color]
        )}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icon className="h-20 w-20" />
            </div>
            <div className="flex items-center gap-3 mb-4">
                <div className={cn("h-10 w-10 flex items-center justify-center rounded-xl border shrink-0", iconColors[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tighter text-white">{value}</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">UNIT</span>
            </div>
        </div>
    );
}

/* ─── Main Component ───────────────────────────────────────── */
export function JobList() {
    const { data, loading, error } = useQuery<{ jobs: Job[] }>(GET_JOBS, {
        pollInterval: 10_000,
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
                </div>
                <span className="text-sm font-bold tracking-widest uppercase opacity-50">Synchronizing Data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Sync Error</h3>
                <p className="text-sm text-red-400/80 mb-6">{error.message}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    const jobs = data?.jobs ?? [];
    const total = jobs.length;
    const running = jobs.filter(j => j.status === 'RUNNING').length;
    const completed = jobs.filter(j => j.status === 'COMPLETED').length;
    const failed = jobs.filter(j => j.status === 'FAILED').length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Breadcrumbs & Header */}
            <div>
                <nav className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors">Orchestrator</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">Jobs Dashboard</span>
                </nav>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Jobs</h1>
                        <p className="text-sm font-medium text-slate-400">Manage and monitor your orchestration jobs</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search UUID..."
                                className="bg-[#1E293B]/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-64 transition-all"
                            />
                        </div>
                        <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <Filter className="h-5 w-5" />
                        </button>
                        <Link
                            href="/jobs/new"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            Launch Job
                        </Link>
                    </div>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Pipeline Cluster"
                    value={total}
                    icon={Repeat}
                    color="blue"
                />
                <MetricCard
                    title="Active Workers"
                    value={running}
                    icon={RefreshCw}
                    color="amber"
                />
                <MetricCard
                    title="Resolved Tasks"
                    value={completed}
                    icon={CheckCircle}
                    color="emerald"
                />
                <MetricCard
                    title="Critical Faults"
                    value={failed}
                    icon={XCircle}
                    color="red"
                />
            </div>

            {/* Table Container */}
            <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 bg-white/[0.02]">
                            <tr>
                                <th className="px-8 py-5">Correlation ID</th>
                                <th className="px-6 py-5">Process</th>
                                <th className="px-6 py-5 text-center">Lifecycle</th>
                                <th className="px-6 py-5">Throughput</th>
                                <th className="px-6 py-5">Timestamp</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Repeat className="h-12 w-12" />
                                            <p className="text-sm font-bold tracking-widest uppercase text-slate-400">Environment Empty</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                                <span className="font-mono text-xs text-slate-300 group-hover:text-white transition-colors">
                                                    {job.id.substring(0, 8).toUpperCase()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <KindBadge kind={job.kind} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={job.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col gap-1 min-w-[60px]">
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                        <span>Ok</span>
                                                        <span className="text-emerald-400">{job.processedCount}</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-emerald-500" 
                                                            style={{ width: `${Math.min(100, (job.processedCount / (job.processedCount + job.failedCount || 1)) * 100)}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                                {job.failedCount > 0 && (
                                                    <div className="flex flex-col gap-1 min-w-[60px]">
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                            <span>Err</span>
                                                            <span className="text-red-400">{job.failedCount}</span>
                                                        </div>
                                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-red-500 w-full" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {formatDate(job.createdAt)}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/jobs/${job.id}`}
                                                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-primary hover:border-primary/30 transition-all group/btn"
                                                >
                                                    <ArrowUpRight className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                                                </Link>
                                                <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:border-red-400/30 transition-all group/btn">
                                                    <Trash2 className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
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
        </div>
    );
}

