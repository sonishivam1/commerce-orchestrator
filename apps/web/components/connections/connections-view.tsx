'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import {
    Plus,
    Trash2,
    Loader2,
    Lock,
    ShieldCheck,
    ChevronDown,
    Zap,
    Server,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface Credential {
    id: string;
    platform: string;
    alias: string;
    createdAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const PLATFORM_META: Record<string, {
    abbr: string;
    color: string;
    ring: string;
    bg: string;
    sourceCaps: string[];
    targetCaps: string[];
}> = {
    COMMERCETOOLS: {
        abbr: 'CT',
        color: 'from-[#3BA4F5] to-[#1A73E8]',
        ring: 'border-[#3BA4F5]/25',
        bg: 'bg-[#3BA4F5]/8',
        sourceCaps: ['Products', 'Categories', 'Customers', 'Orders', 'Prices', 'Inventory'],
        targetCaps: ['Products', 'Categories', 'Customers', 'Orders'],
    },
    SHOPIFY: {
        abbr: 'SH',
        color: 'from-[#96BF48] to-[#5E8E3E]',
        ring: 'border-[#96BF48]/25',
        bg: 'bg-[#96BF48]/8',
        sourceCaps: ['Products', 'Collections', 'Customers'],
        targetCaps: ['Products', 'Collections', 'Customers', 'Draft Orders'],
    },
    BIGCOMMERCE: {
        abbr: 'BC',
        color: 'from-[#34BBE6] to-[#1B95CC]',
        ring: 'border-[#34BBE6]/25',
        bg: 'bg-[#34BBE6]/8',
        sourceCaps: ['Products', 'Categories', 'Customers', 'Orders'],
        targetCaps: ['Products', 'Categories', 'Customers'],
    },
};

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

function CapChip({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-[10px] font-medium text-slate-400 tracking-wide">
            {label}
        </span>
    );
}

// ── Connection Card ──────────────────────────────────────────────────────────

function ConnectionCard({
    credential,
    onDelete,
}: {
    credential: Credential;
    onDelete: (id: string) => void;
}) {
    const meta = PLATFORM_META[credential.platform];
    const date = new Date(credential.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });

    return (
        <div className={cn(
            'group relative bg-[#131B2C]/80 border rounded-2xl p-6 flex flex-col gap-5 transition-all duration-300 hover:border-white/15 shadow-xl backdrop-blur-sm',
            meta ? meta.ring : 'border-white/8',
        )}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'h-11 w-11 rounded-xl flex items-center justify-center border shadow-lg shrink-0',
                        meta ? meta.ring : 'border-white/10',
                        meta ? meta.bg : 'bg-slate-800/50',
                    )}>
                        <div className={cn(
                            'h-7 w-7 rounded-lg flex items-center justify-center bg-gradient-to-br',
                            meta ? meta.color : 'from-slate-600 to-slate-500',
                        )}>
                            <span className="text-white font-bold text-[10px] tracking-wider">
                                {meta?.abbr ?? credential.platform.slice(0, 2)}
                            </span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white leading-tight">{credential.alias}</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wider">
                            {credential.platform.toLowerCase()}
                        </p>
                    </div>
                </div>
                {/* Status dot — no health endpoint yet; shows as registered */}
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Registered</span>
                </div>
            </div>

            {/* Source / Target Caps */}
            {meta && (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">Source Capabilities</p>
                        <div className="flex flex-wrap gap-1">
                            {meta.sourceCaps.map(c => <CapChip key={c} label={c} />)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest">Target Capabilities</p>
                        <div className="flex flex-wrap gap-1">
                            {meta.targetCaps.map(c => <CapChip key={c} label={c} />)}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-[10px] text-slate-600 font-mono">Added {date}</p>
                <button
                    onClick={() => onDelete(credential.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer"
                    title="Remove connection"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
            <div className="w-full max-w-xl bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-white/8">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Add Connection</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Credentials are encrypted with AES-256-GCM before storage
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-7 space-y-5 overflow-y-auto">
                    {/* Platform + Alias */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Platform</label>
                            <div className="relative">
                                <select
                                    value={platform}
                                    onChange={e => handlePlatformChange(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer pr-8"
                                >
                                    {PLATFORM_OPTIONS.map(p => (
                                        <option key={p.value} value={p.value} className="bg-[#0D1526]">
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Alias</label>
                            <input
                                type="text"
                                required
                                value={alias}
                                onChange={e => setAlias(e.target.value)}
                                placeholder="e.g. Production CT"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>

                    {/* Credential Fields */}
                    <div className="space-y-3 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Credentials</p>
                            <span className="text-[9px] text-slate-600 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> End-to-end encrypted
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {fields.map(key => (
                                <div key={key} className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-0.5">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={
                                                key.toLowerCase().includes('secret') ||
                                                key.toLowerCase().includes('token')
                                                    ? 'password'
                                                    : 'text'
                                            }
                                            required
                                            value={formData[key] ?? ''}
                                            onChange={e =>
                                                setFormData(prev => ({ ...prev, [key]: e.target.value }))
                                            }
                                            placeholder={
                                                key === 'projectKey'   ? 'my-project'         :
                                                key === 'scopes'       ? 'manage_project:...' :
                                                key === 'shopName'     ? 'my-store.myshopify.com' :
                                                `Enter ${key}…`
                                            }
                                            className="w-full bg-[#0A101C] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 pr-10"
                                        />
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600 pointer-events-none" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/8 text-slate-300 font-medium py-3 rounded-xl text-sm transition-all border border-white/8 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-primary hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Encrypting…</>
                            ) : (
                                <><Zap className="h-4 w-4" /> Save Connection</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Add Platform Placeholder Card ────────────────────────────────────────────

function AddConnectionCard({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="group bg-[#131B2C]/40 border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 min-h-[200px] cursor-pointer"
        >
            <div className="h-11 w-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
                <Plus className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">Add Connection</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Register a new platform</p>
            </div>
        </button>
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Header */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Connections</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Platform credentials for source and target connectors
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-primary/20 cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> Add Connection
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-medium text-slate-500">Loading connections…</span>
                </div>
            ) : error ? (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                    <Server className="h-10 w-10 text-red-500 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-white mb-1">Failed to load connections</h3>
                    <p className="text-sm text-red-400/80">{error.message}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {credentials.map(c => (
                        <ConnectionCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                    <AddConnectionCard onClick={() => setShowModal(true)} />
                </div>
            )}

            {/* Security notice */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 flex items-center gap-4">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-xs text-slate-500">
                    All credentials are encrypted with <span className="text-slate-300 font-medium">AES-256-GCM</span> before storage.
                    Secret keys never leave server memory in plaintext.
                </p>
            </div>

            {showModal && <AddConnectionModal onClose={() => setShowModal(false)} />}
        </div>
    );
}
