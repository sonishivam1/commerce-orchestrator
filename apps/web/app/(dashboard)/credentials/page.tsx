import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Credentials | Commerce Orchestrator' };

export default function CredentialsPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Platform Credentials</h1>
            {/* TODO: CredentialCard list + AddCredentialModal */}
        </div>
    );
}
