import type { Metadata } from 'next';
import { ConnectionsView } from '@/components/connections/connections-view';

export const metadata: Metadata = {
    title: 'Connections | Commerce Orchestrator',
    description: 'Manage your encrypted platform API credentials.',
};

export default function ConnectionsPage() {
    return <ConnectionsView />;
}
