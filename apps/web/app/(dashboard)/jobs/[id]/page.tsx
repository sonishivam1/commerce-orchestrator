'use client';

import { useQuery } from '@apollo/client';
import { GET_JOB } from '@/lib/graphql/queries/job.queries';
import { DlqTable } from '@/components/shared/dlq-table';
import Link from 'next/link';
import {
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    PauseCircle,
    Copy,
    CheckCircle2
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

const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-slate-700/50 text-slate-300 border border-slate-600',
    RUNNING: 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    COMPLETED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    FAILED: 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    PAUSED: 'bg-slate-700/50 text-slate-300 border border-slate-600',
};

function formatDate(iso: string) {
    const date = new Date(iso);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
    const { data, loading, error } = useQuery<{ job: Job }>(GET_JOB, {
        variables: { id: params.id },
        pollInterval: 5_000,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-slate-400 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" /> Loading pipeline telemetry…
            </div>
        );
    }

    if (error || !data?.job) {
        return (
            <div className="max-w-4xl mx-auto mt-10">
                <Link href="/jobs" className="text-slate-400 hover:text-white transition-colors mb-6 inline-block">
                    ← Back to Jobs
                </Link>
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-sm text-red-400">
                    {error?.message ?? 'Job not found'}
                </div>
            </div>
        );
    }

    const job = data.job;
    const total = job.processedCount + job.failedCount;
    // For visual purpose: if no total yet we show 0, if total > 0 we calc
    const percentage = total > 0 ? ((job.processedCount / total) * 100).toFixed(0) : 0;
    
    // Fake duration calculation based on created/completed
    const start = new Date(job.createdAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const durationSec = Math.floor((end - start) / 1000);
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    const formattedDuration = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Breadcrumb / Top */}
            <div className="flex items-center gap-2 text-sm text-slate-400 font-medium tracking-wide">
                <Link href="/jobs" className="hover:text-primary transition-colors">Jobs</Link>
                <span>/</span>
                <span className="text-slate-200">JOB-{job.id.substring(0, 8)}</span>
            </div>

            {/* Header Title Area */}
            <div>
                <p className="text-sm font-medium text-slate-400 mb-1 tracking-wide">Commerce Data Orchestrator</p>
                <div className="flex flex-wrap items-center gap-4">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        {job.kind}
                    </h1>
                    <span className={`px-3 py-1 rounded-md text-xs font-bold tracking-widest ${STATUS_BADGE[job.status] || ''}`}>
                        {job.status}
                    </span>
                    <span className="text-slate-400 text-sm ml-auto">
                        Started {formatDate(job.createdAt)}
                    </span>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#172136] rounded-xl p-6 border-t-[3px] border-[#172136] border-t-primary shadow-lg relative overflow-hidden">
                    <p className="text-sm font-medium text-slate-400 mb-2">Processed</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white tracking-tight">{job.processedCount.toLocaleString()}</span>
                        <span className="text-sm text-slate-500">items</span>
                    </div>
                </div>

                <div className={`bg-[#172136] rounded-xl p-6 shadow-lg border-t-[3px] border-[#172136] ${job.failedCount > 0 ? 'border-t-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-t-slate-700'}`}>
                    <p className={`text-sm font-medium mb-2 ${job.failedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>Failed</p>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold tracking-tight ${job.failedCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>{job.failedCount.toLocaleString()}</span>
                        <span className="text-sm text-slate-500">items</span>
                    </div>
                </div>

                <div className="bg-[#172136] rounded-xl p-6 border border-slate-800 shadow-lg">
                    <p className="text-sm font-medium text-slate-400 mb-2">Duration</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white tracking-tight font-mono">{formattedDuration}</span>
                    </div>
                </div>

                <div className="bg-[#172136] rounded-xl p-6 border border-slate-800 shadow-lg">
                    <p className="text-sm font-medium text-slate-400 mb-2">Trace ID</p>
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-mono text-slate-300 truncate tracking-tight">{job.traceId || `tr-${job.id.substring(0,8)}`}</span>
                        {job.traceId && <Copy className="h-4 w-4 text-slate-500 hover:text-white cursor-pointer" />}
                    </div>
                </div>
            </div>

            {/* Large Progress Bar Section */}
            {(total > 0 || job.status === 'RUNNING') && (
                <div className="bg-[#131B2C] rounded-xl p-6 border border-slate-800 shadow-xl">
                    <div className="h-4 w-full bg-[#0F1626] rounded-full overflow-hidden border border-slate-800 relative z-0">
                        <div 
                            className={`h-full relative z-10 transition-all duration-1000 ease-out ${job.status === 'FAILED' ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ 
                                width: `${Math.max(percentage as number, 5)}%`,
                                backgroundImage: job.status === 'RUNNING' ? 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)' : 'none',
                                backgroundSize: '1rem 1rem'
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-3 text-sm font-medium">
                        <span className="text-slate-400 tabular-nums">{job.processedCount} / {total || '???'} records</span>
                        <span className="text-primary glow-text tabular-nums">{percentage}%</span>
                    </div>
                </div>
            )}

            {/* Grid for Steps & Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#172136] rounded-xl border border-slate-800 p-6 shadow-lg h-80">
                    <h3 className="text-lg font-semibold text-white mb-6">Pipeline Steps</h3>
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-slate-700 before:to-slate-800">
                        {['Extract', 'Normalize', 'Map', 'Validate', 'Deploy'].map((step, i) => {
                            const isDone = i < 3;
                            const isActive = i === 3 && job.status === 'RUNNING';
                            return (
                                <div key={step} className="relative flex items-center gap-4 pl-10 md:pl-0">
                                    <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full border-2 bg-[#172136] z-10 
                                        {isDone ? 'border-emerald-500' : isActive ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'border-slate-700'}"
                                    >
                                        {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                    </div>
                                    <div className={`md:w-1/2 ${i % 2 === 0 ? 'md:pr-10 md:text-right md:ml-0' : 'md:pl-10 md:-ml-0 md:text-left'} text-sm font-medium ${isDone ? 'text-white' : isActive ? 'text-amber-400' : 'text-slate-500'}`}>
                                        {step}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="bg-[#172136] rounded-xl border border-slate-800 p-6 shadow-lg h-80 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-white mb-6">Recent Events</h3>
                    <div className="space-y-5">
                        <div className="relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-slate-500">
                            <p className="text-sm font-medium text-slate-300">Job Initialized</p>
                            <span className="text-xs text-slate-500">System • {formatDate(job.createdAt)}</span>
                        </div>
                        {job.status === 'RUNNING' && (
                            <div className="relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-primary">
                                <p className="text-sm font-medium text-white">Extracting records...</p>
                                <span className="text-xs text-slate-500">Extractor • Just now</span>
                            </div>
                        )}
                        {job.status === 'COMPLETED' && (
                            <div className="relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500">
                                <p className="text-sm font-medium text-emerald-400">Migration Successful</p>
                                <span className="text-xs text-slate-500">Engine • {job.completedAt ? formatDate(job.completedAt) : 'Just now'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DLQ Area */}
            <div className="pt-4">
                <h2 className="text-xl font-semibold text-white mb-4">Failed Items ({job.failedCount})</h2>
                <div className="bg-[#131B2C] rounded-xl border border-slate-800 shadow-2xl p-1">
                    <DlqTable jobId={job.id} />
                </div>
            </div>
            
        </div>
    );
}
