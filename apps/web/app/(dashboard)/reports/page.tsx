import type { Metadata } from 'next';
import { ReportsOverview } from '@/components/reports/reports-overview';

export const metadata: Metadata = {
    title: 'Reconciliation | Commerce Orchestrator',
    description: 'Migration reconciliation reports.',
};

export default function ReportsPage() {
    return <ReportsOverview />;
}
