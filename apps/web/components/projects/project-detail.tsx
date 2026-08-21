'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_MIGRATION_PROJECT,
    GET_MIGRATION_RUNS,
} from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { CREATE_MIGRATION_RUN } from '@/lib/graphql/mutations';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Loader2,
    Play,
    FolderKanban,
    ArrowRight,
    Calendar,
    Layers,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    FlaskConical,
    RotateCcw,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface WaveRecord {
    entityType: string;
    status: string;
    processedCount: number;
    failedCount: number;
    startedAt?: string;
    completedAt?: string;
}

interface MigrationRun {
    id: string;
    migrationProjectId: string;
    status: string;
    dryRun: boolean;
    processedCount: number;
    failedCount: number;
    waves: WaveRecord[];
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

interface MigrationProject {
    id: string;
    name: string;
    sourceConnectionId: string;
    targetConnectionId: string;
    entityTypes: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
}

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const RUN_STATUS: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    PENDING:   { bg: 'bg-slate-700/30',   text: 'text-slate-400',   border: 'border-slate-600/20', icon: <Clock className="h-3 w-3" />     },
    RUNNING:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',  icon: <Zap className="h-3 w-3" />       },
    COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
    FAILED:    { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20',   icon: <XCircle className="h-3 w-3" />   },
    CANCELLED: { bg: 'bg-slate-800/50',   text: 'text-slate-500',   border: 'border-slate-700/20', icon: <XCircle className="h-3 w-3" />   },
};

function RunStatusBadge({ status }: { status: string }) {
    const s = RUN_STATUS[status] ?? RUN_STATUS.PENDING;
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border',
            s.bg, s.text, s.border,
        )}>
            {s.icon} {status}
        </span>
    );
}

function RunRow({ run }: { run: MigrationRun }) {
    const createdDate = new Date(run.createdAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const completedWaves = run.waves.filter(w => w.status === 'COMPLETED').length;

    return (
        <div className="group bg-[#131B2C]/60 border border-white/5 hover:border-white/12 rounded-xl p-4 flex items-center gap-4 transition-all duration-200">
            {/* Status */}
            <RunStatusBadge status={run.status} />

            {/* Meta */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">{run.id.slice(0, 8)}…</span>
                    {run.dryRun && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                            <FlaskConical className="h-2.5 w-2.5" /> Dry Run
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-600">
                    <span>{createdDate}</span>
                    <span>·</span>
                    <span>{completedWaves}/{run.waves.length} waves</span>
                    <span>·</span>
                    <span className="text-emerald-600">{run.processedCount} processed</span>
                    {run.failedCount > 0 && (
                        <><span>·</span><span className="text-red-500">{run.failedCount} failed</span></>
                    )}
                </div>
            </div>

            {/* Actions */}
            <Link
                href={`/runs/${run.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-300 text-xs font-medium hover:bg-white/10 transition-all"
            >
                View <ArrowRight className="h-3 w-3" />
            </Link>
        </div>
    );
}

// ── Start Run Modal ───────────────────────────────────────────────────────────

function StartRunModal({
    projectId,
    onClose,
}: {
    projectId: string;
    onClose: () => void;
}) {
    const router = useRouter();
    const [dryRun, setDryRun] = useState(false);
    const [resumeFromRunId, setResumeFromRunId] = useState('');

    const [createRun, { loading, error }] = useMutation(CREATE_MIGRATION_RUN, {
        refetchQueries: [{ query: GET_MIGRATION_RUNS, variables: { migrationProjectId: projectId } }],
        onCompleted(data) {
            router.push(`/runs/${data.createMigrationRun.id}`);
        },
    });

    const handleStart = () => {
        createRun({
            variables: {
                input: {
                    migrationProjectId: projectId,
                    dryRun,
                    ...(resumeFromRunId.trim() ? { resumeFromRunId: resumeFromRunId.trim() } : {}),
                },
            },
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
            <div className="w-full max-w-md bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                    <div>
                        <h2 className="text-base font-semibold text-white">Start Migration Run</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Wave-based execution: Categories → Products → Customers → Orders
                        </p>
                    </div>
                    <button onClick={onClose} className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer">
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Dry run toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8">
                        <div className="flex items-center gap-3">
                            <FlaskConical className="h-4 w-4 text-amber-400" />
                            <div>
                                <p className="text-sm font-medium text-white">Dry Run</p>
                                <p className="text-[10px] text-slate-500">Extract and validate only — no writes to target</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDryRun(p => !p)}
                            className={cn(
                                'h-6 w-11 rounded-full transition-all cursor-pointer relative',
                                dryRun ? 'bg-amber-500' : 'bg-slate-700',
                            )}
                        >
                            <div className={cn(
                                'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all',
                                dryRun ? 'left-6' : 'left-1',
                            )} />
                        </button>
                    </div>

                    {/* Resume from run */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <RotateCcw className="h-3 w-3" /> Resume from Run ID (optional)
                        </label>
                        <input
                            type="text"
                            value={resumeFromRunId}
                            onChange={e => setResumeFromRunId(e.target.value)}
                            placeholder="Previous run ID to resume from…"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                        />
                        <p className="text-[10px] text-slate-600">
                            When set, inherits wave cursors from the referenced run for incremental migration.
                        </p>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                            {error.message}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-white/5 border border-white/8 text-slate-300 font-medium py-3 rounded-xl text-sm hover:bg-white/8 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStart}
                            disabled={loading}
                            className="flex-[2] bg-primary hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-60"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
                            ) : (
                                <><Play className="h-4 w-4" /> {dryRun ? 'Start Dry Run' : 'Start Migration'}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ProjectDetail({ projectId }: { projectId: string }) {
    const [showStartRun, setShowStartRun] = useState(false);

    const { data: projectData, loading: projectLoading } = useQuery<{
        migrationProject: MigrationProject;
    }>(GET_MIGRATION_PROJECT, { variables: { id: projectId } });

    const { data: runsData, loading: runsLoading } = useQuery<{
        migrationRuns: MigrationRun[];
    }>(GET_MIGRATION_RUNS, {
        variables: { migrationProjectId: projectId },
        pollInterval: 8000,
    });

    const { data: credsData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const project = projectData?.migrationProject;
    const runs = runsData?.migrationRuns ?? [];
    const credentials = credsData?.credentials ?? [];

    const findCred = (id: string) => credentials.find(c => c.id === id);

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <p className="text-white font-semibold">Project not found</p>
                <Link href="/projects" className="text-primary text-sm hover:underline">
                    Back to Projects
                </Link>
            </div>
        );
    }

    const sourceCred = findCred(project.sourceConnectionId);
    const targetCred = findCred(project.targetConnectionId);
    const activeRun = runs.find(r => r.status === 'RUNNING' || r.status === 'PENDING');

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Back */}
            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
            >
                <ChevronLeft className="h-4 w-4" /> Back to Projects
            </Link>

            {/* Project header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <FolderKanban className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border',
                                project.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-slate-700/30 text-slate-400 border-slate-600/20',
                            )}>
                                {project.status}
                            </span>
                            <span className="text-[10px] text-slate-600">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                Created {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                {project.status !== 'ARCHIVED' && (
                    <button
                        onClick={() => setShowStartRun(true)}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-primary/20 cursor-pointer"
                        disabled={!!activeRun}
                        title={activeRun ? 'A run is already in progress' : undefined}
                    >
                        <Play className="h-4 w-4" />
                        {activeRun ? 'Run in Progress' : 'Start Run'}
                    </button>
                )}
            </div>

            {/* Connection info */}
            <div className="grid grid-cols-2 gap-5">
                {[
                    { label: 'Source', cred: sourceCred },
                    { label: 'Target', cred: targetCred },
                ].map(({ label, cred }) => (
                    <div key={label} className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-5">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
                        {cred ? (
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {cred.platform.slice(0, 2)}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{cred.alias}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{cred.platform.toLowerCase()}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 font-mono">{label === 'Source' ? project.sourceConnectionId : project.targetConnectionId}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Entity types */}
            <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl p-5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    <Layers className="h-3 w-3 inline mr-1.5" />Entity Scope
                </p>
                <div className="flex flex-wrap gap-2">
                    {project.entityTypes.map(et => (
                        <span
                            key={et}
                            className="inline-flex items-center px-3 py-1 rounded-lg bg-white/5 border border-white/8 text-xs font-medium text-slate-300"
                        >
                            {et}
                        </span>
                    ))}
                </div>
            </div>

            {/* Runs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">Migration Runs</h2>
                    {runsLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                </div>

                {runs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/8 rounded-xl gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                            <Play className="h-6 w-6 text-slate-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-300">No runs yet</p>
                            <p className="text-xs text-slate-600 mt-1">Start a migration run to transfer data</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {runs.map(run => <RunRow key={run.id} run={run} />)}
                    </div>
                )}
            </div>

            {showStartRun && (
                <StartRunModal projectId={projectId} onClose={() => setShowStartRun(false)} />
            )}
        </div>
    );
}
