import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import { KeyRound, Plus, Trash2, Loader2, Server, Globe, ExternalLink, ShieldCheck, Box } from 'lucide-react';

const PLATFORM_OPTIONS = [
    { value: 'COMMERCETOOLS', label: 'Commercetools', logo: 'https://images.ctfassets.net/lp9u75e533v8/4HTo3FoyS2k68u88O2S68/888636830768c8886888688868886888/commercetools_logo.svg' },
    { value: 'SHOPIFY', label: 'Shopify', logo: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.svg' },
    { value: 'BIGCOMMERCE', label: 'BigCommerce', logo: 'https://storage.googleapis.com/proudcity/meadowsca/uploads/2021/05/big-commerce-logo-png-transparent.png' },
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
    // Get platform logo
    const getLogo = (platform: string) => {
        if (platform === 'COMMERCETOOLS') return <div className="h-10 w-10 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-lg">CT</div>;
        if (platform === 'SHOPIFY') return <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-lg">S</div>;
        if (platform === 'BIGCOMMERCE') return <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-lg">B</div>;
        return <div className="h-10 w-10 bg-slate-700 rounded-lg flex items-center justify-center"><Server className="h-5 w-5 text-white" /></div>;
    };

    return (
        <div className="bg-[#131B2C]/80 border border-white/5 rounded-[32px] p-8 space-y-6 shadow-2xl backdrop-blur-md hover:ring-2 hover:ring-primary/20 transition-all group">
            <div className="flex items-center justify-between">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
                    {getLogo(credential.platform)}
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                </div>
            </div>
            
            <div className="space-y-1">
                <h3 className="text-xl font-black text-white italic tracking-tight truncate">{credential.alias}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{credential.platform}</p>
            </div>

            <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Added Jan 15, 2024</p>
            </div>

            <div className="flex items-center gap-3 pt-4">
                <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black italic py-3 rounded-2xl transition-all uppercase tracking-widest">
                    Use in Job
                </button>
                <button 
                    onClick={() => onDelete(credential.id)}
                    className="p-3 bg-red-500/10 border border-red-500/10 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
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
            JSON.parse(rawPayload); 
        } catch {
            setError('Payload must be valid JSON');
            return;
        }
        storeCredential({ variables: { input: { platform, alias, rawPayload } } });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-300 px-4">
            <div className="w-full max-w-xl bg-[#0A101C] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="p-10 lg:p-12 space-y-10">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter">Add Credential</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Secure vault storage</p>
                        </div>
                        <button onClick={onClose} className="h-12 w-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:bg-white/10 italic font-black">✕</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Platform</label>
                                <select
                                    value={platform}
                                    onChange={(e) => handlePlatformChange(e.target.value)}
                                    className="w-full bg-[#131B2C] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none italic"
                                >
                                    {PLATFORM_OPTIONS.map((p) => (
                                        <option key={p.value} value={p.value} className="bg-[#0A101C]">{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Alias</label>
                                <input
                                    type="text"
                                    required
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                    placeholder="e.g. Production Store"
                                    className="w-full bg-[#131B2C] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all italic placeholder:text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Secret Payload (JSON)</label>
                            <textarea
                                rows={6}
                                required
                                value={rawPayload}
                                onChange={(e) => setRawPayload(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-5 text-sm font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none shadow-inner"
                            />
                        </div>

                        {error && (
                            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-500 font-black italic">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black italic py-5 rounded-[24px] uppercase tracking-widest transition-all">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-primary hover:bg-blue-500 text-white font-black italic py-5 rounded-[24px] uppercase tracking-widest transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {loading ? 'Encrypting...' : 'Save Credential'}
                            </button>
                        </div>
                    </form>
                </div>
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
        if (confirm('Delete this credential permanently?')) {
            deleteCredential({ variables: { id } });
        }
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Platform Credentials</h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Manage encrypted platform API credentials</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary hover:bg-blue-500 text-white font-black italic px-8 py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center gap-3 uppercase tracking-widest text-xs"
                >
                    <Plus className="h-4 w-4" /> Add Credential
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" /> Unlocking vault...
                </div>
            ) : credentials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 bg-[#131B2C]/50 border-2 border-dashed border-white/5 rounded-[40px] text-center space-y-6">
                    <div className="h-20 w-20 bg-primary/10 rounded-[32px] flex items-center justify-center shadow-inner">
                        <KeyRound className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white italic tracking-tight">Your vault is empty</h3>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2 italic">Connect a platform to start orchestrating</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-4 bg-primary hover:bg-blue-500 text-white font-black italic px-10 py-5 rounded-[24px] transition-all shadow-xl shadow-primary/20"
                    >
                        Initialize New Credential
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {credentials.map((c) => (
                        <CredentialCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            <div className="bg-[#131B2C]/30 border border-white/5 rounded-[24px] p-6 flex items-center gap-5 backdrop-blur-md">
                <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] italic">
                    All credentials are encrypted using AES-256-GCM before storage in our distributed vault.
                </p>
            </div>

            {showModal && <AddCredentialModal onClose={() => setShowModal(false)} />}
        </div>
    );
}
