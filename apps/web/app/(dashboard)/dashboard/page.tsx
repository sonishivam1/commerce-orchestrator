'use client';

import { useQuery } from '@apollo/client';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import {
    Loader2,
    XCircle,
    FolderKanban,
    KeyRound,
    BarChart3,
    Layers,
    ArrowRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MigrationProject {
    id: string;
    name: string;
    entityTypes: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
}

interface Credential {
    id: string;
    platform: string;
    alias: string;
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const STATUS_STYLE: Record<string, string> = {
    ACTIVE:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    DRAFT:    'text-slate-400 bg-slate-700/30 border-slate-600/20',
    ARCHIVED: 'text-slate-500 bg-slate-800/50 border-slate-700/20',
};

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'text-purple-400 bg-purple-500/10',
    PRODUCTS:   'text-blue-400 bg-blue-500/10',
    CUSTOMERS:  'text-cyan-400 bg-cyan-500/10',
    ORDERS:     'text-amber-400 bg-amber-500/10',
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
}) {
    return (
        <div className="bg-[#131B2C]/70 border border-white/8 rounded-xl p-5 space-y-3 transition-all duration-200 hover:border-white/12">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
                <div className={cn('h-8 w-8 flex items-center justify-center rounded-lg border', accent)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="text-3xl font-bold font-mono text-white">{value}</p>
        </div>
    );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────

function QuickAction({
    href,
    icon: Icon,
    label,
    description,
    accent,
}: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    accent: string;
}) {
    return (
        <Link
            href={href}
            className="group bg-[#131B2C]/70 border border-white/8 rounded-xl p-5 flex items-center gap-4 hover:border-white/16 transition-all duration-200"
        >
            <div className={cn('h-10 w-10 flex items-center justify-center rounded-lg border shrink-0', accent)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 ml-auto shrink-0 transition-colors duration-200" />
        </Link>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const {
        data: projectsData,
        loading: projectsLoading,
        error: projectsError,
    } = useQuery<{ migrationProjects: MigrationProject[] }>(GET_MIGRATION_PROJECTS, {
        pollInterval: 10000,
    });

    const {
        data: credsData,
        loading: credsLoading,
    } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const projects    = projectsData?.migrationProjects ?? [];
    const credentials = credsData?.credentials ?? [];

    const nonArchived    = projects.filter(p => p.status !== 'ARCHIVED');
    const activeProjects = projects.filter(p => p.status === 'ACTIVE');
    const displayList    = nonArchived.slice(0, 8);

    const loading = projectsLoading || credsLoading;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Migration Overview</h1>
                <p className="text-sm text-slate-400 mt-1">Active projects and system status</p>
            </div>

            {/* Error */}
            {projectsError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                    <p className="text-sm text-red-400">{projectsError.message}</p>
                </div>
            )}

            {/* Stat row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {loading ? (
                    <>
                        {[0, 1, 2].map(i => (
                            <div key={i} className="bg-[#131B2C]/70 border border-white/8 rounded-xl p-5 h-24 animate-pulse" />
                        ))}
                    </>
                ) : (
                    <>
                        <StatCard
                            label="Total Projects"
                            value={nonArchived.length}
                            icon={FolderKanban}
                            accent="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                        />
                        <StatCard
                            label="Active Projects"
                            value={activeProjects.length}
                            icon={Layers}
                            accent="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        />
                        <StatCard
                            label="Connections"
                            value={credentials.length}
                            icon={KeyRound}
                            accent="text-blue-400 bg-blue-500/10 border-blue-500/20"
                        />
                    </>
                )}
            </div>

            {/* Projects list */}
            <div className="bg-[#131B2C]/70 border border-white/8 rounded-xl overflow-hidden">
                {/* Section header */}
                <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <FolderKanban className="h-4 w-4 text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-300">Projects</h2>
                    </div>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors duration-150"
                    >
                        View all <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {/* Loading skeleton */}
                {loading && (
                    <div className="divide-y divide-white/5">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                                <div className="h-4 w-48 bg-white/5 rounded" />
                                <div className="h-5 w-16 bg-white/5 rounded-lg ml-auto" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && displayList.length === 0 && (
                    <div className="py-16 flex flex-col items-center gap-3 opacity-40">
                        <FolderKanban className="h-10 w-10 text-slate-500" />
                        <p className="text-sm text-slate-400">No projects yet</p>
                        <Link
                            href="/projects/new"
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Create your first project
                        </Link>
                    </div>
                )}

                {/* Project rows */}
                {!loading && displayList.length > 0 && (
                    <div className="divide-y divide-white/5">
                        {displayList.map(project => {
                            const statusStyle = STATUS_STYLE[project.status] ?? STATUS_STYLE.DRAFT;
                            return (
                                <Link
                                    key={project.id}
                                    href={`/projects/${project.id}`}
                                    className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors duration-150 group"
                                >
                                    {/* Name */}
                                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors duration-150 min-w-0 truncate">
                                        {project.name}
                                    </p>

                                    {/* Entity chips */}
                                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                        {project.entityTypes.map(et => (
                                            <span
                                                key={et}
                                                className={cn(
                                                    'text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md',
                                                    ENTITY_COLOR[et] ?? 'text-slate-400 bg-slate-700/30',
                                                )}
                                            >
                                                {et}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Status badge */}
                                    <span
                                        className={cn(
                                            'ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border',
                                            statusStyle,
                                        )}
                                    >
                                        {project.status}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick actions */}
            <div>
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Quick Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QuickAction
                        href="/connections"
                        icon={KeyRound}
                        label="Add Connection"
                        description="Register a new platform credential"
                        accent="text-blue-400 bg-blue-500/10 border-blue-500/20"
                    />
                    <QuickAction
                        href="/projects/new"
                        icon={FolderKanban}
                        label="New Project"
                        description="Start a migration pipeline"
                        accent="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                    />
                    <QuickAction
                        href="/reports"
                        icon={BarChart3}
                        label="View Reports"
                        description="Reconciliation and audit logs"
                        accent="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    />
                </div>
            </div>
        </div>
    );
}
