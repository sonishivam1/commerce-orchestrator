'use client';

import { useQuery } from '@apollo/client';
import {
    GET_MIGRATION_PROJECTS,
    GET_RECONCILIATION_REPORTS,
} from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';
import {
    BarChart3,
    Loader2,
    FolderKanban,
    CheckCircle2,
    ChevronRight,
    Calendar,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface MigrationProject {
    id: string;
    name: string;
    status: string;
}

interface EntitySummary {
    entityType: string;
    sourceCount: number;
    migratedCount: number;
    failedCount: number;
}

interface Report {
    id: string;
    migrationRunId: string;
    generatedAt: string;
    overallSuccessRate: number;
    entitySummaries: EntitySummary[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ pct }: { pct: number }) {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color =
        pct >= 95 ? '#10b981' :
        pct >= 80 ? '#f59e0b' :
        '#ef4444';

    return (
        <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
            <circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke={color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text
                x="36" y="40"
                textAnchor="middle"
                fill={color}
                fontSize="13"
                fontWeight="700"
                fontFamily="IBM Plex Mono, monospace"
            >
                {pct.toFixed(0)}%
            </text>
        </svg>
    );
}

function ProjectReportList({ project }: { project: MigrationProject }) {
    const { data, loading } = useQuery<{ reconciliationReports: Report[] }>(GET_RECONCILIATION_REPORTS, {
        variables: { migrationProjectId: project.id },
    });

    const reports = data?.reconciliationReports ?? [];

    if (loading) {
        return (
            <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                    <FolderKanban className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-300">{project.name}</span>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-3">
                    <FolderKanban className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-300">{project.name}</span>
                    <span className="text-xs text-slate-600 ml-auto">No completed runs yet</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <FolderKanban className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">{project.name}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-white/5">
                {reports.map(report => (
                    <Link
                        key={report.id}
                        href={`/reports/${report.migrationRunId}`}
                        className="group flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-all"
                    >
                        <ScoreRing pct={report.overallSuccessRate} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">
                                {report.overallSuccessRate >= 95 ? '✓ ' : ''}
                                {report.overallSuccessRate.toFixed(1)}% success rate
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-600">
                                <Calendar className="h-3 w-3" />
                                {new Date(report.generatedAt).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                                <span>·</span>
                                {report.entitySummaries.length} entity types
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-primary transition-colors" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReportsOverview() {
    const { data, loading, error } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
    );

    const projects = (data?.migrationProjects ?? []).filter(p => p.status !== 'ARCHIVED');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Reconciliation</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Post-migration reports comparing source and target data
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                    <p className="text-sm font-semibold text-white mb-1">Failed to load reports</p>
                    <p className="text-xs text-red-400">{error.message}</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-white/8 rounded-2xl gap-5">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                        <BarChart3 className="h-8 w-8 text-slate-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white">No reports yet</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Complete a migration run to generate a reconciliation report
                        </p>
                    </div>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-500 transition-all shadow-lg shadow-primary/20"
                    >
                        Go to Projects
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {projects.map(p => (
                        <ProjectReportList key={p.id} project={p} />
                    ))}
                </div>
            )}
        </div>
    );
}
