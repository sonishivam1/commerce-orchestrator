'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { STORE_CREDENTIAL, DELETE_CREDENTIAL } from '@/lib/graphql/mutations';
import { 
    KeyRound, 
    Plus, 
    Trash2, 
    Loader2, 
    Server, 
    ShieldCheck, 
    Lock, 
    Search, 
    Filter, 
    ChevronDown, 
    Settings2,
    CheckCircle2,
    Globe,
    Cpu,
    ExternalLink,
    Zap
} from 'lucide-react';

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

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ── Platform Logo ─────────────────────────────────────────── */
function PlatformLogo({ platform }: { platform: string }) {
    if (platform === 'COMMERCETOOLS') {
        return (
            <div className="h-10 w-10 shrink-0 bg-[#3BA4F5]/10 rounded-xl flex items-center justify-center border border-[#3BA4F5]/20">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[#3BA4F5] to-[#1A73E8] flex items-center justify-center">
                    <span className="text-white font-black text-[10px]">CT</span>
                </div>
            </div>
        );
    }
    if (platform === 'SHOPIFY') {
        return (
            <div className="h-10 w-10 shrink-0 bg-[#96BF48]/10 rounded-xl flex items-center justify-center border border-[#96BF48]/20">
                <div className="h-6 w-6 rounded-md bg-[#96BF48] flex items-center justify-center">
                    <span className="text-white font-black text-[10px]">S</span>
                </div>
            </div>
        );
    }
    return (
        <div className="h-10 w-10 shrink-0 bg-slate-800 rounded-xl flex items-center justify-center border border-white/5">
            <Server className="h-5 w-5 text-slate-500" />
        </div>
    );
}

/* ── Credential Card ───────────────────────────────────────── */
function CredentialCard({ credential, onDelete }: { credential: Credential; onDelete: (id: string) => void }) {
    return (
        <div className="group bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-6 transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.04] shadow-xl">
            <div className="flex items-center gap-4">
                <PlatformLogo platform={credential.platform} />
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-white tracking-tight">{credential.alias}</h3>
                        <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                            <div className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">Active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> us-central1</span>
                        <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> {credential.platform.toLowerCase()}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-5 px-6 border-l border-white/5">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Project Key</p>
                    <p className="font-mono text-[11px] text-slate-300 leading-none tracking-tight">ucp-demo-orchestrator-v2</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button className="h-9 px-4 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" /> Connect
                </button>
                <button
                    onClick={() => onDelete(credential.id)}
                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
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
    const [formData, setFormData] = useState<Record<string, string>>({
        projectKey: '',
        clientId: '',
        clientSecret: '',
        scopes: '',
        authUrl: 'https://auth.us-central1.gcp.commercetools.com',
        apiUrl: 'https://api.us-central1.gcp.commercetools.com',
    });
    const [error, setError] = useState<string | null>(null);

    const [storeCredential, { loading }] = useMutation(STORE_CREDENTIAL, {
        refetchQueries: [GET_CREDENTIALS],
        onCompleted: onClose,
        onError(err) { setError(err.message); },
    });

    const handlePlatformChange = (p: string) => {
        setPlatform(p);
        if (p === 'COMMERCETOOLS') {
            setFormData({
                projectKey: '',
                clientId: '',
                clientSecret: '',
                scopes: '',
                authUrl: 'https://auth.us-central1.gcp.commercetools.com',
                apiUrl: 'https://api.us-central1.gcp.commercetools.com',
            });
        } else if (p === 'SHOPIFY') {
            setFormData({ shopName: '', accessToken: '' });
        } else if (p === 'BIGCOMMERCE') {
            setFormData({ storeHash: '', accessToken: '' });
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Ensure all fields are filled
        if (Object.values(formData).some(v => !v)) {
            setError('Please facilitate all required secure parameters.');
            return;
        }

        const rawPayload = JSON.stringify(formData);
        storeCredential({ variables: { input: { platform, alias, rawPayload } } });
    };

    const renderFields = () => {
        const fields = Object.keys(formData);
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {fields.map((key) => (
                    <div key={key} className={cn("space-y-3", (key === 'apiUrl' || key === 'authUrl') && "md:col-span-2")}>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <div className="relative group">
                            <input
                                type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? 'password' : 'text'}
                                required
                                value={formData[key]}
                                onChange={(e) => handleInputChange(key, e.target.value)}
                                placeholder={
                                    key === 'projectKey' ? 'ucp-demo' : 
                                    key === 'scopes' ? 'manage_project:ucp-demo' :
                                    `Enter ${key}...`
                                }
                                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium pr-12"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-slate-900/50 flex items-center justify-center border border-white/5 opacity-40 group-focus-within:opacity-100 transition-opacity">
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-4">
            <div className="w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/[0.01]">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase">Register Provider</h2>
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connect platform node to telemetry mesh</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 border border-white/5"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/[0.02] rounded-[32px] border border-white/5">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Platform Architecture</label>
                            <div className="relative">
                                <select
                                    value={platform}
                                    onChange={(e) => handlePlatformChange(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer pr-10"
                                >
                                    {PLATFORM_OPTIONS.map((p) => (
                                        <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Instance Alias</label>
                            <input
                                type="text"
                                required
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                placeholder="e.g. core-commerce-v3"
                                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Secure Metadata</label>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3" /> End-to-End Encrypted
                            </span>
                        </div>
                        <div className="p-8 bg-black/40 rounded-[32px] border border-white/5 shadow-inner">
                            {renderFields()}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-xs text-red-400 font-black uppercase tracking-widest border-l-4 border-l-red-500 animate-in shake-1">
                            🚨 {error}
                        </div>
                    )}

                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all border border-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-primary hover:bg-blue-500 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <Zap className="h-4 w-4 fill-current" />
                                    Synchronize Node
                                </>
                            )}
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
        if (confirm('Permanently decommission this endpoint?')) {
            deleteCredential({ variables: { id } });
        }
    };

    const credentials = data?.credentials ?? [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Header */}
            <div>
                <nav className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors">Orchestrator</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">Credentials Manager</span>
                </nav>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Platform Credentials</h1>
                        <p className="text-sm font-medium text-slate-400">Securely manage and bridge your commerce endpoints</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Filter alias..."
                                className="bg-[#1E293B]/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-64 transition-all"
                            />
                        </div>
                        <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <Filter className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95"
                        >
                            <Plus className="h-4 w-4" /> Add Provider
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Polling Mesh State...</span>
                </div>
            ) : error ? (
                <div className="rounded-3xl bg-red-500/10 border border-red-500/20 p-10 text-center animate-in shake-1">
                    <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Handshake Failed</h3>
                    <p className="text-sm text-red-400/80 mb-6 font-medium">{error.message}</p>
                    <button className="px-8 py-3 bg-red-500 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors">
                        Revalidate Session
                    </button>
                </div>
            ) : credentials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[40px] text-center space-y-6">
                    <div className="h-20 w-20 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
                        <KeyRound className="h-10 w-10 text-slate-500" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tighter">Vault is Empty</h3>
                        <p className="text-sm font-medium text-slate-500 mt-2">Begin connectivity steps to register your first platform node</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white font-black px-8 py-4 rounded-2xl text-[13px] uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:scale-[1.05]"
                    >
                        Register New Provider
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {credentials.map((c) => (
                        <CredentialCard key={c.id} credential={c} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {/* Security Notice */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="space-y-0.5">
                    <p className="text-xs font-black text-emerald-500 uppercase tracking-widest leading-none">Military-Grade Encryption</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                        All platform identifiers and secret keys are stored within a secure, isolated vault using AES-256-GCM. 
                        Keys never leave the internal VPC mesh.
                    </p>
                </div>
            </div>

            {showModal && <AddCredentialModal onClose={() => setShowModal(false)} />}
        </div>
    );
}

