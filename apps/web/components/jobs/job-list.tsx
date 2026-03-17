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
    Zap,
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

/* ─── Status Badge ─────────────────────────────────────────── */
const STATUS_STYLE: Record<string, string> = {
    RUNNING: 'bg-[#b48600]/20 text-[#eab308] border border-[#b48600]/50',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    FAILED: 'bg-red-500/10 text-red-400 border border-red-500/30',
    PENDING: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    PAUSED: 'bg-slate-700/50 text-slate-300 border border-slate-600',
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
    return (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${style}`}>
            {status}
        </span>
    );
}

/* ─── Kind Badge ───────────────────────────────────────────── */
const KIND_STYLE: Record<string, string> = {
    CROSS_PLATFORM_MIGRATION: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    PLATFORM_CLONE: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
    SCRAPE_IMPORT: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
    EXPORT: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
};

function KindBadge({ kind }: { kind: string }) {
    const style = KIND_STYLE[kind] || 'bg-slate-800 text-slate-300 border border-slate-700';
    return (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${style}`}>
            {kind.replace(/_/g, '_')}
        </span>
    );
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ─── Metric Card ──────────────────────────────────────────── */
function MetricCard({
    title,
    value,
    icon,
    valueClass = 'text-white',
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    valueClass?: string;
}) {
    return (
        <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-5 flex flex-col gap-3 shadow">
            <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400 font-medium">{title}</span>
                <div className="h-7 w-7 flex items-center justify-center rounded-md bg-[#0F1626]/60 border border-slate-700/40">
                    {icon}
                </div>
            </div>
            <span className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value}</span>
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
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading jobs…
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-sm text-red-400">
                Failed to load jobs: {error.message}
            </div>
        );
    }

    const jobs = data?.jobs ?? [];
    const total = jobs.length;
    const running = jobs.filter(j => j.status === 'RUNNING').length;
    const completed = jobs.filter(j => j.status === 'COMPLETED').length;
    const failed = jobs.filter(j => j.status === 'FAILED').length;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-white">Jobs</h1>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search jobs..."
                            className="bg-[#1A233A] border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-60 transition-all"
                        />
                    </div>
                    <Link
                        href="/jobs/new"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all whitespace-nowrap shadow-[0_0_12px_rgba(79,149,255,0.35)]"
                    >
                        Create Job
                    </Link>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Jobs"
                    value={total}
                    icon={<RefreshCw className="h-4 w-4 text-blue-400" />}
                />
                <MetricCard
                    title="Running"
                    value={running}
                    icon={<Zap className="h-4 w-4 text-yellow-400" />}
                    valueClass="text-white"
                />
                <MetricCard
                    title="Completed"
                    value={completed}
                    icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
                    valueClass="text-white"
                />
                <MetricCard
                    title="Failed"
                    value={failed}
                    icon={<XCircle className="h-4 w-4 text-red-400" />}
                    valueClass="text-white"
                />
            </div>

            {/* Jobs Table */}
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden shadow">
                <div className="px-5 py-3.5 border-b border-slate-800/80">
                    <h2 className="text-sm font-semibold text-slate-200">Jobs</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1A253C]/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3.5">Job ID</th>
                                <th className="px-5 py-3.5">Kind</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Tenant</th>
                                <th className="px-5 py-3.5">Created At</th>
                                <th className="px-5 py-3.5">Processed</th>
                                <th className="px-5 py-3.5">Failed</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500 text-sm">
                                        No jobs found. Create your first data pipeline.
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-800/20 transition-colors group">
                                        <td className="px-5 py-3 font-mono text-xs text-slate-300">
                                            {job.id.substring(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <KindBadge kind={job.kind} />
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusBadge status={job.status} />
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-400">
                                            Tenant
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                                            {formatDate(job.createdAt)}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-mono text-slate-300">
                                            {job.processedCount}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-mono">
                                            <span className={job.failedCount > 0 ? 'text-red-400' : 'text-slate-500'}>
                                                {job.failedCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/jobs/${job.id}`}
                                                    className="p-1.5 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-primary transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Link>
                                                <button className="p-1.5 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button className="p-1.5 hover:bg-slate-700/50 rounded-md text-slate-400 transition-colors">
                                                    <ChevronDown className="h-3.5 w-3.5" />
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
