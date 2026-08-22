'use client';

import { useQuery } from '@apollo/client';
import { GET_RECONCILIATION_REPORT } from '@/lib/graphql/queries/migration-project.queries';
import { GET_MIGRATION_RUN } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface EntitySummary {
    entityType: string;
    sourceCount: number;
    migratedCount: number;
    createdCount: number;
    updatedCount: number;
    failedCount: number;
    missingRefCount: number;
}

interface ReconciliationReport {
    id: string;
    migrationRunId: string;
    migrationProjectId: string;
    generatedAt: string;
    overallSuccessRate: number;
    entitySummaries: EntitySummary[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPlatformIcon(platform: string) {
    if (!platform) return '📦';
    const p = platform.toLowerCase();
    if (p.includes('commercetools')) return '📝';
    if (p.includes('shopify')) return '🛒';
    return '📦';
}

function getEntityIcon(et: string) {
    if (et === 'CATEGORIES') return '📂';
    if (et === 'PRODUCTS') return '📦';
    if (et === 'CUSTOMERS') return '👥';
    if (et === 'ORDERS') return '📄';
    return '📌';
}

function ScoreRing({ pct }: { pct: number }) {
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color = pct >= 95 ? 'var(--success)' : pct >= 80 ? 'var(--warning)' : 'var(--error)';

    return (
        <svg className="score-ring" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(52,211,153,0.1)" strokeWidth="8"/>
            <circle 
                cx="40" cy="40" r={r} 
                fill="none" 
                stroke={color} 
                strokeWidth="8"
                strokeDasharray={circ} 
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <text x="40" y="46" textAnchor="middle" fill={color} fontFamily="IBM Plex Mono,monospace" fontSize="15" fontWeight="500">
                {pct.toFixed(1)}%
            </text>
        </svg>
    );
}

function EntityRow({ summary }: { summary: EntitySummary }) {
    const successRate = summary.sourceCount > 0
        ? ((summary.migratedCount / summary.sourceCount) * 100).toFixed(1)
        : '—';

    return (
        <tr>
            <td>
                <span className="entity-icon">{getEntityIcon(summary.entityType)}</span> {summary.entityType}
            </td>
            <td>{summary.sourceCount.toLocaleString()}</td>
            <td>{summary.migratedCount.toLocaleString()}</td>
            <td className={summary.createdCount > 0 ? "ok-count" : ""}>{summary.createdCount.toLocaleString()}</td>
            <td className={summary.updatedCount > 0 ? "ok-count" : ""}>{summary.updatedCount.toLocaleString()}</td>
            <td className={summary.failedCount > 0 ? "fail-count" : ""}>{summary.failedCount.toLocaleString()}</td>
            <td className={summary.missingRefCount > 0 ? "warn-count" : ""}>{summary.missingRefCount.toLocaleString()}</td>
            <td>
                <span className="recon-mini-bar">
                    <span className="recon-mini-bar-fill" style={{ width: successRate === '—' ? '0%' : `${successRate}%` }}></span>
                </span>
                {successRate}{successRate !== '—' ? '%' : ''}
            </td>
        </tr>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReconciliationReport({ migrationRunId }: { migrationRunId: string }) {
    const { data: reportData, loading: reportLoading } = useQuery<{
        reconciliationReport: ReconciliationReport;
    }>(GET_RECONCILIATION_REPORT, { variables: { migrationRunId } });

    const { data: runData } = useQuery(GET_MIGRATION_RUN, {
        variables: { id: migrationRunId },
    });

    const report = reportData?.reconciliationReport;
    const run = runData?.migrationRun;

    if (reportLoading) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading report...</div>;
    }

    if (!report) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p>No report available.</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {run?.status === 'RUNNING' || run?.status === 'PENDING'
                        ? 'The migration is still in progress.'
                        : 'A reconciliation report is generated automatically when a migration run completes.'}
                </p>
                <Link href={`/runs/${migrationRunId}`} className="btn btn-ghost" style={{ marginTop: '20px' }}>
                    Back to Run
                </Link>
            </div>
        );
    }

    const generatedAt = new Date(report.generatedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const totalMigrated = report.entitySummaries.reduce((acc, s) => acc + s.migratedCount, 0);
    const totalFailed = report.entitySummaries.reduce((acc, s) => acc + s.failedCount, 0);
    const totalMissing = report.entitySummaries.reduce((acc, s) => acc + s.missingRefCount, 0);

    return (
        <div className="view" id="view-reconciliation">
            <div style={{ marginBottom: '20px' }}>
                <Link href={`/runs/${migrationRunId}`} className="btn btn-ghost btn-sm">
                    ‹ Back to Run
                </Link>
            </div>

            <div className="section-header">
                <div>
                    <div className="section-title">Reconciliation Report</div>
                    <div className="section-sub">Report generated {generatedAt}</div>
                </div>
            </div>

            <div className="recon-header">
                <div className="recon-score-card">
                    <ScoreRing pct={report.overallSuccessRate} />
                    <div>
                        <div className="score-value">{report.overallSuccessRate.toFixed(1)}%</div>
                        <div className="score-label">Overall migration success rate</div>
                        <div className="score-note">
                            {totalFailed.toLocaleString()} failed &middot; {totalMissing.toLocaleString()} missing references &middot; {totalMigrated.toLocaleString()} successful
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <span className="pill pill-success">✓ Reconciled</span>
                    </div>
                </div>
            </div>

            <div className="recon-table-wrap">
                <table className="recon-table">
                    <thead>
                        <tr>
                            <th>Entity</th>
                            <th>Source</th>
                            <th>Migrated</th>
                            <th>Created</th>
                            <th>Updated</th>
                            <th>Failed</th>
                            <th>Missing Refs</th>
                            <th>Coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.entitySummaries.map(s => (
                            <EntityRow key={s.entityType} summary={s} />
                        ))}
                    </tbody>
                </table>
            </div>

            {totalFailed > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <div className="card card-sm">
                        <div className="card-title" style={{ fontSize: '13px' }}>Action Required</div>
                        <div className="activity-line">
                            <span className="activity-dot" style={{ background: 'var(--error)' }}></span>
                            <span className="activity-text"><strong>{totalFailed.toLocaleString()} items failed</strong> and are in the Dead Letter Queue.</span>
                        </div>
                        <Link href="/dlq" className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }}>
                            View Dead Letter Queue →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
