import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { CREATE_JOB } from '@/lib/graphql/mutations';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { ArrowLeft, Loader2, Link2, KeyRound, Activity, ChevronRight, Check, Zap, Repeat, Search, Share2, Globe, Database, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
    { number: 1, label: 'Job Type' },
    { number: 2, label: 'Credentials' },
    { number: 3, label: 'Review & Launch' },
];

const JOB_TYPES = [
    {
        id: 'SCRAPE_IMPORT',
        title: 'SCRAPE_IMPORT',
        description: 'Extract from public website URL → Target Platform',
        icon: Globe,
        color: 'from-purple-500/20 to-purple-900/40',
        borderColor: 'border-purple-500/30',
        glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
        iconBg: 'bg-purple-500/20',
        iconColor: 'text-purple-400'
    },
    {
        id: 'CROSS_PLATFORM_MIGRATION',
        title: 'CROSS_PLATFORM_MIGRATION',
        description: 'Source Platform → Canonical → Target Platform',
        icon: Repeat,
        color: 'from-blue-500/20 to-blue-900/40',
        borderColor: 'border-blue-500/30',
        glowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]',
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400'
    },
    {
        id: 'PLATFORM_CLONE',
        title: 'PLATFORM_CLONE',
        description: 'Clone schema + entities to new environment',
        icon: Database,
        color: 'from-indigo-500/20 to-indigo-900/40',
        borderColor: 'border-indigo-500/30',
        glowColor: 'shadow-[0_0_20px_rgba(99,102,241,0.2)]',
        iconBg: 'bg-indigo-500/20',
        iconColor: 'text-indigo-400'
    },
    {
        id: 'EXPORT',
        title: 'EXPORT',
        description: 'Platform → Canonical → CSV/JSONL',
        icon: Share2,
        color: 'from-emerald-500/20 to-emerald-900/40',
        borderColor: 'border-emerald-500/30',
        glowColor: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-400'
    }
];

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

export function NewJobForm() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [kind, setKind] = useState('CROSS_PLATFORM_MIGRATION');
    const [sourceCredentialId, setSourceCredentialId] = useState('');
    const [targetCredentialId, setTargetCredentialId] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isScrape = kind === 'SCRAPE_IMPORT';

    const { data: credData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);
    const credentials = credData?.credentials ?? [];

    const [createJob, { loading }] = useMutation(CREATE_JOB, {
        refetchQueries: [GET_JOBS],
        onCompleted() {
            router.push('/jobs');
        },
        onError(err) {
            setError(err.message);
        },
    });

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

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
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-black text-white tracking-tight">Create New Job</h1>
            </div>

            {/* Stepper Header */}
            <div className="grid grid-cols-3 bg-[#131B2C] border border-white/5 rounded-2xl overflow-hidden p-1 shadow-2xl">
                {STEPS.map((s) => {
                    const isActive = step === s.number;
                    const isDone = step > s.number;
                    
                    return (
                        <div 
                            key={s.number}
                            className={`flex items-center justify-center gap-3 py-4 rounded-xl transition-all duration-300 ${
                                isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'
                            }`}
                        >
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isActive ? 'bg-white text-primary' : isDone ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-600'
                            }`}>
                                {isDone ? <Check className="h-4 w-4" /> : s.number}
                            </div>
                            <span className="text-sm font-bold tracking-wide italic">{s.number}. {s.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Job Type Selection */}
            {step === 1 && (
                <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-10 lg:p-12 shadow-inner space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {JOB_TYPES.map((type) => {
                            const isSelected = kind === type.id;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setKind(type.id)}
                                    className={`relative flex flex-col items-start text-left p-8 rounded-2xl border-2 transition-all duration-500 group ${
                                        isSelected 
                                            ? `${type.borderColor} bg-gradient-to-br ${type.color} ${type.glowColor} scale-[1.02]` 
                                            : 'border-slate-800/40 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-800/40'
                                    }`}
                                >
                                    <div className={`p-4 rounded-xl mb-6 transition-all duration-500 ${type.iconBg} ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>
                                        <type.icon className={`h-8 w-8 ${type.iconColor}`} />
                                    </div>
                                    <h3 className="text-xl font-black text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{type.title}</h3>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{type.description}</p>
                                    
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 h-6 w-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                            <Check className="h-4 w-4 text-white font-bold" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="flex justify-end pt-4 border-t border-white/5">
                        <button 
                            onClick={handleNext}
                            className="bg-primary hover:bg-blue-500 text-white font-black italic px-10 py-4 rounded-2xl transition-all flex items-center gap-3 shadow-xl shadow-primary/30 active:scale-95"
                        >
                            Next: Configure Credentials <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Credentials Selection */}
            {step === 2 && (
                <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-10 lg:p-12 shadow-inner space-y-10">
                    <div className="space-y-10">
                        {isScrape ? (
                            <div className="space-y-4">
                                <label className="text-lg font-bold text-white flex items-center gap-3 italic">
                                    <Globe className="h-6 w-6 text-purple-400" /> Web Scraper Target URL
                                </label>
                                <div className="relative group">
                                    <input
                                        type="url"
                                        required
                                        value={sourceUrl}
                                        onChange={(e) => setSourceUrl(e.target.value)}
                                        placeholder="https://your-competitor-store.com"
                                        className="w-full bg-[#0A101C] border border-slate-700 rounded-2xl px-6 py-5 text-lg font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-2xl"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold uppercase tracking-wider group-focus-within:text-primary transition-colors">Endpoint</div>
                                </div>
                                <p className="text-xs text-slate-500 italic pl-2">The Playwright cluster will perform a deep crawl of this URL to extract product, category, and asset data.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="text-lg font-bold text-white flex items-center gap-3 italic">
                                    <KeyRound className="h-6 w-6 text-amber-500" /> Source Platform Credentials
                                </label>
                                <select
                                    required
                                    value={sourceCredentialId}
                                    onChange={(e) => setSourceCredentialId(e.target.value)}
                                    className="w-full bg-[#0A101C] border border-slate-700 rounded-2xl px-6 py-5 text-lg font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-2xl appearance-none"
                                >
                                    <option value="" disabled>Select source platform vault...</option>
                                    {credentials.map((c) => (
                                        <option key={c.id} value={c.id} className="bg-[#131B2C] py-2">{c.alias} — {c.platform}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-lg font-bold text-white flex items-center gap-3 italic">
                                <ShieldCheck className="h-6 w-6 text-emerald-500" /> Target Platform Credentials
                            </label>
                            <select
                                required
                                value={targetCredentialId}
                                onChange={(e) => setTargetCredentialId(e.target.value)}
                                className="w-full bg-[#0A101C] border border-slate-700 rounded-2xl px-6 py-5 text-lg font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-2xl appearance-none"
                            >
                                <option value="" disabled>Select target environment vault...</option>
                                {credentials.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-[#131B2C] py-2">{c.alias} — {c.platform}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex justify-between pt-8 border-t border-white/5">
                        <button 
                            onClick={handleBack}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold italic px-8 py-4 rounded-2xl transition-all flex items-center gap-3"
                        >
                            <ArrowLeft className="h-5 w-5" /> Back
                        </button>
                        <button 
                            onClick={handleNext}
                            className="bg-primary hover:bg-blue-500 text-white font-black italic px-10 py-4 rounded-2xl transition-all flex items-center gap-3 shadow-xl shadow-primary/30"
                        >
                            Next: Review Pipeline <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Review & Launch */}
            {step === 3 && (
                <div className="bg-[#131B2C] border border-white/5 rounded-3xl p-10 lg:p-12 shadow-inner space-y-10">
                    <div className="space-y-8">
                        <div className="bg-[#1A233A] rounded-2xl p-8 border border-white/5 space-y-6">
                            <h3 className="text-xs uppercase font-black tracking-widest text-slate-500">Pipeline Configuration</h3>
                            
                            <div className="grid grid-cols-2 gap-10">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Job Type</p>
                                    <p className="text-xl font-bold text-white">{kind.replace(/_/g, ' ')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Target</p>
                                    <p className="text-xl font-bold text-emerald-400">
                                        {credentials.find(c => c.id === targetCredentialId)?.alias || 'Unspecified'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-white/5">
                                <p className="text-sm text-slate-500 mb-2">{isScrape ? 'Source URL' : 'Source Platform'}</p>
                                <p className="text-lg font-mono text-primary break-all">
                                    {isScrape ? sourceUrl : credentials.find(c => c.id === sourceCredentialId)?.alias || 'Direct Upload'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-6 flex gap-4 items-start">
                            <Zap className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-bold text-amber-500 uppercase tracking-wide">Notice</p>
                                <p className="text-sm text-amber-200/70 leading-relaxed">Starting this job will allocate compute resources in the worker pool. You can monitor the progress in real-time once the pipeline reaches the Normalize stage.</p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-400 font-bold italic">
                            Error: {error}
                        </div>
                    )}

                    <div className="flex justify-between pt-8 border-t border-white/5">
                        <button 
                            onClick={handleBack}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold italic px-8 py-4 rounded-2xl transition-all flex items-center gap-3"
                        >
                            <ArrowLeft className="h-5 w-5" /> Back
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white font-black italic px-12 py-4 rounded-2xl transition-all flex items-center gap-3 shadow-xl shadow-emerald-500/30 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                            {loading ? 'Bootstrapping...' : 'Execute Launch Strategy'} <Check className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
