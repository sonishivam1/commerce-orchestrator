'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { CREATE_JOB } from '@/lib/graphql/mutations';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import {
    ArrowLeft,
    Loader2,
    KeyRound,
    ChevronRight,
    Check,
    Zap,
    Globe,
    Database,
    Share2,
    ShieldCheck,
    ArrowRight,
    Bug,
    Shuffle,
    Copy,
    Download,
    ChevronDown
} from 'lucide-react';

/* ── Stepper ─────────────────────────────────────────────── */
const STEPS = [
    { number: 1, label: 'Job Type' },
    { number: 2, label: 'Credentials' },
    { number: 3, label: 'Review & Launch' },
];

/* ── Job Types ───────────────────────────────────────────── */
const JOB_TYPES = [
    {
        id: 'SCRAPE_IMPORT',
        title: 'SCRAPE_IMPORT',
        description: 'Extract from public website URL → Target Platform',
        icon: Bug,
        bgClass: 'bg-purple-500/10 hover:bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        activeBorder: 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
        iconColor: 'text-purple-400',
    },
    {
        id: 'CROSS_PLATFORM_MIGRATION',
        title: 'CROSS_PLATFORM_MIGRATION',
        description: 'Source Platform → Canonical → Target Platform',
        icon: Shuffle,
        bgClass: 'bg-blue-500/10 hover:bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        activeBorder: 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        iconColor: 'text-blue-400',
    },
    {
        id: 'PLATFORM_CLONE',
        title: 'PLATFORM_CLONE',
        description: 'Clone schema + entities to new environment',
        icon: Copy,
        bgClass: 'bg-indigo-500/10 hover:bg-indigo-500/20',
        borderColor: 'border-indigo-500/30',
        activeBorder: 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]',
        iconColor: 'text-indigo-400',
    },
    {
        id: 'EXPORT',
        title: 'EXPORT',
        description: 'Platform → Canonical → CSV/JSONL',
        icon: Download,
        bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        activeBorder: 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        iconColor: 'text-emerald-400',
    },
];

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function NewJobForm() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [kind, setKind] = useState('SCRAPE_IMPORT');
    const [sourceCredentialId, setSourceCredentialId] = useState('');
    const [targetCredentialId, setTargetCredentialId] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isScrape = kind === 'SCRAPE_IMPORT';

    const { data: credData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);
    const credentials = credData?.credentials ?? [];

    const [createJob, { loading }] = useMutation(CREATE_JOB, {
        refetchQueries: [GET_JOBS],
        onCompleted() { router.push('/jobs'); },
        onError(err) { setError(err.message); },
    });

    const handleNext = () => { if (step < 3) setStep(step + 1); };
    const handleBack = () => { if (step > 1) setStep(step - 1); };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        createJob({
            variables: {
                input: {
                    kind,
                    sourceCredentialId: isScrape ? undefined : sourceCredentialId,
                    targetCredentialId,
                    sourceUrl: isScrape ? sourceUrl : undefined,
                },
            },
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Header */}
            <div>
                <nav className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => router.push('/jobs')}>Jobs Dashboard</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">Create New Job</span>
                </nav>
                <h1 className="text-4xl font-black tracking-tighter text-white">Create New Job</h1>
            </div>

            {/* Premium Chevron Stepper */}
            <div className="flex items-center w-full bg-[#1E293B]/40 border border-white/5 rounded-2xl overflow-hidden p-1.5 shadow-2xl">
                {STEPS.map((s, idx) => {
                    const isActive = step === s.number;
                    const isDone = step > s.number;
                    const isLast = idx === STEPS.length - 1;

                    return (
                        <div key={s.number} className="flex-1 flex items-center relative h-12">
                            <div className={cn(
                                "flex-1 flex items-center justify-center gap-3 px-6 h-full text-xs font-extrabold tracking-widest uppercase transition-all duration-300 rounded-xl relative z-10",
                                isActive ? "bg-primary text-white shadow-xl" : isDone ? "text-primary bg-primary/10" : "text-slate-500"
                            )}>
                                <span className={cn(
                                    "flex items-center justify-center h-5 w-5 rounded-full border-2 text-[10px] font-black",
                                    isActive ? "border-white bg-white text-primary" : isDone ? "border-primary bg-primary text-white" : "border-slate-700 bg-slate-800 text-slate-500"
                                )}>
                                    {isDone ? <Check className="h-3 w-3 " strokeWidth={4} /> : s.number}
                                </span>
                                {s.label}
                            </div>
                            {!isLast && (
                                <div className="absolute right-0 translate-x-1/2 z-20">
                                    <div className="h-4 w-4 rotate-45 border-t border-r border-slate-700 bg-[#1E293B]/40 hidden md:block" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step Content Container */}
            <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                
                {/* ── Step 1: Job Type Selection ── */}
                {step === 1 && (
                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {JOB_TYPES.map((type) => {
                                const isSelected = kind === type.id;
                                const Icon = type.icon;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => setKind(type.id)}
                                        className={cn(
                                            "relative flex flex-col items-start text-left p-8 rounded-3xl border-2 transition-all duration-300 group",
                                            type.bgClass,
                                            isSelected ? type.activeBorder : type.borderColor + " border-opacity-50"
                                        )}
                                    >
                                        <div className="relative mb-6">
                                            <div className={cn(
                                                "h-16 w-16 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300",
                                                isSelected ? "bg-white/10" : "bg-white/[0.03]"
                                            )}>
                                                <Icon className={cn("h-8 w-8", type.iconColor)} />
                                            </div>
                                            {isSelected && (
                                                <div className="absolute -top-2 -right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center border-2 border-[#1E293B] animate-in zoom-in-50">
                                                    <Check className="h-3 w-3 text-white" strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-white mb-2 tracking-tight uppercase">{type.title.replace(/_/g, ' ')}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed font-medium">{type.description}</p>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-8 mt-4 border-t border-white/5">
                            <button
                                onClick={handleNext}
                                className="bg-primary hover:bg-primary/90 text-white font-extrabold px-8 py-4 rounded-2xl transition-all flex items-center gap-3 text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95"
                            >
                                Next: Configure Credentials 
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Configuration ── */}
                {step === 2 && (
                    <div className="p-10 space-y-10">
                        <div className="space-y-8">
                            {isScrape ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Source URL</label>
                                    <div className="relative">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                        <input
                                            type="url"
                                            required
                                            value={sourceUrl}
                                            onChange={(e) => setSourceUrl(e.target.value)}
                                            placeholder="https://your-public-website.com"
                                            className="w-full bg-[#0F172A]/60 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Source Platform Credentials</label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                        <select
                                            required
                                            value={sourceCredentialId}
                                            onChange={(e) => setSourceCredentialId(e.target.value)}
                                            className="w-full bg-[#0F172A]/60 border border-white/5 rounded-2xl pl-12 pr-10 py-4 text-sm text-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>Select source platform...</option>
                                            {credentials.map((c) => (
                                                <option key={c.id} value={c.id} className="bg-[#1E293B]">{c.alias} ({c.platform})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Target Platform Credentials</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                    <select
                                        required
                                        value={targetCredentialId}
                                        onChange={(e) => setTargetCredentialId(e.target.value)}
                                        className="w-full bg-[#0F172A]/60 border border-white/5 rounded-2xl pl-12 pr-10 py-4 text-sm text-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select target endpoint...</option>
                                        {credentials.map((c) => (
                                            <option key={c.id} value={c.id} className="bg-[#1E293B]">{c.alias} ({c.platform})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-10 border-t border-white/5">
                            <button onClick={handleBack} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 text-slate-300 text-sm font-extrabold hover:bg-white/10 transition-all hover:text-white">
                                <ArrowLeft className="h-5 w-5" /> Back
                            </button>
                            <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-white font-extrabold px-8 py-4 rounded-2xl transition-all flex items-center gap-3 text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95">
                                Review & Launch <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Review ── */}
                {step === 3 && (
                    <div className="p-10 space-y-10">
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 ml-1">Pipeline Validation</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Process Kind</p>
                                    <p className="text-lg font-extrabold text-white">{kind.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Environment</p>
                                    <p className="text-lg font-extrabold text-emerald-400">
                                        {credentials.find(c => c.id === targetCredentialId)?.alias || 'Unconfigured'}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{isScrape ? 'Primary Resource Link' : 'Source Node'}</p>
                                <p className="text-sm font-mono text-primary bg-primary/5 p-4 rounded-2xl border border-primary/10 break-all">
                                    {isScrape ? sourceUrl : credentials.find(c => c.id === sourceCredentialId)?.alias || 'System direct'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-6 flex gap-4">
                            <div className="h-10 w-10 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0 border border-amber-400/20">
                                <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Pre-Launch Warning</p>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Initiating this pipeline will trigger automated resource provisioning. The system will perform an initial connection handshake before proceeding to the synchronization stage.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-400 font-bold border-l-4 border-l-red-500 animate-in shake-1">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-between pt-10 border-t border-white/5">
                            <button onClick={handleBack} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 text-slate-300 text-sm font-extrabold hover:bg-white/10 transition-all hover:text-white">
                                <ArrowLeft className="h-5 w-5" /> Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="bg-emerald-500 hover:bg-emerald-400 text-white font-black px-10 py-4 rounded-2xl transition-all flex items-center gap-3 text-sm disabled:opacity-50 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-white" />}
                                {loading ? 'Provisioning Workers...' : 'Initialize Pipeline'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

