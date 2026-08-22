import type { Metadata } from 'next';
import { RunsView } from '@/components/runs/runs-view';

export const metadata: Metadata = {
    title: 'Live Execution | Commerce Orchestrator',
    description: 'Monitor active migration runs.',
};

export default function RunsPage() {
    return <RunsView />;
}
