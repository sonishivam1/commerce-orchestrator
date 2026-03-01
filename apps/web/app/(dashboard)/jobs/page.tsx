import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Jobs | Commerce Orchestrator',
    description: 'View and manage all ETL and scrape jobs.',
};

export default function JobsPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Jobs</h1>
            <p className="text-muted-foreground">Job list will render here. Connect Apollo query.</p>
            {/* TODO: Replace with <JobList /> component using useQuery(GET_JOBS) */}
        </div>
    );
}
