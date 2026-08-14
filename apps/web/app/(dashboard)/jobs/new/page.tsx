import type { Metadata } from 'next';
import { CreateJobWizard } from '@/components/jobs/create-job-wizard';

export const metadata: Metadata = {
    title: 'New Job | Commerce Orchestrator',
    description: 'Create a new ETL or scrape job.',
};

export default function NewJobPage() {
    return <CreateJobWizard />;
}
