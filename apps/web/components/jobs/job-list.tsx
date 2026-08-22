'use client';

import { useQuery, useMutation } from '@apollo/client';
import Link from 'next/link';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { DELETE_JOB } from '@/lib/graphql/mutations';
import { useState } from 'react';

interface Job {
    id: string;
    kind: string;
    status: string;
    tenantId: string;
    createdAt: string;
    processedCount: number;
    failedCount: number;
}

/* ─── Status Badge ─────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    if (status === 'RUNNING') return <span className="pill pill-running"><span className="pulse-dot"></span> RUNNING</span>;
    if (status === 'COMPLETED') return <span className="pill pill-success">COMPLETED</span>;
    if (status === 'FAILED') return <span className="pill pill-error">FAILED</span>;
    return <span className="pill">PENDING</span>;
}

/* ─── Kind Badge ───────────────────────────────────────────── */
function KindBadge({ kind }: { kind: string }) {
    return (
        <span className="pill" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.2)' }}>
            {kind.replace(/_/g, ' ')}
        </span>
    );
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
        month:   'short',
        day:     'numeric',
        hour:    '2-digit',
        minute:  '2-digit',
        hour12:  true,
    });
}

/* ─── Main Component ───────────────────────────────────────── */
export function JobList() {
    const [search, setSearch] = useState('');

    const { data, loading, error, refetch } = useQuery<{ jobs: Job[] }>(GET_JOBS, {
        pollInterval: 5000,
    });

    const [deleteJob, { loading: deleting }] = useMutation(DELETE_JOB, {
        onCompleted: () => refetch(),
    });

    const handleDelete = (job: Job) => {
        if (job.status === 'RUNNING') return;
        if (!confirm(`Delete job ${job.id.substring(0, 8).toUpperCase()}? This cannot be undone.`)) return;
        deleteJob({ variables: { id: job.id } });
    };

    if (loading) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading jobs...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '40px', color: 'var(--error)' }}>
                <h3>Sync Error</h3>
                <p>{error.message}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: '10px' }}>Retry</button>
            </div>
        );
    }

    const jobs = data?.jobs ?? [];
    const filtered = search.trim()
        ? jobs.filter(j =>
            j.id.toLowerCase().includes(search.toLowerCase()) ||
            j.kind.toLowerCase().includes(search.toLowerCase()) ||
            j.status.toLowerCase().includes(search.toLowerCase()),
          )
        : jobs;

    const total     = jobs.length;
    const running   = jobs.filter(j => j.status === 'RUNNING').length;
    const completed = jobs.filter(j => j.status === 'COMPLETED').length;
    const failed    = jobs.filter(j => j.status === 'FAILED').length;

    return (
        <div className="view active" id="view-jobs">
            <div className="section-header">
                <div>
                    <div className="section-title">Background Jobs</div>
                    <div className="section-sub">Manage and monitor orchestration tasks</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search jobs..."
                        className="proj-search"
                        style={{ width: '200px' }}
                    />
                    <Link href="/jobs/new" className="btn btn-primary">Launch Job</Link>
                </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
                <div className="card">
                    <div className="card-title">Total Jobs</div>
                    <div className="stat-value">{total}</div>
                </div>
                <div className="card">
                    <div className="card-title">Running</div>
                    <div className="stat-value">{running}</div>
                </div>
                <div className="card">
                    <div className="card-title">Completed</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{completed}</div>
                </div>
                <div className="card">
                    <div className="card-title">Failed</div>
                    <div className="stat-value" style={{ color: 'var(--error)' }}>{failed}</div>
                </div>
            </div>

            <div style={{ background: 'rgba(19, 27, 44, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="proj-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th>Job ID</th>
                            <th>Kind</th>
                            <th>Status</th>
                            <th>Processed / Failed</th>
                            <th>Created At</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    {search ? 'No matching jobs' : 'No jobs found'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((job) => (
                                <tr key={job.id}>
                                    <td style={{ fontFamily: 'var(--font-data)' }}>{job.id.substring(0, 8).toUpperCase()}</td>
                                    <td><KindBadge kind={job.kind} /></td>
                                    <td><StatusBadge status={job.status} /></td>
                                    <td style={{ fontFamily: 'var(--font-data)', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--success)' }}>{job.processedCount}</span> /{' '}
                                        <span style={{ color: job.failedCount > 0 ? 'var(--error)' : 'inherit' }}>{job.failedCount}</span>
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {formatDate(job.createdAt)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm" style={{ marginRight: '8px' }}>
                                            View
                                        </Link>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(job)}
                                            disabled={deleting || job.status === 'RUNNING'}
                                            style={{ color: (deleting || job.status === 'RUNNING') ? 'inherit' : 'var(--error)' }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
