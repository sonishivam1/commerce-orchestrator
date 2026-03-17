'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { CREATE_JOB } from '@/lib/graphql/mutations';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { ArrowLeft, Loader2, Link2, KeyRound, Activity } from 'lucide-react';
import Link from 'next/link';

const JOB_KINDS = [
    { value: 'CROSS_PLATFORM_MIGRATION', label: 'Cross-Platform Migration (e.g. Shopify → Commercetools)' },
    { value: 'PLATFORM_CLONE', label: 'Platform Clone (same platform, different project)' },
    { value: 'EXPORT', label: 'Export (to external format)' },
    { value: 'SCRAPE_IMPORT', label: 'Scrape Import (from URL via browser crawler)' },
];

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

export function NewJobForm() {
    const router = useRouter();
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
        <div className="max-w-2xl animate-in fade-in duration-500">
            <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8">
                <ArrowLeft className="h-4 w-4" /> Back to Jobs
            </Link>

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create New Job</h1>
                <p className="text-slate-400">Configure a pipeline strategy to move or scrape data.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 bg-[#172136] border border-slate-800 rounded-2xl p-8 shadow-2xl">
                
                {/* Pipeline Type Selection */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                        <Activity className="h-4 w-4 text-primary" /> Job Type Strategy
                    </label>
                    <div className="relative">
                        <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value)}
                            className="w-full bg-[#0A101C] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-inner appearance-none cursor-pointer"
                        >
                            {JOB_KINDS.map((jk) => (
                                <option key={jk.value} value={jk.value} className="bg-[#172136]">{jk.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800/60">
                    
                    {/* Source Config */}
                    <div className="space-y-3">
                        {isScrape ? (
                            <>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <Link2 className="h-4 w-4 text-purple-400" /> Web Scraper URL
                                </label>
                                <input
                                    type="url"
                                    required
                                    value={sourceUrl}
                                    onChange={(e) => setSourceUrl(e.target.value)}
                                    placeholder="https://store.example.com"
                                    className="w-full bg-[#0A101C] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 transition-all shadow-inner"
                                />
                                <p className="text-xs text-slate-500">Playwright cluster will perform deep scraping on this root URL.</p>
                            </>
                        ) : (
                            <>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                    <KeyRound className="h-4 w-4 text-amber-400" /> Source Platform
                                </label>
                                <div className="relative">
                                    <select
                                        required
                                        value={sourceCredentialId}
                                        onChange={(e) => setSourceCredentialId(e.target.value)}
                                        className="w-full bg-[#0A101C] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-all shadow-inner appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled className="text-slate-500">Select source credentials…</option>
                                        {credentials.map((c) => (
                                            <option key={c.id} value={c.id} className="bg-[#172136]">
                                                {c.alias} ({c.platform})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Target Config */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            <KeyRound className="h-4 w-4 text-emerald-400" /> Target Platform
                        </label>
                        <div className="relative">
                            <select
                                required
                                value={targetCredentialId}
                                onChange={(e) => setTargetCredentialId(e.target.value)}
                                className="w-full bg-[#0A101C] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 transition-all shadow-inner appearance-none cursor-pointer"
                            >
                                <option value="" disabled className="text-slate-500">Select target credentials…</option>
                                {credentials.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-[#172136]">
                                        {c.alias} ({c.platform})
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                        </div>
                    </div>
                </div>

                {credentials.length === 0 && (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300 flex items-center justify-between">
                        <span>No platform credentials found in your vault.</span>
                        <Link href="/credentials" className="text-white hover:text-blue-200 underline font-medium underline-offset-4 transition-colors">
                            Add Credentials
                        </Link>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="pt-4 border-t border-slate-800/60 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-all glow-btn shadow-[0_0_15px_rgba(79,149,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? 'Orchestrating Pipeline…' : 'Start Job'}
                    </button>
                </div>
            </form>
        </div>
    );
}
