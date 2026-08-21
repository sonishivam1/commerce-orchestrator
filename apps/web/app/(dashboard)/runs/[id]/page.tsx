import type { Metadata } from 'next';
import { RunDetail } from '@/components/runs/run-detail';

export const metadata: Metadata = {
    title: 'Migration Run | Commerce Orchestrator',
};

export default function RunDetailPage({ params }: { params: { id: string } }) {
    return <RunDetail runId={params.id} />;
}
