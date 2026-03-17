import type { Metadata } from 'next';
import { NewJobForm } from '@/components/jobs/new-job-form';

export const metadata: Metadata = {
    title: 'New Job | Commerce Orchestrator',
    description: 'Create a new ETL or scrape job.',
};

export default function NewJobPage() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">New Job</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Configure and start a new data migration or scrape job.
                </p>
            </div>
            <NewJobForm />
        </div>
    );
}
