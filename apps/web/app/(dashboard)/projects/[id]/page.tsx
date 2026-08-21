import type { Metadata } from 'next';
import { ProjectDetail } from '@/components/projects/project-detail';

export const metadata: Metadata = {
    title: 'Project | Commerce Orchestrator',
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
    return <ProjectDetail projectId={params.id} />;
}
