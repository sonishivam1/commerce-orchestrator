'use client';

import { useState } from 'react';
import { DlqTable } from '@/components/shared/dlq-table';
import { useQuery } from '@apollo/client';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';

interface Job { id: string; kind: string; status: string; }

export default function DlqPage() {
    const [selectedJobId, setSelectedJobId] = useState('');
    const { data } = useQuery<{ jobs: Job[] }>(GET_JOBS);
    const jobs = (data?.jobs ?? []).filter((j) => j.status === 'FAILED' || j.status === 'COMPLETED');

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Inspect and replay individual entities that failed to migrate.
                </p>
            </div>

            <div className="mb-6 space-y-2">
                <label htmlFor="dlq-job-select" className="text-sm font-medium">Select Job</label>
                <select
                    id="dlq-job-select"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                    <option value="">Choose a job to inspect…</option>
                    {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                            {j.id} — {j.kind} ({j.status})
                        </option>
                    ))}
                </select>
            </div>

            <DlqTable jobId={selectedJobId} />
        </div>
    );
}
