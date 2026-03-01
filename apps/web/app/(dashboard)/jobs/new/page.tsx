import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create Job | Commerce Orchestrator' };

export default function NewJobPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Create New Job</h1>
            {/* TODO: JobWizard component — select kind, source credential, target credential, submit */}
        </div>
    );
}
