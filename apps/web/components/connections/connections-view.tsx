'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { GET_CREDENTIALS, GET_CREDENTIAL } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import { X, Trash2 } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface Credential {
    id: string;
    platform: string;
    alias: string;
    createdAt: string;
    rawPayload?: string;
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
    onConfigure,
}: {
    credential: Credential;
    onDelete: (id: string) => void;
    onConfigure: (credential: Credential) => void;
}) {
    const isShopify = credential.platform === 'SHOPIFY';
    const logo = isShopify ? '🛒' : credential.platform === 'BIGCOMMERCE' ? '🛠️' : '📋';
    
    return (
        <div className="conn-card">
            <div className="conn-header">
                <div className="conn-logo">{logo}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="pill pill-success"><span className="dot dot-pulse"></span> Active</span>
                    <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ padding: '4px', height: 'auto' }} 
                        onClick={() => onDelete(credential.id)}
                        title="Delete connection"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="conn-name">{credential.platform}</div>
            <div className="conn-alias">{credential.alias}</div>
            <hr className="conn-divider" />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Capabilities</div>
            <div className="conn-caps">
                <span className="cap-tag enabled">Products</span>
                <span className="cap-tag enabled">Categories</span>
                <span className="cap-tag enabled">Customers</span>
                <span className="cap-tag enabled">Orders</span>
                <span className="cap-tag enabled">Inventory</span>
            </div>
            <div className="conn-footer">
                <span className="conn-count">Active connection</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onConfigure(credential)}>Configure</button>
            </div>
        </div>
    );
}

// ── Add Connection Form ──────────────────────────────────────────────────────

function AddConnectionForm({ onClose, initialData }: { onClose: () => void, initialData?: Credential | null }) {
    const [platform, setPlatform] = useState(initialData?.platform || 'COMMERCETOOLS');
    const [alias, setAlias] = useState(initialData?.alias || '');
    const [formData, setFormData] = useState<Record<string, string>>(
        PLATFORM_DEFAULTS[initialData?.platform || 'COMMERCETOOLS'] ?? PLATFORM_DEFAULTS['COMMERCETOOLS']
    );
    const [error, setError] = useState<string | null>(null);

    const { loading: fetchLoading } = useQuery(GET_CREDENTIAL, {
        variables: { id: initialData?.id },
        skip: !initialData?.id,
        fetchPolicy: 'network-only',
        onCompleted: (data) => {
            if (data?.credential?.rawPayload) {
                try {
                    const parsed = JSON.parse(data.credential.rawPayload);
                    // Merge with defaults to ensure all fields are present
                    setFormData(prev => ({ ...prev, ...parsed }));
                } catch (e) {
                    console.error('Failed to parse rawPayload', e);
                }
            }
        },
        onError: (err) => setError('Failed to fetch credentials: ' + err.message)
    });

    const [storeCredential, { loading: saveLoading }] = useMutation(STORE_CREDENTIAL, {
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
        <div className="card" style={{ marginTop: '24px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>{initialData ? 'Configure Connection' : 'Add New Connection'}</h3>
                <button className="btn btn-ghost" onClick={onClose} type="button" style={{ padding: '6px', height: 'auto' }}>
                    <X size={18} />
                </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {error && (
                    <div style={{ color: 'var(--status-failed)', fontSize: '13px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        {error}
                    </div>
                )}
                
                <div className="form-group">
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Platform</label>
                    <select 
                        style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '14px' }}
                        value={platform}
                        onChange={e => handlePlatformChange(e.target.value)}
                        disabled={!!initialData}
                    >
                        {PLATFORM_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="form-group">
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>Connection Name</label>
                    <input 
                        type="text" 
                        style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '14px' }}
                        placeholder="e.g. Shopify Production" 
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                    />
                </div>
                
                {fields.map(key => (
                    <div className="form-group" key={key}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>{key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}</label>
                        <input
                            type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                            style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '14px' }}
                            value={formData[key] ?? ''}
                            onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={`Enter ${key}...`}
                        />
                    </div>
                ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost" onClick={onClose} type="button">Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saveLoading || fetchLoading}>
                    {saveLoading ? 'Saving...' : fetchLoading ? 'Loading...' : 'Save Connection'}
                </button>
            </div>
        </div>
    );
}

// ── Main View ────────────────────────────────────────────────────────────────

export function ConnectionsView() {
    const [showForm, setShowForm] = useState(false);
    const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
    const { data, loading, error } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const [deleteCredential] = useMutation(DELETE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
    });

    const handleDelete = (id: string) => {
        // Removed native window.confirm to ensure delete works in all embedded browsers
        deleteCredential({ variables: { id } });
    };

    const handleConfigure = (credential: Credential) => {
        setEditingCredential(credential);
        setShowForm(true);
    };

    const handleAddClick = () => {
        setEditingCredential(null);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingCredential(null);
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="view active" id="view-connections">
            <div className="section-header">
                <div>
                    <div className="section-title">Connections</div>
                    <div className="section-sub">Platform credentials with discovered capabilities</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleAddClick}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
                    Add Connection
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading connections...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--error)' }}>Error: {error.message}</div>
            ) : (
                <div className="conn-grid">
                    {credentials.map(c => (
                        <ConnectionCard key={c.id} credential={c} onDelete={handleDelete} onConfigure={handleConfigure} />
                    ))}
                    
                    <div className="conn-card add-new" role="button" tabIndex={0} onClick={handleAddClick}>
                        <div className="add-icon">+</div>
                        <div className="add-text">Add Connection</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', textAlign: 'center' }}>Shopify · Commercetools · BigCommerce · CSV · CRM</div>
                    </div>
                </div>
            )}

            {showForm && <AddConnectionForm onClose={handleCloseForm} initialData={editingCredential} />}
        </div>
    );
}
