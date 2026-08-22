import type { Metadata } from 'next';
import { ReconciliationReport } from '@/components/reports/reconciliation-report';

export const metadata: Metadata = {
    title: 'Reconciliation Report | Commerce Orchestrator',
};

// `id` here is the migrationRunId — the report is keyed by run
export default function ReportPage({ params }: { params: { id: string } }) {
    return <ReconciliationReport migrationRunId={params.id} />;
}
