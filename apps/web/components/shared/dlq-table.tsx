'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_DLQ_ITEMS } from '@/lib/graphql/queries/dlq.queries';
import { REPLAY_JOB } from '@/lib/graphql/mutations';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { Loader2, Inbox } from 'lucide-react';

interface DlqItem {
    id: string;
    itemKey: string;
    errorType: string;
    errorMessage: string;
    rawPayload?: string;
    canReplay: boolean;
    replayed: boolean;
}

const ERROR_TYPE_STYLE: Record<string, string> = {
    VALIDATION: 'bg-red-500/10 text-red-500 border border-red-500/20',
    TRANSIENT:  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    FATAL:      'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
};

function ErrorTypeBadge({ type }: { type: string }) {
    return (
        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase ${ERROR_TYPE_STYLE[type] ?? 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
            {type}
        </span>
    );
}

interface DlqTableProps {
    jobId: string;
}

export function DlqTable({ jobId }: DlqTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, loading, error, refetch } = useQuery<{ dlqItems: DlqItem[] }>(GET_DLQ_ITEMS, {
        variables: { jobId },
        skip: !jobId,
    });

    const [replayItem, { loading: replaying }] = useMutation(REPLAY_JOB, {
        refetchQueries: [GET_JOBS],
        onCompleted() { refetch(); },
    });

    const items = data?.dlqItems ?? [];

    if (!jobId) {
        return (
            <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center text-slate-500 text-sm">
                Select a Job ID above to view its failed items.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium tracking-wide">Scanning Dead Letter Queue…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-5 py-4 text-sm text-red-400">
                {error.message}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-[#1A253C] p-4 mb-4 border border-slate-800">
                    <Inbox className="h-6 w-6 text-slate-500" />
                </div>
                <h3 className="font-semibold text-slate-200">DLQ is empty</h3>
                <p className="text-xs text-slate-500 mt-1">This pipeline is completely healthy.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm text-left">
                <thead className="bg-[#1A253C]/50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                    <tr>
                        <th className="px-5 py-4 font-semibold">Item Key</th>
                        <th className="px-5 py-4 font-semibold">Error Type</th>
                        <th className="px-5 py-4 font-semibold">Error Message</th>
                        <th className="px-5 py-4 font-semibold text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {items.map((item) => (
                        <React.Fragment key={item.id}>
                            <tr className="hover:bg-slate-800/20 transition-colors group">
                                <td className="px-5 py-4 font-mono text-xs text-slate-300">
                                    {item.itemKey}
                                </td>
                                <td className="px-5 py-4">
                                    <ErrorTypeBadge type={item.errorType} />
                                </td>
                                <td className="px-5 py-4 text-slate-400 text-sm max-w-[20rem] truncate">
                                    {item.errorMessage}
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                            className="text-xs font-semibold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
                                        >
                                            {expandedId === item.id ? 'Close' : 'Details'}
                                        </button>

                                        <button
                                            disabled={replaying || !item.canReplay || item.replayed}
                                            onClick={() => replayItem({ variables: { jobId, dlqItemId: item.id } })}
                                            title={item.replayed ? 'Already replayed' : !item.canReplay ? 'Not replayable (VALIDATION error)' : 'Replay item'}
                                            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-[#172136] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            {replaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.replayed ? 'Replayed' : 'Replay'}
                                        </button>
                                    </div>
                                </td>
                            </tr>

                            {/* Expanded detail row */}
                            {expandedId === item.id && (
                                <tr className="bg-[#0A101C]/50 border-t border-b border-slate-800">
                                    <td colSpan={4} className="px-5 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-800 to-transparent" />

                                            <div>
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Error Detail</p>
                                                <p className="text-sm text-red-300 font-mono whitespace-pre-wrap bg-red-500/5 rounded-lg p-3 border border-red-500/10 leading-relaxed">
                                                    {item.errorMessage}
                                                </p>
                                            </div>

                                            {item.rawPayload && (
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Raw Payload</p>
                                                    <pre className="text-xs text-slate-300 bg-[#0F1626] rounded-lg p-3 border border-slate-800 overflow-auto max-h-48 font-mono shadow-inner shadow-black/50">
                                                        {item.rawPayload}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
