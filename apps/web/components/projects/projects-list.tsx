'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { ARCHIVE_MIGRATION_PROJECT } from '@/lib/graphql/mutations';
import Link from 'next/link';
import {
    Plus,
    Loader2,
    FolderKanban,
    Archive,
    ChevronRight,
    Calendar,
    ArrowRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface MigrationProject {
    id: string;
    name: string;
    sourceConnectionId: string;
    targetConnectionId: string;
    entityTypes: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
    DRAFT:    { bg: 'bg-slate-700/30',    text: 'text-slate-400',    border: 'border-slate-600/30'    },
    ACTIVE:   { bg: 'bg-emerald-500/10',  text: 'text-emerald-400',  border: 'border-emerald-500/20'  },
    ARCHIVED: { bg: 'bg-slate-800/50',    text: 'text-slate-500',    border: 'border-slate-700/20'    },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT;
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border',
            s.bg, s.text, s.border,
        )}>
            {status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {status}
        </span>
    );
}

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
    PRODUCTS:   'bg-blue-500/15   text-blue-300   border-blue-500/20',
    CUSTOMERS:  'bg-cyan-500/15   text-cyan-300   border-cyan-500/20',
    ORDERS:     'bg-amber-500/15  text-amber-300  border-amber-500/20',
};

function EntityChip({ type }: { type: string }) {
    return (
        <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-widest border',
            ENTITY_COLOR[type] ?? 'bg-slate-700/30 text-slate-400 border-slate-600/20',
        )}>
            {type}
        </span>
    );
}

// ── Project Row ──────────────────────────────────────────────────────────────

function ProjectRow({
    project,
    onArchive,
}: {
    project: MigrationProject;
    onArchive: (id: string) => void;
}) {
    const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
    const updatedDate = new Date(project.updatedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
    });

    return (
        <div className="group bg-[#131B2C]/60 border border-white/5 hover:border-white/12 rounded-xl p-5 flex items-center gap-5 transition-all duration-200">
            {/* Icon */}
            <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                <FolderKanban className="h-5 w-5 text-slate-400" />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                    <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                    <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1">
                        {project.entityTypes.map(et => <EntityChip key={et} type={et} />)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                        <Calendar className="h-3 w-3" />
                        <span>Created {createdDate}</span>
                        <span className="mx-1">·</span>
                        <span>Updated {updatedDate}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                {project.status !== 'ARCHIVED' && (
                    <button
                        onClick={() => onArchive(project.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-slate-500 hover:text-amber-400 hover:border-amber-500/20 transition-all cursor-pointer"
                        title="Archive project"
                    >
                        <Archive className="h-3.5 w-3.5" />
                    </button>
                )}
                <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
                >
                    View <ChevronRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ProjectsList() {
    const { data, loading, error } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
        { pollInterval: 10000 },
    );

    const [archiveProject] = useMutation(ARCHIVE_MIGRATION_PROJECT, {
        refetchQueries: [GET_MIGRATION_PROJECTS],
    });

    const handleArchive = (id: string) => {
        if (confirm('Archive this project? All runs are preserved but no new runs can be started.')) {
            archiveProject({ variables: { id } });
        }
    };

    const projects = data?.migrationProjects ?? [];
    const activeProjects   = projects.filter(p => p.status !== 'ARCHIVED');
    const archivedProjects = projects.filter(p => p.status === 'ARCHIVED');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Header */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Projects</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Migration projects define source → target connections and entity scope
                    </p>
                </div>
                <Link
                    href="/projects/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="h-4 w-4" /> New Project
                </Link>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-slate-500">Loading projects…</span>
                </div>
            ) : error ? (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                    <p className="text-sm font-semibold text-white mb-1">Failed to load projects</p>
                    <p className="text-xs text-red-400">{error.message}</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-white/5 rounded-2xl gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                        <FolderKanban className="h-8 w-8 text-slate-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white">No projects yet</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Create a project to define a source → target migration scope
                        </p>
                    </div>
                    <Link
                        href="/projects/new"
                        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-500 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="h-4 w-4" /> Create First Project
                    </Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Active projects */}
                    {activeProjects.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                    Active · {activeProjects.length}
                                </h2>
                            </div>
                            <div className="space-y-2">
                                {activeProjects.map(p => (
                                    <ProjectRow key={p.id} project={p} onArchive={handleArchive} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Archived projects */}
                    {archivedProjects.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
                                Archived · {archivedProjects.length}
                            </h2>
                            <div className="space-y-2 opacity-60">
                                {archivedProjects.map(p => (
                                    <ProjectRow key={p.id} project={p} onArchive={handleArchive} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick link to runs */}
            {projects.length > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-white">Ready to migrate?</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Open a project and start a migration run to begin data transfer.
                        </p>
                    </div>
                    <Link
                        href="/runs"
                        className="inline-flex items-center gap-2 text-primary text-xs font-semibold hover:underline shrink-0"
                    >
                        View Live Executions <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}
