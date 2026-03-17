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
        gradient: 'from-purple-900/60 to-purple-950/80',
        border: 'border-purple-600/40',
        selectedBorder: 'border-purple-500',
        iconBg: 'bg-purple-600/30',
        iconColor: 'text-purple-300',
    },
    {
        id: 'CROSS_PLATFORM_MIGRATION',
        title: 'CROSS_PLATFORM_MIGRATION',
        description: 'Source Platform → Canonical → Target Platform',
        icon: ArrowRight,
        gradient: 'from-blue-900/50 to-blue-950/80',
        border: 'border-blue-600/40',
        selectedBorder: 'border-blue-500',
        iconBg: 'bg-blue-600/30',
        iconColor: 'text-blue-300',
    },
    {
        id: 'PLATFORM_CLONE',
        title: 'PLATFORM_CLONE',
        description: 'Clone schema + entities to new environment',
        icon: Database,
        gradient: 'from-indigo-900/50 to-indigo-950/80',
        border: 'border-indigo-600/40',
        selectedBorder: 'border-indigo-500',
        iconBg: 'bg-indigo-600/30',
        iconColor: 'text-indigo-300',
    },
    {
        id: 'EXPORT',
        title: 'EXPORT',
        description: 'Platform → Canonical → CSV/JSONL',
        icon: Share2,
        gradient: 'from-emerald-900/50 to-emerald-950/80',
        border: 'border-emerald-600/40',
        selectedBorder: 'border-emerald-500',
        iconBg: 'bg-emerald-600/30',
        iconColor: 'text-emerald-300',
    },
];

interface Credential {
    id: string;
    platform: string;
    alias: string;
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
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Page Title */}
            <h1 className="text-2xl font-bold text-white tracking-tight">Create New Job</h1>

            {/* ── Stepper ── */}
            <div className="flex items-center bg-[#131B2C] border border-slate-800/80 rounded-xl overflow-hidden">
                {STEPS.map((s, idx) => {
                    const isActive = step === s.number;
                    const isDone = step > s.number;
                    const isLast = idx === STEPS.length - 1;

                    return (
                        <div key={s.number} className="flex items-center flex-1">
                            <div
                                className={`flex items-center justify-center gap-2.5 flex-1 py-3.5 text-sm font-semibold transition-all ${
                                    isActive
                                        ? 'bg-primary text-white'
                                        : isDone
                                        ? 'text-slate-400'
                                        : 'text-slate-500'
                                }`}
                            >
                                <div className={`h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold ${
                                    isActive ? 'bg-white text-primary' : isDone ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500'
                                }`}>
                                    {isDone ? <Check className="h-3 w-3" /> : s.number}
                                </div>
                                {s.number}. {s.label}
                            </div>
                            {!isLast && (
                                <div className="w-px h-10 bg-slate-800 shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Step 1: Job Type ── */}
            {step === 1 && (
                <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {JOB_TYPES.map((type) => {
                            const isSelected = kind === type.id;
                            const Icon = type.icon;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setKind(type.id)}
                                    className={`relative flex flex-col items-start text-left p-6 rounded-xl border-2 transition-all duration-200 bg-gradient-to-br ${type.gradient} ${
                                        isSelected ? type.selectedBorder + ' ring-1 ring-white/10' : type.border + ' hover:border-opacity-70'
                                    }`}
                                >
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${type.iconBg}`}>
                                        <Icon className={`h-5 w-5 ${type.iconColor}`} />
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1.5 tracking-wide">{type.title}</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">{type.description}</p>
                                    {isSelected && (
                                        <div className="absolute top-3 right-3 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                                            <Check className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-800/80">
                        <button
                            onClick={handleNext}
                            className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm shadow-[0_0_12px_rgba(79,149,255,0.3)]"
                        >
                            Next: Configure Credentials <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Credentials ── */}
            {step === 2 && (
                <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-6 space-y-6">
                    <div className="space-y-5">
                        {isScrape ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-purple-400" /> Source URL
                                </label>
                                <input
                                    type="url"
                                    required
                                    value={sourceUrl}
                                    onChange={(e) => setSourceUrl(e.target.value)}
                                    placeholder="https://your-source-store.com"
                                    className="w-full bg-[#0A101C] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <KeyRound className="h-4 w-4 text-amber-400" /> Source Platform Credentials
                                </label>
                                <select
                                    required
                                    value={sourceCredentialId}
                                    onChange={(e) => setSourceCredentialId(e.target.value)}
                                    className="w-full bg-[#0A101C] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                                >
                                    <option value="" disabled>Select source credential...</option>
                                    {credentials.map((c) => (
                                        <option key={c.id} value={c.id} className="bg-[#131B2C]">{c.alias} — {c.platform}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Target Platform Credentials
                            </label>
                            <select
                                required
                                value={targetCredentialId}
                                onChange={(e) => setTargetCredentialId(e.target.value)}
                                className="w-full bg-[#0A101C] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                            >
                                <option value="" disabled>Select target credential...</option>
                                {credentials.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-[#131B2C]">{c.alias} — {c.platform}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-800/80">
                        <button onClick={handleBack} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm shadow-[0_0_12px_rgba(79,149,255,0.3)]">
                            Next: Review & Launch <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Review & Launch ── */}
            {step === 3 && (
                <div className="bg-[#131B2C] border border-slate-800/80 rounded-xl p-6 space-y-6">
                    <div className="bg-[#1A233A] rounded-lg p-5 border border-slate-800/60 space-y-4">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Pipeline Configuration</p>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Job Type</p>
                                <p className="text-sm font-bold text-white">{kind.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Target</p>
                                <p className="text-sm font-bold text-emerald-400">
                                    {credentials.find(c => c.id === targetCredentialId)?.alias || 'Not selected'}
                                </p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-800/60">
                            <p className="text-xs text-slate-500 mb-1">{isScrape ? 'Source URL' : 'Source Platform'}</p>
                            <p className="text-sm font-mono text-primary break-all">
                                {isScrape ? sourceUrl : credentials.find(c => c.id === sourceCredentialId)?.alias || 'Direct Upload'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4 flex gap-3">
                        <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wide mb-1">Notice</p>
                            <p className="text-xs text-amber-200/70 leading-relaxed">
                                Starting this job will allocate compute resources in the worker pool. You can monitor progress in real-time once the pipeline reaches the Normalize stage.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-slate-800/80">
                        <button onClick={handleBack} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 text-sm disabled:opacity-50 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Launching...' : 'Launch Job'} {!loading && <Check className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
