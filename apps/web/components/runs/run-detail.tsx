'use client';

import { useQuery } from '@apollo/client';
import {
    GET_MIGRATION_RUN,
    GET_MIGRATION_PROJECT,
    GET_RECONCILIATION_REPORT,
} from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import { ShoppingCart, FileText, Package, AlertCircle, Clock } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface WaveRecord {
    entityType: string;
    status: string;
    processedCount: number;
    failedCount: number;
    startedAt?: string;
    completedAt?: string;
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
    completedAt?: string;
    correlationId?: string;
    createdAt: string;
}

interface MigrationProject {
    id: string;
    name: string;
    sourceConnectionId: string;
    targetConnectionId: string;
    entityTypes: string[];
}

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PlatformIcon({ platform }: { platform: string }) {
    const p = (platform ?? '').toLowerCase();
    if (p.includes('commercetools')) return <FileText style={{ width: 20, height: 20, color: 'var(--accent)' }} />;
    if (p.includes('shopify')) return <ShoppingCart style={{ width: 20, height: 20, color: 'var(--accent)' }} />;
    return <Package style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />;
}

function WaveCard({ wave, index, isLast }: { wave: WaveRecord; index: number; isLast: boolean }) {
    const total = wave.processedCount + wave.failedCount;
    const progressPct = wave.status === 'COMPLETED' ? 100
        : wave.status === 'RUNNING' ? (total > 0 ? 50 : 10)
        : 0;

    let stateClass = '';
    let pillClass = 'pill-muted';
    let pillText = 'Waiting';
    let fillClass = '';
    let numContent: React.ReactNode = String(index);

    if (wave.status === 'COMPLETED') {
        stateClass = 'wave-done';
        pillClass = 'pill-success';
        pillText = 'Complete';
        fillClass = 'done';
        numContent = '✓';
    } else if (wave.status === 'RUNNING') {
        stateClass = 'wave-running';
        pillClass = 'pill-accent';
        pillText = 'Running';
        fillClass = 'running';
    } else if (wave.status === 'FAILED') {
        stateClass = 'wave-failed';
        pillClass = 'pill-error';
        pillText = 'Failed';
        fillClass = 'failed';
    }

    return (
        <>
            <div className={`wave-item ${stateClass}`} style={wave.status === 'PENDING' ? { opacity: 0.6 } : {}}>
                <div className="wave-row">
                    <div className={`wave-num ${fillClass}`}>{numContent}</div>
                    <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>
                            Wave {index}
                        </div>
                        <div className="wave-entity">{wave.entityType}</div>
                    </div>
                    <div className="wave-counts">
                        {wave.processedCount.toLocaleString()}
                        {wave.failedCount > 0 ? ` (+${wave.failedCount} err)` : ''}
                    </div>
                    <span className={`pill ${pillClass}`} style={{ marginLeft: '8px' }}>
                        {wave.status === 'RUNNING' && <span className="dot dot-pulse" />} {pillText}
                    </span>
                </div>

                <div className="wave-bar-track" style={wave.status !== 'PENDING' ? { marginTop: '12px' } : {}}>
                    <div
                        className={`wave-bar-fill ${fillClass}`}
                        style={{ width: `${progressPct}%`, background: wave.status === 'PENDING' ? 'var(--text-dim)' : undefined }}
                    />
                </div>

                {wave.status === 'RUNNING' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Processing items…
                        </span>
                    </div>
                )}
            </div>

            {!isLast && (
                <div className="wave-connector">
                    <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 auto', position: 'relative' }}>
                        <div style={{ position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)', color: 'var(--text-dim)', fontSize: '9px' }}>▼</div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function RunDetail({ runId }: { runId: string }) {
    const { data: runData, loading: runLoading } = useQuery<{ migrationRun: MigrationRun }>(
        GET_MIGRATION_RUN,
        { variables: { id: runId }, pollInterval: 3000 },
    );

    const run = runData?.migrationRun;

    const { data: projectData } = useQuery<{ migrationProject: MigrationProject }>(
        GET_MIGRATION_PROJECT,
        { variables: { id: run?.migrationProjectId }, skip: !run?.migrationProjectId },
    );

    const { data: credsData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const { data: reportData } = useQuery(GET_RECONCILIATION_REPORT, {
        variables: { migrationRunId: runId },
        skip: run?.status !== 'COMPLETED',
    });

    const project = projectData?.migrationProject;
    const credentials = credsData?.credentials ?? [];
    const report = reportData?.reconciliationReport;

    // Resolve connection IDs to platform/alias from the credentials list
    const findCred = (id?: string) => credentials.find(c => c.id === id);
    const sourceCred = findCred(project?.sourceConnectionId);
    const targetCred = findCred(project?.targetConnectionId);

    if (runLoading && !run) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading run…</div>;
    }

    if (!run) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p>Run not found</p>
                <Link href="/projects" className="btn btn-ghost" style={{ marginTop: '20px' }}>Back to Projects</Link>
            </div>
        );
    }

    const duration = run.startedAt && run.completedAt
        ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
        : run.startedAt ? 'Running…' : '—';

    const totalItems = run.processedCount + run.failedCount;
    const runningWave = run.waves.find(w => w.status === 'RUNNING');
    const currentWaveIndex = runningWave ? run.waves.indexOf(runningWave) + 1 : null;

    return (
        <div className="view" id="view-migration">

            <div style={{ marginBottom: '20px' }}>
                <Link href={project ? `/projects/${project.id}` : '/projects'} className="btn btn-ghost btn-sm">
                    ‹ Back
                </Link>
            </div>

            {/* PENDING banner — shown when run hasn't started yet */}
            {run.status === 'PENDING' && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    borderRadius: '10px',
                    background: 'rgba(255,170,0,0.08)',
                    border: '1px solid rgba(255,170,0,0.25)',
                    color: 'var(--warning)',
                    fontSize: '13px',
                }}>
                    <Clock size={16} style={{ flexShrink: 0 }} />
                    <span>
                        <strong>Run is queued.</strong> The ETL worker must be running to process this migration.
                        Start it with: <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>pnpm --filter @cdo/worker-etl run dev</code>
                    </span>
                </div>
            )}

            {/* FAILED banner with DLQ link */}
            {run.status === 'FAILED' && run.failedCount > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    borderRadius: '10px',
                    background: 'rgba(255,60,60,0.08)',
                    border: '1px solid rgba(255,60,60,0.25)',
                    color: 'var(--error)',
                    fontSize: '13px',
                }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>
                        {run.failedCount} item(s) failed.{' '}
                        <Link href="/dlq" style={{ color: 'var(--error)', textDecoration: 'underline' }}>
                            View Dead Letter Queue
                        </Link>{' '}
                        to inspect and replay errors.
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="migration-header">
                <div className="mig-platform">
                    <div className="mig-logo">
                        <PlatformIcon platform={sourceCred?.platform ?? ''} />
                    </div>
                    <div className="mig-info">
                        <div className="mig-platform-name">{sourceCred?.platform ?? 'Source'}</div>
                        <div className="mig-platform-alias">{sourceCred?.alias ?? project?.sourceConnectionId ?? '—'}</div>
                    </div>
                </div>
                <div className="mig-arrow-big">→</div>
                <div className="mig-platform">
                    <div className="mig-logo">
                        <PlatformIcon platform={targetCred?.platform ?? ''} />
                    </div>
                    <div className="mig-info">
                        <div className="mig-platform-name">{targetCred?.platform ?? 'Target'}</div>
                        <div className="mig-platform-alias">{targetCred?.alias ?? project?.targetConnectionId ?? '—'}</div>
                    </div>
                </div>
                <div style={{ marginLeft: '20px' }}>
                    <span className={`pill ${
                        run.status === 'COMPLETED' ? 'pill-success'
                        : run.status === 'FAILED' ? 'pill-error'
                        : run.status === 'RUNNING' ? 'pill-accent'
                        : 'pill-muted'
                    }`} style={{ fontSize: '12px', padding: '5px 12px' }}>
                        {run.status === 'RUNNING' && <span className="dot dot-pulse" />}
                        {' '}{run.status}{run.dryRun ? ' (DRY RUN)' : ''}
                    </span>
                </div>
                <div className="mig-meta">
                    <div className="mig-duration">Duration: <span style={{ color: 'var(--text)' }}>{duration}</span></div>
                    {run.correlationId && <div className="mig-id">traceId: {run.correlationId.split('-')[0]}</div>}
                </div>
            </div>

            {/* Layout */}
            <div className="migration-layout">
                {/* Left — wave cards */}
                <div>
                    <div className="waves-title">Wave Execution Plan</div>
                    <div className="waves-list">
                        {run.waves.map((wave, i) => (
                            <WaveCard key={wave.entityType} wave={wave} index={i + 1} isLast={i === run.waves.length - 1} />
                        ))}
                    </div>
                </div>

                {/* Right — summary */}
                <div className="side-panel">
                    {/* Identity map summary */}
                    <div className="panel-card">
                        <div className="panel-card-title">Entities Processed</div>
                        <div className="id-map-count">{totalItems.toLocaleString()}</div>
                        <div className="id-map-label">total across all waves</div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                            {run.waves.map(wave => (
                                <div className="stat-row" key={wave.entityType}>
                                    <span className="stat-row-label">{wave.entityType}</span>
                                    <span className="stat-row-val">{wave.processedCount.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Execution stats */}
                    <div className="panel-card">
                        <div className="panel-card-title">Execution Stats</div>
                        <div className="stat-row">
                            <span className="stat-row-label">Status</span>
                            <span className="stat-row-val">{run.status}</span>
                        </div>
                        {currentWaveIndex && (
                            <div className="stat-row">
                                <span className="stat-row-label">Current wave</span>
                                <span className="stat-row-val" style={{ color: 'var(--accent)' }}>
                                    Wave {currentWaveIndex} / {run.waves.length}
                                </span>
                            </div>
                        )}
                        <div className="stat-row">
                            <span className="stat-row-label">Processed</span>
                            <span className="stat-row-val ok-count">{run.processedCount.toLocaleString()}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">Errors</span>
                            <span className="stat-row-val" style={{ color: run.failedCount > 0 ? 'var(--error)' : 'inherit' }}>
                                {run.failedCount}
                            </span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">Dry run</span>
                            <span className="stat-row-val">{run.dryRun ? 'Yes' : 'No'}</span>
                        </div>
                    </div>

                    {/* Reconciliation report link (completed runs only) */}
                    {run.status === 'COMPLETED' && report && (
                        <div className="panel-card">
                            <div className="panel-card-title">Migration Complete</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Overall success rate: {report.overallSuccessRate.toFixed(1)}%
                            </div>
                            <Link href={`/reports/${runId}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                View Full Report
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
