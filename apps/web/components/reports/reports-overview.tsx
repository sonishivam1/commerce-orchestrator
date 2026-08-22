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
    const r = 24;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color = pct >= 95 ? 'var(--success)' : pct >= 80 ? 'var(--warning)' : 'var(--error)';

    return (
        <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border-color)" strokeWidth="4" />
            <circle
                cx="28" cy="28" r={r}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 28 28)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text
                x="28" y="32"
                textAnchor="middle"
                fill={color}
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-data)"
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
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-light)' }}>{project.name}</span>
                    <Loader2 className="animate-spin" style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-light)' }}>{project.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>No completed runs yet</span>
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <FolderKanban style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-light)' }}>{project.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {reports.length} report{reports.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div>
                <table className="proj-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', border: 'none' }}>
                    <tbody>
                        {reports.map(report => (
                            <tr key={report.id}>
                                <td style={{ width: '70px', padding: '12px 16px' }}>
                                    <ScoreRing pct={report.overallSuccessRate} />
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-light)' }}>
                                        {report.overallSuccessRate >= 95 ? '✓ ' : ''}
                                        {report.overallSuccessRate.toFixed(1)}% success rate
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        <Calendar style={{ width: '12px', height: '12px' }} />
                                        {new Date(report.generatedAt).toLocaleString('en-US', {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                        })}
                                        <span>·</span>
                                        {report.entitySummaries.length} entity types
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                                    <Link href={`/reports/${report.migrationRunId}`} className="btn btn-ghost btn-sm">
                                        View Report <ChevronRight style={{ width: '14px', height: '14px', marginLeft: '4px', verticalAlign: 'middle' }} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
        <div className="view active" id="view-reconciliation-list">
            <div className="section-header">
                <div>
                    <div className="section-title">Reconciliation</div>
                    <div className="section-sub">Post-migration reports comparing source and target data</div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 className="animate-spin" style={{ width: '24px', height: '24px', margin: '0 auto 12px' }} />
                    Loading projects...
                </div>
            ) : error ? (
                <div className="card" style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold', color: 'var(--error)' }}>Failed to load reports</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>{error.message}</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border-focus)' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <BarChart3 style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-light)' }}>No reports yet</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
                        Complete a migration run to generate a reconciliation report
                    </p>
                    <Link href="/projects" className="btn btn-primary">
                        Go to Projects
                    </Link>
                </div>
            ) : (
                <div>
                    {projects.map(p => (
                        <ProjectReportList key={p.id} project={p} />
                    ))}
                </div>
            )}
        </div>
    );
}
