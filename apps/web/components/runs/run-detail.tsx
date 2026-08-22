'use client';

import { useQuery } from '@apollo/client';
import {
    GET_MIGRATION_RUN,
    GET_RECONCILIATION_REPORT,
} from '@/lib/graphql/queries/migration-project.queries';
import { GET_MIGRATION_PROJECT } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';

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
    sourceConnection?: { platform: string; alias: string };
    targetConnection?: { platform: string; alias: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPlatformIcon(platform: string) {
    const p = (platform ?? '').toLowerCase();
    if (p.includes('commercetools')) return '📋';
    if (p.includes('shopify')) return '🛒';
    if (p.includes('bigcommerce')) return '🛠️';
    return '🔌';
}

function WaveCard({ wave, index, isLast }: { wave: WaveRecord; index: number; isLast: boolean }) {
    const total = wave.processedCount + wave.failedCount;
    const progressPct = wave.status === 'COMPLETED' ? 100 : (wave.status === 'RUNNING' ? (total > 0 ? 50 : 10) : 0);
    
    let stateClass = '';
    let pillClass = 'pill-muted';
    let pillText = 'Waiting';
    let fillClass = '';
    let numContent: any = index;

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
    } else if (wave.status === 'BLOCKED') {
        stateClass = 'wave-blocked';
        pillClass = 'pill-warning';
        pillText = 'Blocked';
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
                    <div className="wave-counts">{wave.processedCount.toLocaleString()} / {wave.processedCount + wave.failedCount}</div>
                    <span className={`pill ${pillClass}`} style={{ marginLeft: '8px' }}>
                        {wave.status === 'RUNNING' && <span className="dot dot-pulse" />} {pillText}
                    </span>
                </div>
                
                <div className="wave-bar-track" style={wave.status !== 'PENDING' ? { marginTop: '12px' } : {}}>
                    <div className={`wave-bar-fill ${fillClass}`} style={{ width: `${progressPct}%`, background: wave.status === 'PENDING' ? 'var(--text-dim)' : undefined }}></div>
                </div>
                
                {wave.status === 'RUNNING' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-muted)' }}>Batch Processing</span>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--accent)' }}>{progressPct.toFixed(1)}%</span>
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
        {
            variables: { id: runId },
            pollInterval: 3000,
        },
    );

    const run = runData?.migrationRun;

    const { data: projectData } = useQuery<{ migrationProject: MigrationProject }>(
        GET_MIGRATION_PROJECT,
        {
            variables: { id: run?.migrationProjectId },
            skip: !run?.migrationProjectId,
        },
    );

    const { data: reportData } = useQuery(GET_RECONCILIATION_REPORT, {
        variables: { migrationRunId: runId },
        skip: run?.status !== 'COMPLETED',
    });

    const project = projectData?.migrationProject;
    const report = reportData?.reconciliationReport;

    if (runLoading && !run) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading run...</div>;
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
        : run.startedAt ? 'Running...' : 'Not started';

    return (
        <div className="view active" id="view-migration">
            
            <div className="migration-header">
                <div className="mig-platform">
                    <div className="mig-logo">{getPlatformIcon(project?.sourceConnection?.platform || '')}</div>
                    <div className="mig-info">
                        <div className="mig-platform-name">{project?.sourceConnection?.platform || 'Source'}</div>
                        <div className="mig-platform-alias">{project?.sourceConnection?.alias || 'Unknown'}</div>
                    </div>
                </div>
                <div className="mig-arrow-big">→</div>
                <div className="mig-platform">
                    <div className="mig-logo">{getPlatformIcon(project?.targetConnection?.platform || '')}</div>
                    <div className="mig-info">
                        <div className="mig-platform-name">{project?.targetConnection?.platform || 'Target'}</div>
                        <div className="mig-platform-alias">{project?.targetConnection?.alias || 'Unknown'}</div>
                    </div>
                </div>
                <div style={{ marginLeft: '20px' }}>
                    <span className={`pill ${run.status === 'COMPLETED' ? 'pill-success' : run.status === 'FAILED' ? 'pill-error' : run.status === 'RUNNING' ? 'pill-accent' : 'pill-muted'}`} style={{ fontSize: '12px', padding: '5px 12px' }}>
                        {run.status === 'RUNNING' && <span className="dot dot-pulse" />} {run.status} {run.dryRun ? '(DRY RUN)' : ''}
                    </span>
                </div>
                <div className="mig-meta">
                    <div className="mig-duration">Duration: <span style={{ color: 'var(--text)' }}>{duration}</span></div>
                    {run.correlationId && <div className="mig-id">traceId: {run.correlationId.split('-')[0]}</div>}
                </div>
            </div>

            <div className="migration-layout">
                {/* Left panel */}
                <div>
                    <div className="waves-title">Wave Execution Plan</div>
                    <div className="waves-list">
                        {run.waves.map((wave, i) => (
                            <WaveCard key={wave.entityType} wave={wave} index={i + 1} isLast={i === run.waves.length - 1} />
                        ))}
                    </div>
                </div>
                
                {/* Right panel */}
                <div className="side-panel">
                    <div className="panel-card">
                        <div className="panel-card-title">Identity Map</div>
                        <div className="id-map-count">{run.processedCount.toLocaleString()}</div>
                        <div className="id-map-label">source → target entries recorded</div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                            {run.waves.map(wave => (
                                <div className="stat-row" key={wave.entityType}>
                                    <span className="stat-row-label">{wave.entityType}</span>
                                    <span className="stat-row-val">{wave.processedCount}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="panel-card">
                        <div className="panel-card-title">Execution Stats</div>
                        <div className="stat-row">
                            <span className="stat-row-label">Current wave</span>
                            <span className="stat-row-val" style={{ color: 'var(--accent)' }}>Wave {run.waves.findIndex(w => w.status === 'RUNNING') + 1} / {run.waves.length}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">Current batch</span>
                            <span className="stat-row-val">#1</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">Errors</span>
                            <span className="stat-row-val" style={{ color: 'var(--error)' }}>{run.failedCount}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">DLQ items</span>
                            <span className="stat-row-val" style={{ color: 'var(--warning)' }}>{run.failedCount}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-row-label">Circuit breaker</span>
                            <span className="stat-row-val ok-count">Closed</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
