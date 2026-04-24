'use client';

import { useQuery, useMutation } from '@apollo/client';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { REPLAY_JOB } from '@/lib/graphql/mutations';
import { 
    Loader2, 
    RotateCcw, 
    AlertCircle, 
    Bug, 
    Layers, 
    Zap, 
    Trash2, 
    Play, 
    ChevronDown, 
    ArrowUpRight,
    Filter,
    Search,
    RefreshCw,
    XCircle,
    Database,
    CloudOff,
    CheckCircle2
} from 'lucide-react';

interface Job {
    id: string;
    kind: string;
    status: string;
    failedCount: number;
}

interface DlqItem {
    id: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload?: string;
    jobId?: string;
}

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Error Type Badge ─────────────────────────────────────── */
const ERROR_TYPE_STYLE: Record<string, { bg: string, text: string, border: string }> = {
    ERR_CANONICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    ERR_PLATFORM: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    ERR_EXTERNAL: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
    TRANSIENT: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    FATAL: { bg: 'bg-red-700/10', text: 'text-red-500', border: 'border-red-700/20' },
};

function ErrorTypeBadge({ type }: { type: string }) {
    const style = ERROR_TYPE_STYLE[type] ?? ERROR_TYPE_STYLE.TRANSIENT;
    return (
        <span className={cn(
            "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black tracking-widest uppercase border",
            style.bg, style.text, style.border
        )}>
            {type.replace(/_/g, ' ')}
        </span>
    );
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
            "bg-[#1E293B]/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] border-t-2 shadow-2xl relative",
            themes[color]
        )}>
            <div className="flex items-center gap-3 mb-4">
                <div className={cn("h-10 w-10 flex items-center justify-center rounded-xl border shrink-0", iconColors[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tighter text-white">{value}</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">EVENTS</span>
            </div>
        </div>
    );
}

/* ─── DLQ Table Section ─────────────────────────────────── */
function DlqTableSection({ jobs, onReplay, replaying }: {
    jobs: Job[];
    onReplay: (jobId: string, dlqItemId: string) => void;
    replaying: boolean;
}) {
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.failedCount > 0);
    const selectedJob = failedJobs[0];

    return (
        <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-primary" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">DLQ Snapshot</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selected Context:</span>
                    <span className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                        {selectedJob ? `Job ${selectedJob.id.substring(0, 8).toUpperCase()}` : 'Global Mesh'}
                    </span>
                </div>
            </div>

            {selectedJob ? (
                <DlqJobItems job={selectedJob} onReplay={onReplay} replaying={replaying} />
            ) : (
                <div className="py-32 text-center opacity-30">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" />
                    <p className="text-sm font-black tracking-[0.3em] uppercase text-slate-400">Mesh Health Optimized</p>
                </div>
            )}
        </div>
    );
}

function DlqJobItems({ job, onReplay, replaying }: {
    job: Job;
    onReplay: (jobId: string, dlqItemId: string) => void;
    replaying: boolean;
}) {
    const { data, loading } = useQuery<{ dlqItems: DlqItem[] }>(GET_DLQ_ITEMS, {
        variables: { jobId: job.id },
    });

    const items = data?.dlqItems ?? [];

    if (loading) {
        return (
            <div className="py-40 flex flex-col items-center gap-4 opacity-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">Indexing Rejects...</span>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white/[0.01]">
                    <tr>
                        <th className="px-8 py-5">Correlation Key</th>
                        <th className="px-6 py-5">Source Node</th>
                        <th className="px-6 py-5">Fault Type</th>
                        <th className="px-6 py-5">Status Log</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center text-slate-500">
                                No entries present in current buffer.
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />
                                        <span className="font-mono text-xs text-slate-300">{item.itemKey}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[11px] font-black text-primary px-2 py-0.5 bg-primary/10 rounded-md uppercase tracking-tighter">
                                        JOB-{job.id.substring(0, 4).toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <ErrorTypeBadge type={item.errorType === 'VALIDATION' ? 'ERR_CANONICAL' : item.errorType} />
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-xs text-slate-400 max-w-[300px] truncate group-hover:text-slate-200 transition-colors">
                                        {item.errorMessage}
                                    </p>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-primary transition-all group/btn">
                                            <ArrowUpRight className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                                        </button>
                                        <button
                                            disabled={replaying || item.errorType === 'FATAL'}
                                            onClick={() => onReplay(job.id, item.id)}
                                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary/20 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-30 group/btn"
                                        >
                                            <Play className="h-3.5 w-3.5 fill-current group-hover/btn:scale-110 transition-transform" />
                                        </button>
                                        <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 transition-all group/btn">
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
    );
}

/* ─── Main DLQ Page ────────────────────────────────────────── */
export default function DlqPage() {
    const { data: jobsData, loading: jobsLoading } = useQuery<{ jobs: Job[] }>(GET_JOBS, {
        pollInterval: 15_000,
    });

    const [replayItem, { loading: replaying }] = useMutation(REPLAY_JOB);

    const jobs = jobsData?.jobs ?? [];
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.failedCount > 0);
    const totalFailedItems = failedJobs.reduce((acc, j) => acc + (j.failedCount ?? 0), 0);

    const handleReplay = (jobId: string, dlqItemId: string) => {
        replayItem({ variables: { jobId, dlqItemId } });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Header */}
            <div>
                <nav className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors">Orchestrator</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">Fault Detection (DLQ)</span>
                </nav>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Dead Letter Queue</h1>
                        <p className="text-sm font-medium text-slate-400">Investigate and resolve operational faults within the mesh</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search trace..."
                                className="bg-[#1E293B]/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-64 transition-all"
                            />
                        </div>
                        <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all">
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="DLQ Depth"
                    value={totalFailedItems}
                    icon={AlertCircle}
                    color="red"
                />
                <MetricCard
                    title="Processing Errors"
                    value={Math.floor(totalFailedItems * 0.7)}
                    icon={XCircle}
                    color="red"
                />
                <MetricCard
                    title="Warning Events"
                    value={Math.floor(totalFailedItems * 0.3)}
                    icon={Zap}
                    color="amber"
                />
                <MetricCard
                    title="Operational Jobs"
                    value={jobs.length - failedJobs.length}
                    icon={Database}
                    color="blue"
                />
            </div>

            {/* Items Table */}
            {jobsLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-40">Polling Fault Buffers...</span>
                </div>
            ) : (
                <DlqTableSection jobs={jobs} onReplay={handleReplay} replaying={replaying} />
            )}

            {/* Global Actions */}
            <div className="flex items-center gap-4 pt-4">
                <button className="flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95">
                    <RotateCcw className="h-4 w-4 stroke-[3]" />
                    Purge & Retry Transient
                </button>
                <div className="flex items-center gap-3 text-slate-500 ml-auto">
                    <CloudOff className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Mesh Isolation Active</span>
                </div>
            </div>
        </div>
    );
}

