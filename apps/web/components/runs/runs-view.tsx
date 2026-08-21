'use client';

import { useQuery } from '@apollo/client';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_MIGRATION_RUNS } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';
import {
    Loader2,
    Zap,
    ArrowRight,
    FolderKanban,
    CheckCircle2,
    XCircle,
    Clock,
    FlaskConical,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface MigrationProject {
    id: string;
    name: string;
    status: string;
}

interface WaveRecord {
    entityType: string;
    status: string;
    processedCount: number;
    failedCount: number;
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
    createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const WAVE_STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
    PENDING:   { text: 'text-slate-500',   bg: 'bg-slate-800/50',    border: 'border-slate-700/30'    },
    RUNNING:   { text: 'text-blue-400',    bg: 'bg-blue-500/10',     border: 'border-blue-500/20'     },
    COMPLETED: { text: 'text-emerald-400', bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20'  },
    FAILED:    { text: 'text-red-400',     bg: 'bg-red-500/10',      border: 'border-red-500/20'      },
    SKIPPED:   { text: 'text-slate-500',   bg: 'bg-slate-900/50',    border: 'border-slate-700/20'    },
};

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'text-purple-400',
    PRODUCTS:   'text-blue-400',
    CUSTOMERS:  'text-cyan-400',
    ORDERS:     'text-amber-400',
};

// ── Project-level run summary ─────────────────────────────────────────────────

function ProjectRunSummary({ project }: { project: MigrationProject }) {
    const { data, loading } = useQuery<{ migrationRuns: MigrationRun[] }>(GET_MIGRATION_RUNS, {
        variables: { migrationProjectId: project.id },
        pollInterval: 5000,
    });

    const runs = data?.migrationRuns ?? [];
    const activeRun = runs.find(r => r.status === 'RUNNING' || r.status === 'PENDING');
    const latestRun = runs[0];
    const displayRun = activeRun ?? latestRun;

    if (loading && runs.length === 0) {
        return (
            <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-5 flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-slate-500" />
                <span className="text-sm text-slate-400">{project.name}</span>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600 ml-auto" />
            </div>
        );
    }

    return (
        <Link
            href={displayRun ? `/runs/${displayRun.id}` : `/projects/${project.id}`}
            className="group bg-[#131B2C]/60 border border-white/8 hover:border-white/15 rounded-xl p-5 flex items-center gap-4 transition-all duration-200"
        >
            <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                <FolderKanban className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                {displayRun ? (
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span className={cn(
                            'font-semibold',
                            displayRun.status === 'RUNNING' ? 'text-blue-400' :
                            displayRun.status === 'COMPLETED' ? 'text-emerald-400' :
                            displayRun.status === 'FAILED' ? 'text-red-400' : 'text-slate-400',
                        )}>
                            {displayRun.status}
                        </span>
                        <span>·</span>
                        <span>{displayRun.waves.filter(w => w.status === 'COMPLETED').length}/{displayRun.waves.length} waves</span>
                        <span>·</span>
                        <span>{displayRun.processedCount} records</span>
                        {displayRun.dryRun && (
                            <span className="text-amber-500">· Dry Run</span>
                        )}
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-600 mt-1">No runs yet — start from Projects</p>
                )}
            </div>

            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-primary transition-colors shrink-0" />
        </Link>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function RunsView() {
    const { data, loading, error } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
        { pollInterval: 10000 },
    );

    const projects = (data?.migrationProjects ?? []).filter(p => p.status !== 'ARCHIVED');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Header */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Live Execution</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Active and recent migration runs across all projects
                    </p>
                </div>
                <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/8 transition-all"
                >
                    <FolderKanban className="h-4 w-4" /> All Projects
                </Link>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Polling every 5 seconds
            </div>

            {loading && projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-slate-500">Loading execution status…</span>
                </div>
            ) : error ? (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                    <p className="text-sm font-semibold text-white mb-1">Failed to load projects</p>
                    <p className="text-xs text-red-400">{error.message}</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/8 rounded-2xl gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                        <Zap className="h-8 w-8 text-slate-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white">No active projects</h3>
                        <p className="text-sm text-slate-500 mt-1">Create a project and start a run to see live execution here</p>
                    </div>
                    <Link
                        href="/projects/new"
                        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-500 transition-all shadow-lg shadow-primary/20"
                    >
                        Create Project
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map(p => (
                        <ProjectRunSummary key={p.id} project={p} />
                    ))}
                </div>
            )}

            {/* Legend */}
            {projects.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Categories', color: 'text-purple-400', dot: 'bg-purple-400' },
                        { label: 'Products',   color: 'text-blue-400',   dot: 'bg-blue-400'   },
                        { label: 'Customers',  color: 'text-cyan-400',   dot: 'bg-cyan-400'   },
                        { label: 'Orders',     color: 'text-amber-400',  dot: 'bg-amber-400'  },
                    ].map(({ label, color, dot }) => (
                        <div key={label} className="flex items-center gap-2 text-xs text-slate-500 bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                            <span className={`h-2 w-2 rounded-full ${dot}`} />
                            {label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
