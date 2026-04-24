import type { Metadata } from 'next';
import { NewJobForm } from '@/components/jobs/new-job-form';

export const metadata: Metadata = {
    title: 'New Job | Commerce Orchestrator',
    description: 'Create a new ETL or scrape job.',
};

export default function NewJobPage() {
    return <NewJobForm />;
}
