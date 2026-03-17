'use client';

import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { Plus, Clock, CheckCircle, XCircle, Loader2, PauseCircle, Search, Eye, Trash2, ChevronDown } from 'lucide-react';

interface Job {
    id: string;
    kind: string;
    status: string;
    tenantId: string;
    createdAt: string;
    processedCount: number;
    failedCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    PENDING: {
        label: 'PENDING',
        icon: <Clock className="h-3 w-3" />,
        className: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    },
    RUNNING: {
        label: 'RUNNING',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: 'bg-[#b48600]/20 text-[#eab308] border border-[#b48600]/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]',
    },
    COMPLETED: {
        label: 'COMPLETED',
        icon: <CheckCircle className="h-3 w-3" />,
        className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
    },
    FAILED: {
        label: 'FAILED',
        icon: <XCircle className="h-3 w-3" />,
        className: 'bg-red-500/10 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]',
    },
    PAUSED: {
        label: 'PAUSED',
        icon: <PauseCircle className="h-3 w-3" />,
        className: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    },
};

const KIND_CONFIG: Record<string, string> = {
    CROSS_PLATFORM_MIGRATION: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    PLATFORM_CLONE: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    SCRAPE_IMPORT: 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]',
    EXPORT: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider ${config.className}`}>
            {config.label}
        </span>
    );
}

function KindBadge({ kind }: { kind: string }) {
    const style = KIND_CONFIG[kind] || 'bg-slate-800 text-slate-300 border border-slate-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${style}`}>
            {kind.replace(/_/g, ' ')}
        </span>
    );
}

function formatDate(iso: string) {
    const date = new Date(iso);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export function JobList() {
    const { data, loading, error } = useQuery<{ jobs: Job[] }>(GET_JOBS, {
        pollInterval: 10_000,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading metrics and pipelines...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-sm text-red-400 font-medium">
                Failed to load job telemetry: {error.message}
            </div>
        );
    }

    const jobs = data?.jobs ?? [];
    
    // Compute metrics
    const total = jobs.length;
    const running = jobs.filter(j => j.status === 'RUNNING').length;
    const completed = jobs.filter(j => j.status === 'COMPLETED').length;
    const failed = jobs.filter(j => j.status === 'FAILED').length;

    return (
        <div className="space-y-6 max-w-[1400px]">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-white">Jobs</h1>
                
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search jobs..." 
                            className="bg-[#1A233A] border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 transition-all shadow-inner"
                        />
                    </div>
                    <Link
                        href="/jobs/new"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all glow-btn shadow-[0_0_15px_rgba(79,149,255,0.4)] whitespace-nowrap"
                    >
                        Create Job
                    </Link>
                </div>
            </div>

            {/* Metric Cards - 4 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Jobs" value={total} colorClass="text-blue-400" borderClass="border-blue-500/30 border-l-2 border-l-blue-500" icon={<RefreshCw className="h-4 w-4 text-blue-400" />} />
                <MetricCard title="Running" value={running} colorClass="text-yellow-400" borderClass="border-yellow-500/30 border-l-2 border-l-yellow-500" icon={<Loader2 className="h-4 w-4 animate-spin text-yellow-500" />} />
                <MetricCard title="Completed" value={completed} colorClass="text-emerald-400" borderClass="border-emerald-500/30 border-l-2 border-l-emerald-500" icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} />
                <MetricCard title="Failed" value={failed} colorClass="text-red-400" borderClass="border-red-500/30 border-l-2 border-l-red-500" icon={<XCircle className="h-4 w-4 text-red-500" />} />
            </div>

            {/* Main Table */}
            <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
                <div className="px-5 py-4 border-b border-slate-800/80 bg-[#172136]">
                    <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Jobs Pipeline</h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1A253C]/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-4 font-semibold">Job ID</th>
                                <th className="px-5 py-4 font-semibold">Kind</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                <th className="px-5 py-4 font-semibold">Tenant</th>
                                <th className="px-5 py-4 font-semibold">Created At</th>
                                <th className="px-5 py-4 font-semibold">Processed/Failed</th>
                                <th className="px-5 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                                        No jobs found. Create your first data orchestrator pipeline.
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-800/20 transition-colors group">
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                                            {job.id.substring(0, 8)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <KindBadge kind={job.kind} />
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <StatusBadge status={job.status} />
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-400 text-xs font-medium">
                                            {job.tenantId.substring(0, 10)}...
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-400 font-mono tracking-tight">
                                            {formatDate(job.createdAt)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-4 text-xs font-mono">
                                                <span className="text-slate-300 w-8">{job.processedCount}</span>
                                                <span className="text-slate-600">|</span>
                                                <span className={job.failedCount > 0 ? "text-red-400" : "text-slate-500 w-8"}>
                                                    {job.failedCount}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/jobs/${job.id}`} className="p-1.5 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-primary transition-colors">
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                                <button className="p-1.5 hover:bg-red-500/10 rounded-md text-slate-400 hover:text-red-400 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <button className="p-1.5 hover:bg-slate-700/50 rounded-md text-slate-400 transition-colors ml-1">
                                                    <ChevronDown className="h-4 w-4" />
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

function MetricCard({ title, value, colorClass, borderClass, icon }: { title: string, value: number, colorClass: string, borderClass: string, icon: React.ReactNode }) {
    return (
        <div className={`bg-[#172136] rounded-xl p-5 border shadow-lg ${borderClass}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-400 tracking-wide">{title}</span>
                <div className={`p-1.5 rounded-md bg-[#0F1626]/50 border border-slate-700/30 ${colorClass}`}>
                    {icon}
                </div>
            </div>
            <div className={`text-4xl font-bold tracking-tight ${colorClass === 'text-blue-400' ? 'text-white' : colorClass}`}>
                {value}
            </div>
        </div>
    );
}
