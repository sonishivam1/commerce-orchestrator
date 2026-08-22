import type { Metadata } from 'next';
import { ProjectsList } from '@/components/projects/projects-list';

export const metadata: Metadata = {
    title: 'Projects | Commerce Orchestrator',
    description: 'Manage migration projects.',
};

export default function ProjectsPage() {
    return <ProjectsList />;
}
