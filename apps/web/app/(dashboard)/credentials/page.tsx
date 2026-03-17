import type { Metadata } from 'next';
import { CredentialList } from '@/components/credentials/credential-list';

export const metadata: Metadata = {
    title: 'Credentials | Commerce Orchestrator',
    description: 'Manage your encrypted platform API credentials.',
};

export default function CredentialsPage() {
    return <CredentialList />;
}
