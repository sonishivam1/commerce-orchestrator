'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import { KeyRound, Plus, Trash2, Loader2, Server } from 'lucide-react';

const PLATFORM_OPTIONS = [
    { value: 'COMMERCETOOLS', label: 'Commercetools' },
    { value: 'SHOPIFY', label: 'Shopify' },
    { value: 'BIGCOMMERCE', label: 'BigCommerce' },
];

const PLATFORM_PAYLOAD_HINTS: Record<string, string> = {
    COMMERCETOOLS: JSON.stringify({ projectKey: '', clientId: '', clientSecret: '', authUrl: '', apiUrl: '' }, null, 2),
    SHOPIFY: JSON.stringify({ shopName: '', accessToken: '' }, null, 2),
    BIGCOMMERCE: JSON.stringify({ storeHash: '', accessToken: '' }, null, 2),
};

interface Credential {
    id: string;
    platform: string;
    alias: string;
    createdAt: string;
}

function CredentialCard({ credential, onDelete }: { credential: Credential; onDelete: (id: string) => void }) {
    return (
        <div className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                    <Server className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <p className="font-medium text-sm">{credential.alias}</p>
                    <p className="text-xs text-muted-foreground">{credential.platform}</p>
                </div>
            </div>
            <button
                id={`delete-credential-${credential.id}`}
                onClick={() => onDelete(credential.id)}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Delete ${credential.alias}`}
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}

function AddCredentialModal({ onClose }: { onClose: () => void }) {
    const [platform, setPlatform] = useState('COMMERCETOOLS');
    const [alias, setAlias] = useState('');
    const [rawPayload, setRawPayload] = useState(PLATFORM_PAYLOAD_HINTS['COMMERCETOOLS']);
    const [error, setError] = useState<string | null>(null);

    const [storeCredential, { loading }] = useMutation(STORE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
        onCompleted: onClose,
        onError(err) { setError(err.message); },
    });

    const handlePlatformChange = (p: string) => {
        setPlatform(p);
        setRawPayload(PLATFORM_PAYLOAD_HINTS[p] ?? '{}');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            JSON.parse(rawPayload); // client-side validation
        } catch {
            setError('Payload must be valid JSON');
            return;
        }
        storeCredential({ variables: { input: { platform, alias, rawPayload } } });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl p-6 space-y-5 mx-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg">Add Platform Credential</h2>
                    <button id="close-modal" onClick={onClose} className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="cred-platform" className="text-sm font-medium">Platform</label>
                        <select
                            id="cred-platform"
                            value={platform}
                            onChange={(e) => handlePlatformChange(e.target.value)}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors"
                        >
                            {PLATFORM_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="cred-alias" className="text-sm font-medium">Alias</label>
                        <input
                            id="cred-alias"
                            type="text"
                            required
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder="e.g. Production Store"
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="cred-payload" className="text-sm font-medium">
                            Credentials JSON
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(encrypted before storage)</span>
                        </label>
                        <textarea
                            id="cred-payload"
                            rows={7}
                            required
                            value={rawPayload}
                            onChange={(e) => setRawPayload(e.target.value)}
                            className="w-full font-mono rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
                        />
                    </div>

                    {error && (
                        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors">
                            Cancel
                        </button>
                        <button
                            id="save-credential"
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Saving…' : 'Save Credential'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function CredentialList() {
    const [showModal, setShowModal] = useState(false);
    const { data, loading, error } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const [deleteCredential] = useMutation(DELETE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
    });

    const handleDelete = (id: string) => {
        if (confirm('Delete this credential? Jobs using it will fail.')) {
            deleteCredential({ variables: { id } });
        }
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {credentials.length === 0 ? 'No credentials yet.' : `${credentials.length} credential${credentials.length === 1 ? '' : 's'} stored.`}
                </p>
                <button
                    id="add-credential-btn"
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" /> Add Credential
                </button>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
            )}

            {error && (
                <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                    {error.message}
                </div>
            )}

            {!loading && credentials.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                        <KeyRound className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-sm">No credentials yet</h3>
                    <p className="text-muted-foreground text-xs mt-1">Add your first platform credential to start migrating data.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Credential
                    </button>
                </div>
            )}

            {credentials.length > 0 && (
                <div className="space-y-3">
                    {credentials.map((c) => (
                        <CredentialCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {showModal && <AddCredentialModal onClose={() => setShowModal(false)} />}
        </div>
    );
}
