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
    Check,
    Zap,
    Globe,
    ShieldCheck,
    ArrowRight,
    Bug,
    Shuffle,
    Copy,
    Download,
    ChevronDown,
    Package,
    Tag,
    Users,
    ShoppingCart,
} from 'lucide-react';

/* ── Stepper ─────────────────────────────────────────────── */
const STEPS = [
    { number: 1, label: 'Job Type' },
    { number: 2, label: 'Entity Types' },
    { number: 3, label: 'Credentials' },
    { number: 4, label: 'Review & Launch' },
];

/* ── Job Types ───────────────────────────────────────────── */
const JOB_TYPES = [
    {
        id: 'SCRAPE_IMPORT',
        title: 'SCRAPE IMPORT',
        description: 'Extract product data from a public website URL → Target Platform',
        icon: Bug,
        bgClass: 'bg-purple-500/10 hover:bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        activeBorder: 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
        iconColor: 'text-purple-400',
    },
    {
        id: 'CROSS_PLATFORM_MIGRATION',
        title: 'CROSS PLATFORM MIGRATION',
        description: 'Migrate data from one eCommerce platform to another via Canonical format',
        icon: Shuffle,
        bgClass: 'bg-blue-500/10 hover:bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        activeBorder: 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        iconColor: 'text-blue-400',
    },
    {
        id: 'PLATFORM_CLONE',
        title: 'PLATFORM CLONE',
        description: 'Clone an entire store (schema + entities) to a new environment',
        icon: Copy,
        bgClass: 'bg-indigo-500/10 hover:bg-indigo-500/20',
        borderColor: 'border-indigo-500/30',
        activeBorder: 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]',
        iconColor: 'text-indigo-400',
    },
    {
        id: 'EXPORT',
        title: 'EXPORT',
        description: 'Extract platform data and export to CSV/JSONL file',
        icon: Download,
        bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        borderColor: 'border-emerald-500/30',
        activeBorder: 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        iconColor: 'text-emerald-400',
    },
];

/* ── Entity Types ────────────────────────────────────────── */
const ENTITY_TYPES = [
    {
        id: 'PRODUCTS',
        title: 'Products',
        description: 'Product catalog with variants, pricing, images, and inventory',
        icon: Package,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        activeBorder: 'border-blue-500',
    },
    {
        id: 'CATEGORIES',
        title: 'Categories',
        description: 'Product categories / collections and their hierarchy',
        icon: Tag,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        activeBorder: 'border-purple-500',
    },
    {
        id: 'CUSTOMERS',
        title: 'Customers',
        description: 'Customer accounts, addresses, and contact information',
        icon: Users,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        activeBorder: 'border-emerald-500',
    },
    {
        id: 'ORDERS',
        title: 'Orders',
        description: 'Historical orders and their line items',
        icon: ShoppingCart,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        activeBorder: 'border-amber-500',
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
    const [kind, setKind] = useState('CROSS_PLATFORM_MIGRATION');
    const [entityTypes, setEntityTypes] = useState<string[]>(['PRODUCTS']);
    const [sourceCredentialId, setSourceCredentialId] = useState('');
    const [targetCredentialId, setTargetCredentialId] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isScrape = kind === 'SCRAPE_IMPORT';
    const isExport = kind === 'EXPORT';

    const { data: credData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);
    const credentials = credData?.credentials ?? [];

    const [createJob, { loading }] = useMutation(CREATE_JOB, {
        refetchQueries: [GET_JOBS],
        onCompleted() { router.push('/jobs'); },
        onError(err) { setError(err.message); },
    });

    const toggleEntityType = (id: string) => {
        setEntityTypes(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleNext = () => {
        if (step === 1 && isScrape) {
            // Scrape import only supports products — skip entity type step
            setEntityTypes(['PRODUCTS']);
            setStep(3);
            return;
        }
        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        if (step === 3 && isScrape) {
            // Skip entity type step when going back from scrape
            setStep(1);
            return;
        }
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (entityTypes.length === 0) {
            setError('Please select at least one entity type to migrate.');
            return;
        }
        setError(null);
        createJob({
            variables: {
                input: {
                    kind,
                    entityTypes,
                    sourceCredentialId: isScrape ? undefined : sourceCredentialId || undefined,
                    targetCredentialId: isExport ? undefined : (targetCredentialId || undefined),
                    sourceUrl: isScrape ? sourceUrl : undefined,
                },
            },
        });
    };

    // Step numbers shown in stepper — scrape skips step 2
    const displayStep = isScrape && step >= 3 ? step - 1 : step;

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

            {/* Stepper */}
            <div className="flex items-center w-full bg-[#1E293B]/40 border border-white/5 rounded-2xl overflow-hidden p-1.5 shadow-2xl">
                {STEPS.filter(s => !isScrape || s.number !== 2).map((s, idx, arr) => {
                    const isActive = step === s.number || (isScrape && step >= 3 && s.number === step + 1) || displayStep === s.number;
                    const isDone = displayStep > (isScrape ? (s.number < 2 ? s.number : s.number - 1) : s.number);
                    const isLast = idx === arr.length - 1;

                    const currentlyActive = isScrape
                        ? (step === 1 && s.number === 1) || (step === 3 && s.number === 3) || (step === 4 && s.number === 4)
                        : step === s.number;
                    const currentlyDone = isScrape
                        ? (step > 1 && s.number === 1) || (step > 3 && s.number === 3)
                        : step > s.number;

                    return (
                        <div key={s.number} className="flex-1 flex items-center relative h-12">
                            <div className={cn(
                                "flex-1 flex items-center justify-center gap-3 px-4 h-full text-xs font-extrabold tracking-widest uppercase transition-all duration-300 rounded-xl relative z-10",
                                currentlyActive ? "bg-primary text-white shadow-xl" : currentlyDone ? "text-primary bg-primary/10" : "text-slate-500"
                            )}>
                                <span className={cn(
                                    "flex items-center justify-center h-5 w-5 rounded-full border-2 text-[10px] font-black",
                                    currentlyActive ? "border-white bg-white text-primary" : currentlyDone ? "border-primary bg-primary text-white" : "border-slate-700 bg-slate-800 text-slate-500"
                                )}>
                                    {currentlyDone ? <Check className="h-3 w-3" strokeWidth={4} /> : s.number}
                                </span>
                                <span className="hidden sm:inline">{s.label}</span>
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

            {/* Step Content */}
            <div className="bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">

                {/* ── Step 1: Job Type ── */}
                {step === 1 && (
                    <div className="p-8 space-y-8">
                        <div>
                            <h2 className="text-xl font-black text-white mb-1">Select Migration Type</h2>
                            <p className="text-sm text-slate-400">Choose how data will flow between platforms</p>
                        </div>
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
                                        <h3 className="text-base font-black text-white mb-2 tracking-tight">{type.title}</h3>
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
                                Next: What to Migrate
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Entity Types ── */}
                {step === 2 && (
                    <div className="p-8 space-y-8">
                        <div>
                            <h2 className="text-xl font-black text-white mb-1">What data do you want to migrate?</h2>
                            <p className="text-sm text-slate-400">Select one or more entity types. Each type runs as a separate pipeline pass.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {ENTITY_TYPES.map((et) => {
                                const isSelected = entityTypes.includes(et.id);
                                const Icon = et.icon;
                                return (
                                    <button
                                        key={et.id}
                                        onClick={() => toggleEntityType(et.id)}
                                        className={cn(
                                            "relative flex items-start gap-4 text-left p-6 rounded-2xl border-2 transition-all duration-200",
                                            et.bg,
                                            isSelected ? et.activeBorder + " shadow-lg" : et.border + " border-opacity-50"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                                            isSelected ? "bg-white/10" : "bg-white/[0.03]"
                                        )}>
                                            <Icon className={cn("h-6 w-6", et.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-black text-white">{et.title}</h3>
                                                {isSelected && (
                                                    <span className="h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                                                        <Check className="h-3 w-3 text-white" strokeWidth={4} />
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">{et.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {entityTypes.length === 0 && (
                            <div className="text-center py-4 text-sm text-amber-400 font-bold">
                                Please select at least one entity type
                            </div>
                        )}

                        <div className="flex justify-between pt-8 border-t border-white/5">
                            <button onClick={handleBack} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 text-slate-300 text-sm font-extrabold hover:bg-white/10 transition-all hover:text-white">
                                <ArrowLeft className="h-5 w-5" /> Back
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={entityTypes.length === 0}
                                className="bg-primary hover:bg-primary/90 text-white font-extrabold px-8 py-4 rounded-2xl transition-all flex items-center gap-3 text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next: Configure Credentials
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Credentials ── */}
                {step === 3 && (
                    <div className="p-10 space-y-10">
                        <div>
                            <h2 className="text-xl font-black text-white mb-1">Configure Connections</h2>
                            <p className="text-sm text-slate-400">
                                {isScrape ? 'Enter the public website URL to scrape' : 'Select your platform credentials'}
                            </p>
                        </div>

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

                            {!isExport && (
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
                            )}

                            {isExport && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Export Mode</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Selected data will be exported to a JSONL file. You can download it from the job detail page once the export completes.
                                    </p>
                                </div>
                            )}
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

                {/* ── Step 4: Review ── */}
                {step === 4 && (
                    <div className="p-10 space-y-10">
                        <div>
                            <h2 className="text-xl font-black text-white mb-1">Pipeline Validation</h2>
                            <p className="text-sm text-slate-400">Review your configuration before launching</p>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Migration Type</p>
                                    <p className="text-lg font-extrabold text-white">{kind.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entity Types</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {entityTypes.map(et => {
                                            const meta = ENTITY_TYPES.find(e => e.id === et);
                                            const Icon = meta?.icon;
                                            return (
                                                <span key={et} className={cn(
                                                    "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border",
                                                    meta?.bg, meta?.border, meta?.color
                                                )}>
                                                    {Icon && <Icon className="h-3 w-3" />}
                                                    {et}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                                {!isScrape && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source</p>
                                        <p className="text-sm font-bold text-white">
                                            {credentials.find(c => c.id === sourceCredentialId)?.alias || 'Not configured'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {credentials.find(c => c.id === sourceCredentialId)?.platform}
                                        </p>
                                    </div>
                                )}
                                {isScrape && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source URL</p>
                                        <p className="text-xs font-mono text-primary bg-primary/5 p-3 rounded-xl border border-primary/10 break-all">{sourceUrl}</p>
                                    </div>
                                )}
                                {!isExport && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target</p>
                                        <p className="text-sm font-bold text-emerald-400">
                                            {credentials.find(c => c.id === targetCredentialId)?.alias || 'Not configured'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {credentials.find(c => c.id === targetCredentialId)?.platform}
                                        </p>
                                    </div>
                                )}
                                {isExport && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output</p>
                                        <p className="text-sm font-bold text-emerald-400">JSONL File</p>
                                        <p className="text-xs text-slate-500">Available for download after completion</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-6 flex gap-4">
                            <div className="h-10 w-10 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0 border border-amber-400/20">
                                <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Pre-Launch Warning</p>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Initiating this pipeline will trigger automated resource provisioning. The system will perform an initial connection handshake before proceeding to the synchronisation stage.
                                    {entityTypes.length > 1 && ` ${entityTypes.length} entity types will be migrated in sequence.`}
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-4 text-sm text-red-400 font-bold border-l-4 border-l-red-500">
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
