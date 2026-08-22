import type { Metadata } from 'next';
import { CreateProjectForm } from '@/components/projects/create-project-form';

export const metadata: Metadata = {
    title: 'New Project | Commerce Orchestrator',
    description: 'Create a new migration project.',
};

export default function NewProjectPage() {
    return <CreateProjectForm />;
}
