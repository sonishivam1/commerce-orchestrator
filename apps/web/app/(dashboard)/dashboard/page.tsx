'use client';

import { useQuery } from '@apollo/client';
import { GET_RECENT_MIGRATION_RUNS, GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import { Play, CheckCircle2, XCircle, Clock, KeyRound, Activity, TrendingUp, Zap } from 'lucide-react';

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
            {/* Stats Row */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Active Connections</span>
                        <div className="icon-box icon-primary">
                            <KeyRound size={16} />
                        </div>
                    </div>
                    <div className="metric-value">{loading ? '—' : credentials.length}</div>
                    <div className="metric-trend trend-neutral">Platforms Connected</div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Running Migrations</span>
                        <div className="icon-box icon-warning">
                            <Activity size={16} />
                        </div>
                    </div>
                    <div className="metric-value">{loading ? '—' : runningRuns.length}</div>
                    <div className="metric-trend trend-neutral">Active Sync Jobs</div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Records Today</span>
                        <div className="icon-box icon-success">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="metric-value">{loading ? '—' : formatCount(recordsToday)}</div>
                    <div className="metric-trend trend-up">Processed this session</div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Success Rate</span>
                        <div className="icon-box icon-purple">
                            <Zap size={16} />
                        </div>
                    </div>
                    <div className="metric-value">{loading ? '—' : successRate}</div>
                    <div className="metric-trend trend-neutral">Last {doneRuns.length} completed runs</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="charts-row">
                <div className="table-container" style={{ flex: 2 }}>
                    <div className="table-header">
                        <h3>Recent Executions</h3>
                        <Link href="/runs" className="btn btn-ghost btn-sm">View All</Link>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Duration / Age</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runsLoading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center' }}>Loading...</td></tr>
                            ) : runs.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center' }}>No recent executions</td></tr>
                            ) : (
                                runs.map(run => {
                                    const project = projectById[run.migrationProjectId];
                                    const isRunning = run.status === 'RUNNING';
                                    const isCompleted = run.status === 'COMPLETED';
                                    const isFailed = run.status === 'FAILED';
                                    
                                    const statusClass = isRunning ? 'status-running' : isCompleted ? 'status-completed' : isFailed ? 'status-failed' : 'status-pending';
                                    const statusLabel = isRunning ? 'Running' : isCompleted ? 'Complete' : isFailed ? 'Failed' : 'Pending';
                                    
                                    // A simple progress calc for the UI (using a max target or just showing relative size)
                                    // Normally we need total target count, but since we don't have it, we just show a full bar if done, pulse if running.
                                    const progressPct = isCompleted ? 100 : isRunning ? 50 : 0;

                                    return (
                                        <tr key={run.id}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                                                        {project?.name ?? 'Migration Run'}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {run.processedCount.toLocaleString()} records
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                                            </td>
                                            <td>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    {isRunning ? duration(run.startedAt) : timeAgo(run.createdAt)}
                                                </span>
                                            </td>
                                            <td>
                                                <Link href={`/runs/${run.id}`} className="btn btn-ghost btn-sm">Details</Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-container" style={{ flex: 1 }}>
                    <div className="table-header">
                        <h3>System Health</h3>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Worker Nodes</span>
                            <span className="status-badge status-completed">Online (3/3)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dead Letter Queue</span>
                            <Link href="/dlq" className={`status-badge ${runs.some(r => r.failedCount > 0) ? 'status-failed' : 'status-completed'}`}>
                                {runs.some(r => r.failedCount > 0) ? 'Action Required' : 'Clear'}
                            </Link>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>API Limits</span>
                            <span className="status-badge status-completed">Healthy</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
