import type { Metadata } from 'next';
import { JobList } from '@/components/jobs/job-list';

export const metadata: Metadata = {
    title: 'Jobs | Commerce Orchestrator',
    description: 'View and manage all ETL and scrape jobs.',
};

export default function JobsPage() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Monitor and manage your data migration and ETL jobs.
                </p>
            </div>
            <JobList />
        </div>
    );
}
