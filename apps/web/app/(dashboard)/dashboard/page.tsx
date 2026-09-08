'use client';

import { useQuery } from '@apollo/client';
import { GET_RECENT_MIGRATION_RUNS, GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KeyRound, Activity, TrendingUp, Zap } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

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
    completedAt?: string;
    createdAt: string;
}

interface MigrationProject {
    id: string;
    name: string;
    sourceConnectionId: string;
    targetConnectionId: string;
    entityTypes: string[];
    status: string;
}

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── System Health Component ───────────────────────────────────────────────────

function SystemHealth({ hasFailedItems }: { hasFailedItems: boolean }) {
    const [apiStatus, setApiStatus] = useState<'loading' | 'ok' | 'error'>('loading');

    useEffect(() => {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql').replace('/graphql', '');
        fetch(`${apiBase}/health`)
            .then(r => r.json())
            .then((body: { status?: string }) => {
                setApiStatus(body?.status === 'ok' ? 'ok' : 'error');
            })
            .catch(() => setApiStatus('error'));
    }, []);

    const apiLabel = apiStatus === 'loading' ? 'Checking…' : apiStatus === 'ok' ? 'Reachable' : 'Unreachable';
    const apiClass = apiStatus === 'ok' ? 'pill-success' : apiStatus === 'error' ? 'pill-error' : 'pill-muted';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>API Server</span>
                <span className={`pill ${apiClass}`}>{apiLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Recent runs</span>
                <span className={`pill ${hasFailedItems ? 'pill-error' : 'pill-success'}`}>
                    {hasFailedItems ? 'Failed items' : 'Clean'}
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Worker</span>
                <span className="pill pill-muted">No Heartbeat</span>
            </div>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function duration(start?: string, end?: string): string {
    if (!start) return '—';
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diff = endTime - new Date(start).getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { data: runsData, loading: runsLoading } = useQuery<{ recentMigrationRuns: MigrationRun[] }>(
        GET_RECENT_MIGRATION_RUNS,
        { variables: { limit: 10 }, pollInterval: 5000 },
    );
    const { data: projectsData, loading: projectsLoading } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
        { pollInterval: 10000 },
    );
    const { data: credsData, loading: credsLoading } = useQuery<{ credentials: Credential[] }>(
        GET_CREDENTIALS,
    );

    const runs        = runsData?.recentMigrationRuns ?? [];
    const projects    = projectsData?.migrationProjects ?? [];
    const credentials = credsData?.credentials ?? [];

    const loading = runsLoading || projectsLoading || credsLoading;

    // Lookup maps
    const projectById = Object.fromEntries(projects.map(p => [p.id, p]));

    // Stats logic
    const runningRuns   = runs.filter(r => r.status === 'RUNNING');
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const recordsToday = runs
        .filter(r => new Date(r.createdAt) >= todayStart)
        .reduce((sum, r) => sum + r.processedCount, 0);

    const doneRuns = runs.filter(r => r.status === 'COMPLETED' || r.status === 'FAILED');
    const totalProcessed = doneRuns.reduce((s, r) => s + r.processedCount + r.failedCount, 0);
    const totalFailed    = doneRuns.reduce((s, r) => s + r.failedCount, 0);
    const successRate    = totalProcessed > 0
        ? ((1 - totalFailed / totalProcessed) * 100).toFixed(1) + '%'
        : '—';

    return (
        <div className="view active" id="view-dashboard">
            <div className="section-header">
                <div>
                    <div className="section-title">Command Center</div>
                    <div className="section-sub">Commerce Data Orchestrator · VPG Organisation</div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-label">Active Connections</div>
                    <div className="stat-value">{loading ? '—' : credentials.length}</div>
                    <div className="stat-delta">Platforms Connected</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Running Migrations</div>
                    <div className="stat-value" style={{ color: runningRuns.length > 0 ? 'var(--accent)' : 'inherit' }}>{loading ? '—' : runningRuns.length}</div>
                    <div className="stat-delta" style={{ color: runningRuns.length > 0 ? 'var(--accent)' : 'inherit' }}>
                        {runningRuns.length > 0 && <span className="dot dot-pulse" style={{ background: 'var(--accent)', marginRight: '4px' }}></span>}
                        Active runs
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Records Today</div>
                    <div className="stat-value">{loading ? '—' : formatCount(recordsToday)}</div>
                    <div className="stat-delta">Processed this session</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Success Rate</div>
                    <div className="stat-value">{loading ? '—' : successRate}</div>
                    <div className="stat-delta">Last {doneRuns.length} completed runs</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="dash-grid">
                <div className="card">
                    <div className="card-title">Recent Executions</div>
                    <div className="exec-list">
                        {runsLoading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : runs.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent executions</div>
                        ) : (
                            runs.map(run => {
                                const project = projectById[run.migrationProjectId];
                                const isRunning = run.status === 'RUNNING';
                                const isCompleted = run.status === 'COMPLETED';
                                const isFailed = run.status === 'FAILED';
                                
                                const pillClass = isRunning ? 'pill-accent' : isCompleted ? 'pill-success' : isFailed ? 'pill-error' : 'pill-muted';
                                const statusLabel = isRunning ? 'RUNNING' : isCompleted ? 'COMPLETE' : isFailed ? 'FAILED' : 'PENDING';
                                const iconBg = isRunning ? 'rgba(129,140,248,0.1)' : isCompleted ? 'var(--success-dim)' : isFailed ? 'var(--error-dim)' : 'rgba(255,255,255,0.05)';
                                const iconChar = isRunning ? '▶' : isCompleted ? '✓' : isFailed ? '✗' : '·';
                                
                                return (
                                    <Link key={run.id} href={`/runs/${run.id}`} style={{ textDecoration: 'none' }}>
                                        <div className="exec-item">
                                            <div className="exec-icon" style={{ background: iconBg }}>{iconChar}</div>
                                            <div className="exec-info">
                                                <div className="exec-name">{project?.name ?? 'Migration Run'}</div>
                                                <div className="exec-meta">{run.processedCount.toLocaleString()} records processed</div>
                                            </div>
                                            <div className="exec-right">
                                                <div style={{ marginBottom: '4px' }}>
                                                    <span className={`pill ${pillClass}`}>
                                                        {isRunning && <span className="dot dot-pulse" style={{ marginRight: '4px' }}></span>} {statusLabel}
                                                    </span>
                                                </div>
                                                <div className="exec-time">{isRunning ? duration(run.startedAt) : timeAgo(run.createdAt)}</div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="card">
                        <div className="card-title">System Health</div>
                        <SystemHealth hasFailedItems={runs.some(r => r.failedCount > 0)} />
                    </div>
                </div>
            </div>
        </div>
    );
}
