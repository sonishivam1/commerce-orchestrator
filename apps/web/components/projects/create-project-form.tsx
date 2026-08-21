'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { CREATE_MIGRATION_PROJECT } from '@/lib/graphql/mutations';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';
import {
    ChevronLeft,
    Loader2,
    FolderKanban,
    CheckSquare,
    Square,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALL_ENTITY_TYPES = ['CATEGORIES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS'];

const ENTITY_DESC: Record<string, string> = {
    CATEGORIES: 'Product collections and categories',
    PRODUCTS:   'Products, variants, and pricing',
    CUSTOMERS:  'Customer accounts and addresses',
    ORDERS:     'Orders and line items',
};

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'border-purple-500/30 bg-purple-500/8  text-purple-300',
    PRODUCTS:   'border-blue-500/30   bg-blue-500/8    text-blue-300',
    CUSTOMERS:  'border-cyan-500/30   bg-cyan-500/8    text-cyan-300',
    ORDERS:     'border-amber-500/30  bg-amber-500/8   text-amber-300',
};

function CredentialOption({ credential, selected, onSelect }: {
    credential: Credential;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                selected
                    ? 'border-primary/40 bg-primary/8'
                    : 'border-white/8 bg-white/3 hover:border-white/15'
            }`}
        >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                selected ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-500'
            }`}>
                {credential.platform.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{credential.alias}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{credential.platform.toLowerCase()}</p>
            </div>
            {selected && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-[8px]">✓</span>
                </div>
            )}
        </button>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function CreateProjectForm() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [sourceConnectionId, setSourceConnectionId] = useState('');
    const [targetConnectionId, setTargetConnectionId] = useState('');
    const [entityTypes, setEntityTypes] = useState<string[]>(['CATEGORIES', 'PRODUCTS']);
    const [formError, setFormError] = useState<string | null>(null);

    const { data: credsData, loading: credsLoading } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);
    const credentials = credsData?.credentials ?? [];

    const [createProject, { loading }] = useMutation(CREATE_MIGRATION_PROJECT, {
        refetchQueries: [GET_MIGRATION_PROJECTS],
        onCompleted(data) {
            router.push(`/projects/${data.createMigrationProject.id}`);
        },
        onError(err) {
            setFormError(err.message);
        },
    });

    const toggleEntity = (et: string) => {
        setEntityTypes(prev =>
            prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et],
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!name.trim()) { setFormError('Project name is required.'); return; }
        if (!sourceConnectionId) { setFormError('Source connection is required.'); return; }
        if (!targetConnectionId) { setFormError('Target connection is required.'); return; }
        if (sourceConnectionId === targetConnectionId) {
            setFormError('Source and target connections must be different.');
            return;
        }
        if (entityTypes.length === 0) {
            setFormError('Select at least one entity type.');
            return;
        }

        createProject({
            variables: {
                input: {
                    name: name.trim(),
                    sourceConnectionId,
                    targetConnectionId,
                    entityTypes,
                },
            },
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Back link */}
            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
            >
                <ChevronLeft className="h-4 w-4" /> Back to Projects
            </Link>

            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FolderKanban className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">New Migration Project</h1>
                    <p className="text-sm text-slate-400">Define source, target, and entity scope</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project name */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Project Name
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. CT → Shopify Q3 Launch"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>

                {credsLoading ? (
                    <div className="flex items-center gap-3 py-8 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading connections…</span>
                    </div>
                ) : credentials.length < 2 ? (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5">
                        <p className="text-sm font-semibold text-amber-300">Two connections required</p>
                        <p className="text-xs text-amber-400/70 mt-1">
                            You need at least one source and one target connection.{' '}
                            <Link href="/connections" className="underline hover:text-amber-300">
                                Add connections
                            </Link>
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Source */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Source Connection
                            </label>
                            <div className="space-y-2">
                                {credentials.map(c => (
                                    <CredentialOption
                                        key={c.id}
                                        credential={c}
                                        selected={sourceConnectionId === c.id}
                                        onSelect={() => setSourceConnectionId(c.id)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Target */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Target Connection
                            </label>
                            <div className="space-y-2">
                                {credentials.map(c => (
                                    <CredentialOption
                                        key={c.id}
                                        credential={c}
                                        selected={targetConnectionId === c.id}
                                        onSelect={() => setTargetConnectionId(c.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Entity Types */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Entity Types to Migrate
                    </label>
                    <p className="text-[11px] text-slate-600">
                        The wave executor enforces dependency order: Categories → Products → Customers → Orders
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {ALL_ENTITY_TYPES.map(et => {
                            const selected = entityTypes.includes(et);
                            return (
                                <button
                                    key={et}
                                    type="button"
                                    onClick={() => toggleEntity(et)}
                                    className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left cursor-pointer ${
                                        selected
                                            ? ENTITY_COLOR[et]
                                            : 'border-white/8 bg-white/3 hover:border-white/15 text-slate-400'
                                    }`}
                                >
                                    {selected
                                        ? <CheckSquare className="h-4 w-4 shrink-0 mt-0.5" />
                                        : <Square className="h-4 w-4 shrink-0 mt-0.5 opacity-40" />
                                    }
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider">{et}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{ENTITY_DESC[et]}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {formError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                        {formError}
                    </p>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                    <Link
                        href="/projects"
                        className="flex-1 flex items-center justify-center bg-white/5 border border-white/8 text-slate-300 font-medium py-3 rounded-xl text-sm hover:bg-white/8 transition-all"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={loading || credentials.length < 2}
                        className="flex-[2] bg-primary hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                        ) : (
                            'Create Project'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
