import type { Metadata } from 'next';
import { CredentialList } from '@/components/credentials/credential-list';

export const metadata: Metadata = {
    title: 'Credentials | Commerce Orchestrator',
    description: 'Manage your encrypted platform API credentials.',
};

export default function CredentialsPage() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Platform Credentials</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Store encrypted API credentials for your Commercetools, Shopify, and other platform accounts.
                </p>
            </div>
            <CredentialList />
        </div>
    );
}
