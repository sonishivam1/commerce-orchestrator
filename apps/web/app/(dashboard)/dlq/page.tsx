'use client';

import { useQuery, useMutation } from '@apollo/client';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { REPLAY_JOB } from '@/lib/graphql/mutations';
import { Loader2, RotateCcw } from 'lucide-react';

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

/* ─── Error Type Badge ─────────────────────────────────────── */
const ERROR_TYPE_STYLE: Record<string, string> = {
    TRANSIENT: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    FATAL: 'bg-red-600/20 text-red-400 border border-red-600/30',
    VALIDATION: 'bg-red-500/15 text-red-400 border border-red-500/25',
    VALIDATION_ERROR: 'bg-red-500/15 text-red-400 border border-red-500/25',
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

function formatTimestamp(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
        + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ─── DLQ All Items (across all jobs) ─────────────────────── */
function DlqAllTable({ jobs, onReplay, replaying }: {
    jobs: Job[];
    onReplay: (jobId: string, dlqItemId: string) => void;
    replaying: boolean;
}) {
    // We need to gather DLQ items for each failed job
    // Since API only supports per-job queries, we use the first failed job or pass all
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.failedCount > 0);

    if (failedJobs.length === 0) {
        return (
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden">
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                    No failed items found.
                </div>
            </div>
        );
    }

    return <DlqJobItems job={failedJobs[0]} onReplay={onReplay} replaying={replaying} />;
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
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading failed items...
            </div>
        );
    }

    return (
        <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#1A253C]/40 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
                        <tr>
                            <th className="px-5 py-3.5">Item Key</th>
                            <th className="px-5 py-3.5">Job ID</th>
                            <th className="px-5 py-3.5">Error Type</th>
                            <th className="px-5 py-3.5">Error Message</th>
                            <th className="px-5 py-3.5">Timestamp</th>
                            <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                                    No failed items in this job.
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{item.itemKey}</td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-xs text-primary font-medium hover:underline cursor-pointer">
                                            Job ID {job.id.substring(0, 4).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <ErrorTypeBadge type={item.errorType} />
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-400 max-w-[220px] truncate">
                                        {item.errorMessage}
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                                        {/* Use job's createdAt as approximation since dlqItem may not have timestamp */}
                                        —
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className="text-xs font-medium text-slate-400 hover:text-white transition-colors bg-[#1E293B] hover:bg-slate-700/60 border border-slate-700/40 px-3 py-1.5 rounded-lg">
                                                View Item
                                            </button>
                                            <button
                                                disabled={replaying || item.errorType === 'FATAL'}
                                                onClick={() => onReplay(job.id, item.id)}
                                                className="text-xs font-medium text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                {replaying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Replay'}
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Dead Letter Queue</h1>
                <p className="text-sm text-slate-400 mt-1">Failed items awaiting manual review or replay</p>
            </div>

            {/* Stats Card */}
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Stats</p>
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-amber-400">{totalFailedItems}</span>
                </div>
            </div>

            {/* Failed Items Section */}
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Failed items</p>
                    <div className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-amber-400">{totalFailedItems}</span>
                    </div>
                </div>

                {jobsLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                ) : (
                    <DlqAllTable jobs={jobs} onReplay={handleReplay} replaying={replaying} />
                )}
            </div>

            {/* Replay All Transient Button */}
            <button className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-semibold text-sm px-5 py-2.5 rounded-lg transition-all">
                <RotateCcw className="h-4 w-4" />
                Replay All TRANSIENT Errors
            </button>
        </div>
    );
}
