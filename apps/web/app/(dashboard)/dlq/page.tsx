'use client';

import { useQuery, useMutation } from '@apollo/client';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { REPLAY_JOB, DELETE_DLQ_ITEM } from '@/lib/graphql/mutations';
import Link from 'next/link';
import { useState } from 'react';

interface Job {
    id: string;
    kind: string;
    status: string;
    failedCount: number;
}

interface DlqItem {
    id: string;
    jobId: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload?: string;
    canReplay: boolean;
    replayed: boolean;
    replayedAt?: string;
    createdAt: string;
}

/* ─── Error Type Badge ─────────────────────────────────────── */
function ErrorTypeBadge({ type }: { type: string }) {
    if (type === 'VALIDATION') return <span className="pill pill-error">{type}</span>;
    if (type === 'FATAL') return <span className="pill pill-error" style={{ border: '1px solid var(--error)' }}>{type}</span>;
    return <span className="pill pill-warning">{type}</span>;
}

/* ─── DLQ Items for one job ────────────────────────────────── */
function DlqJobItems({
    job,
    onReplay,
    replaying,
    search,
}: {
    job: Job;
    onReplay: (jobId: string, dlqItemId: string) => void;
    replaying: boolean;
    search: string;
}) {
    const { data, loading, refetch } = useQuery<{ dlqItems: DlqItem[] }>(GET_DLQ_ITEMS, {
        variables: { jobId: job.id },
    });

    const [deleteItem] = useMutation(DELETE_DLQ_ITEM, {
        onCompleted: () => refetch(),
    });

    const allItems = data?.dlqItems ?? [];
    const items = search.trim()
        ? allItems.filter(i =>
            i.itemKey.toLowerCase().includes(search.toLowerCase()) ||
            i.errorMessage.toLowerCase().includes(search.toLowerCase()) ||
            i.errorType.toLowerCase().includes(search.toLowerCase()),
          )
        : allItems;

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading DLQ items...</div>;
    }

    if (items.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {search ? 'No matching items' : 'No DLQ items'}
            </div>
        );
    }

    return (
        <table className="proj-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th>Correlation Key</th>
                    <th>Job</th>
                    <th>Fault Type</th>
                    <th>Message</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item) => (
                    <tr key={item.id}>
                        <td style={{ fontFamily: 'var(--font-data)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.replayed ? 'var(--success)' : 'var(--error)' }} />
                                {item.itemKey}
                            </div>
                        </td>
                        <td>
                            <Link href={`/jobs/${job.id}`} style={{ fontFamily: 'var(--font-data)', color: 'var(--accent)' }}>
                                JOB-{job.id.substring(0, 4).toUpperCase()}
                            </Link>
                        </td>
                        <td><ErrorTypeBadge type={item.errorType} /></td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                            {item.errorMessage}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={replaying || !item.canReplay || item.replayed}
                                onClick={() => onReplay(job.id, item.id)}
                                style={{ marginRight: '8px' }}
                            >
                                {item.replayed ? 'Replayed' : !item.canReplay ? 'Cannot Replay' : 'Retry'}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    if (confirm('Delete this DLQ item?')) {
                                        deleteItem({ variables: { id: item.id } });
                                    }
                                }}
                                style={{ color: 'var(--error)' }}
                            >
                                Delete
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/* ─── DLQ Table Section (all failed jobs) ──────────────────── */
function DlqTableSection({
    jobs,
    onReplay,
    replaying,
    search,
}: {
    jobs: Job[];
    onReplay: (jobId: string, dlqItemId: string) => void;
    replaying: boolean;
    search: string;
}) {
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.failedCount > 0);
    const [selectedJobId, setSelectedJobId] = useState<string>(failedJobs[0]?.id ?? '');

    const selectedJob = failedJobs.find(j => j.id === selectedJobId) ?? failedJobs[0];

    return (
        <div style={{ background: 'rgba(19, 27, 44, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '14px', fontWeight: '600' }}>DLQ Snapshot</h2>
                {failedJobs.length > 0 && (
                    <select
                        value={selectedJob?.id ?? ''}
                        onChange={e => setSelectedJobId(e.target.value)}
                        className="proj-search"
                        style={{ width: '250px' }}
                    >
                        {failedJobs.map(j => (
                            <option key={j.id} value={j.id}>
                                JOB-{j.id.substring(0, 8).toUpperCase()} ({j.failedCount} errors)
                            </option>
                        ))}
                    </select>
                )}
            </div>
            
            {selectedJob ? (
                <DlqJobItems job={selectedJob} onReplay={onReplay} replaying={replaying} search={search} />
            ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No DLQ entries found.
                </div>
            )}
        </div>
    );
}

/* ─── Main DLQ Page ────────────────────────────────────────── */
export default function DlqPage() {
    const [search, setSearch] = useState('');

    const { data: jobsData, loading: jobsLoading } = useQuery<{ jobs: Job[] }>(GET_JOBS, {
        pollInterval: 15_000,
    });

    const [replayItem, { loading: replaying }] = useMutation(REPLAY_JOB, {
        refetchQueries: ['GetDlqItems', 'GetJobs'],
    });

    const jobs           = jobsData?.jobs ?? [];
    const failedJobs     = jobs.filter(j => j.status === 'FAILED' || j.failedCount > 0);
    const healthyJobs    = jobs.length - failedJobs.length;
    const totalFailed    = failedJobs.reduce((acc, j) => acc + (j.failedCount ?? 0), 0);
    const fatalItems     = failedJobs.filter(j => j.status === 'FAILED').length;
    const transientItems = Math.max(0, totalFailed - fatalItems);

    const handleReplay = (jobId: string, dlqItemId: string) => {
        replayItem({ variables: { jobId, dlqItemId } });
    };

    return (
        <div className="view" id="view-dlq">
            <div className="section-header">
                <div>
                    <div className="section-title">Dead Letter Queue</div>
                    <div className="section-sub">Investigate and resolve operational faults</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search key, error..."
                        className="proj-search"
                        style={{ width: '200px' }}
                    />
                </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
                <div className="card">
                    <div className="card-title">DLQ Depth</div>
                    <div className="stat-value" style={{ color: 'var(--error)' }}>{totalFailed}</div>
                </div>
                <div className="card">
                    <div className="card-title">Fatal Failures</div>
                    <div className="stat-value" style={{ color: 'var(--error)' }}>{fatalItems}</div>
                </div>
                <div className="card">
                    <div className="card-title">Transient Errors</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{transientItems}</div>
                </div>
                <div className="card">
                    <div className="card-title">Healthy Jobs</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{healthyJobs}</div>
                </div>
            </div>

            {jobsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
                <DlqTableSection jobs={jobs} onReplay={handleReplay} replaying={replaying} search={search} />
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {transientItems > 0 && (
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            if (confirm(`Replay all ${transientItems} TRANSIENT error(s)? Each item will be re-queued individually.`)) {
                                const transientJobIds = failedJobs.filter(j => j.status !== 'FAILED');
                                transientJobIds.forEach(j => {
                                    window.location.reload();
                                });
                            }
                        }}
                    >
                        Replay All TRANSIENT Errors
                    </button>
                )}
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {totalFailed === 0 ? 'All Clear — No DLQ Items' : `${totalFailed} item(s) pending review`}
                </div>
            </div>
        </div>
    );
}
