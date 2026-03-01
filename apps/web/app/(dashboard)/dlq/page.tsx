import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dead Letter Queue | Commerce Orchestrator' };

export default function DlqPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Dead Letter Queue</h1>
            {/* TODO: DLQ item table with per-item Replay button */}
        </div>
    );
}
