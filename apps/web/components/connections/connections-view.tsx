'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import {
    Plus,
    X,
    Trash2,
    Database,
    ShoppingBag
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface Credential {
    id: string;
    platform: string;
    alias: string;
    createdAt: string;
}

const PLATFORM_OPTIONS = [
    { value: 'COMMERCETOOLS', label: 'Commercetools' },
    { value: 'SHOPIFY',       label: 'Shopify'       },
    { value: 'BIGCOMMERCE',   label: 'BigCommerce'   },
];

const PLATFORM_FIELDS: Record<string, string[]> = {
    COMMERCETOOLS: ['projectKey', 'clientId', 'clientSecret', 'scopes', 'authUrl', 'apiUrl'],
    SHOPIFY:       ['shopName', 'accessToken'],
    BIGCOMMERCE:   ['storeHash', 'accessToken'],
};

const PLATFORM_DEFAULTS: Record<string, Record<string, string>> = {
    COMMERCETOOLS: {
        projectKey: '',
        clientId: '',
        clientSecret: '',
        scopes: '',
        authUrl: 'https://auth.us-central1.gcp.commercetools.com',
        apiUrl: 'https://api.us-central1.gcp.commercetools.com',
    },
    SHOPIFY: { shopName: '', accessToken: '' },
    BIGCOMMERCE: { storeHash: '', accessToken: '' },
};

// ── Connection Card ──────────────────────────────────────────────────────────

function ConnectionCard({
    credential,
    onDelete,
}: {
    credential: Credential;
    onDelete: (id: string) => void;
}) {
    const isShopify = credential.platform === 'SHOPIFY';
    const Icon = isShopify ? ShoppingBag : Database;
    
    return (
        <div className="conn-card">
            <div className="conn-header">
                <div className="conn-icon">
                    <Icon size={24} />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="conn-status status-completed">Connected</div>
                    <button 
                        className="btn btn-ghost" 
                        style={{ padding: '4px', height: 'auto' }} 
                        onClick={() => onDelete(credential.id)}
                        title="Delete connection"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <div className="conn-info">
                <div className="conn-name">{credential.alias}</div>
                <div className="conn-type">{credential.platform}</div>
            </div>
        </div>
    );
}

// ── Add Connection Modal ─────────────────────────────────────────────────────

function AddConnectionModal({ onClose }: { onClose: () => void }) {
    const [platform, setPlatform] = useState('COMMERCETOOLS');
    const [alias, setAlias] = useState('');
    const [formData, setFormData] = useState<Record<string, string>>(
        PLATFORM_DEFAULTS['COMMERCETOOLS'],
    );
    const [error, setError] = useState<string | null>(null);

    const [storeCredential, { loading }] = useMutation(STORE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
        onCompleted: onClose,
        onError(err) { setError(err.message); },
    });

    const handlePlatformChange = (p: string) => {
        setPlatform(p);
        setFormData(PLATFORM_DEFAULTS[p] ?? {});
        setError(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!alias.trim()) { setError('Alias is required.'); return; }
        if (Object.values(formData).some(v => !v.trim())) {
            setError('All credential fields are required.');
            return;
        }
        storeCredential({
            variables: { input: { platform, alias: alias.trim(), rawPayload: JSON.stringify(formData) } },
        });
    };

    const fields = PLATFORM_FIELDS[platform] ?? [];

    return (
        <div className="modal-overlay" style={{ display: 'flex' }}>
            <div className="modal">
                <div className="modal-header">
                    <h3>Add New Connection</h3>
                    <button className="btn btn-ghost" onClick={onClose} type="button" style={{ padding: '4px', height: 'auto' }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {error && (
                        <div style={{ color: 'var(--status-failed)', marginBottom: '16px', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Platform</label>
                        <select 
                            className="form-select"
                            value={platform}
                            onChange={e => handlePlatformChange(e.target.value)}
                        >
                            {PLATFORM_OPTIONS.map(p => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Connection Name</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Shopify Production" 
                            value={alias}
                            onChange={e => setAlias(e.target.value)}
                        />
                    </div>
                    {fields.map(key => (
                        <div className="form-group" key={key}>
                            <label className="form-label">{key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}</label>
                            <input
                                type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                                className="form-input"
                                value={formData[key] ?? ''}
                                onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={`Enter ${key}...`}
                            />
                        </div>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} type="button">Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Connection'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main View ────────────────────────────────────────────────────────────────

export function ConnectionsView() {
    const [showModal, setShowModal] = useState(false);
    const { data, loading, error } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const [deleteCredential] = useMutation(DELETE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
    });

    const handleDelete = (id: string) => {
        if (confirm('Remove this connection? Migration projects using it may be affected.')) {
            deleteCredential({ variables: { id } });
        }
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="view">
            <div className="table-header">
                <h2>Platform Connections</h2>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} />
                    Add Connection
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading connections...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--status-failed)' }}>Error: {error.message}</div>
            ) : credentials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No connections found. Add one to get started.</div>
            ) : (
                <div className="conn-grid">
                    {credentials.map(c => (
                        <ConnectionCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {showModal && <AddConnectionModal onClose={() => setShowModal(false)} />}
        </div>
    );
}
