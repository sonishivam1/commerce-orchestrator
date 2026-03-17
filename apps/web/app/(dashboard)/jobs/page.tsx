import type { Metadata } from 'next';
import { JobList } from '@/components/jobs/job-list';

export const metadata: Metadata = {
    title: 'Jobs | Commerce Orchestrator',
    description: 'View and manage all ETL and scrape jobs.',
};

export default function JobsPage() {
    return <JobList />;
}
