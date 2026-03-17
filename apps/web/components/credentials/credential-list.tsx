'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import { KeyRound, Plus, Trash2, Loader2, Server, ShieldCheck, Lock } from 'lucide-react';

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

/* ── Platform Logo ─────────────────────────────────────────── */
function PlatformLogo({ platform }: { platform: string }) {
    if (platform === 'COMMERCETOOLS') {
        return (
            <div className="h-12 w-12 bg-[#1E293B] rounded-xl flex items-center justify-center border border-slate-700/50">
                {/* Commercetools stylized C */}
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
                    <span className="text-white font-black text-sm">CT</span>
                </div>
            </div>
        );
    }
    if (platform === 'SHOPIFY') {
        return (
            <div className="h-12 w-12 bg-[#1E293B] rounded-xl flex items-center justify-center border border-slate-700/50">
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <span className="text-white font-black text-sm">S</span>
                </div>
            </div>
        );
    }
    if (platform === 'BIGCOMMERCE') {
        return (
            <div className="h-12 w-12 bg-[#1E293B] rounded-xl flex items-center justify-center border border-slate-700/50">
                <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-black text-sm">B</span>
                </div>
            </div>
        );
    }
    return (
        <div className="h-12 w-12 bg-[#1E293B] rounded-xl flex items-center justify-center border border-slate-700/50">
            <Server className="h-6 w-6 text-slate-400" />
        </div>
    );
}

/* ── Credential Card ───────────────────────────────────────── */
function CredentialCard({ credential, onDelete }: { credential: Credential; onDelete: (id: string) => void }) {
    const addedDate = new Date(credential.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
    });

    return (
        <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-5 space-y-4 hover:border-slate-700/80 transition-all">
            <PlatformLogo platform={credential.platform} />

            <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">{credential.alias}</h3>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-emerald-400">Active</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">Added {addedDate}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
                <button className="flex-1 bg-[#1E293B] hover:bg-slate-700/60 text-white text-xs font-medium py-2 rounded-lg transition-all border border-slate-700/40">
                    Use in Job
                </button>
                <button
                    onClick={() => onDelete(credential.id)}
                    className="p-2 bg-[#1E293B] hover:bg-red-500/15 border border-slate-700/40 hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

/* ── Add Credential Modal ──────────────────────────────────── */
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
            JSON.parse(rawPayload);
        } catch {
            setError('Payload must be valid JSON');
            return;
        }
        storeCredential({ variables: { input: { platform, alias, rawPayload } } });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 px-4">
            <div className="w-full max-w-md bg-[#0F1626] border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-800/60">
                    <h2 className="text-base font-semibold text-white">Add Credential</h2>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-400">Platform</label>
                            <select
                                value={platform}
                                onChange={(e) => handlePlatformChange(e.target.value)}
                                className="w-full bg-[#1A233A] border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                            >
                                {PLATFORM_OPTIONS.map((p) => (
                                    <option key={p.value} value={p.value} className="bg-[#0F1626]">{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-400">Alias</label>
                            <input
                                type="text"
                                required
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                placeholder="e.g. prod-store"
                                className="w-full bg-[#1A233A] border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Secret Payload (JSON)</label>
                        <textarea
                            rows={6}
                            required
                            value={rawPayload}
                            onChange={(e) => setRawPayload(e.target.value)}
                            className="w-full bg-[#0A101C] border border-slate-700/50 rounded-lg px-3 py-3 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Credential'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ── Main Component ────────────────────────────────────────── */
export function CredentialList() {
    const [showModal, setShowModal] = useState(false);
    const { data, loading, error } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const [deleteCredential] = useMutation(DELETE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
    });

    const handleDelete = (id: string) => {
        if (confirm('Delete this credential permanently?')) {
            deleteCredential({ variables: { id } });
        }
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Platform Credentials</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage encrypted platform API credentials</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-[0_0_12px_rgba(79,149,255,0.3)] flex items-center gap-2 text-sm"
                >
                    <Plus className="h-4 w-4" /> Add Credential
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading...
                </div>
            ) : error ? (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-sm text-red-400">
                    {error.message}
                </div>
            ) : credentials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-[#131B2C]/60 border-2 border-dashed border-slate-800 rounded-xl text-center space-y-4">
                    <KeyRound className="h-10 w-10 text-slate-600" />
                    <div>
                        <h3 className="text-base font-semibold text-white">No credentials yet</h3>
                        <p className="text-sm text-slate-500 mt-1">Connect a platform to start orchestrating</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all"
                    >
                        Add Credential
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {credentials.map((c) => (
                        <CredentialCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {/* Security Notice */}
            <div className="bg-[#131B2C]/40 border border-slate-800/60 rounded-xl p-4 flex items-center gap-3">
                <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                <p className="text-xs text-slate-500">
                    All credentials are encrypted using AES-256-GCM before storage.
                </p>
            </div>

            {showModal && <AddCredentialModal onClose={() => setShowModal(false)} />}
        </div>
    );
}
