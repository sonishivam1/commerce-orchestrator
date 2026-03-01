import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Job Detail | Commerce Orchestrator' };

interface JobDetailPageProps {
    params: { id: string };
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Job: {params.id}</h1>
            {/* TODO: useQuery(GET_JOB, { variables: { id: params.id } }) */}
            {/* TODO: Render Progress bar, DLQ failed items, trace logs */}
        </div>
    );
}
