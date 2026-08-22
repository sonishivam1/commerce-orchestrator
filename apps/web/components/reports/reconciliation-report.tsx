'use client';

import { useQuery } from '@apollo/client';
import { GET_RECONCILIATION_REPORT } from '@/lib/graphql/queries/migration-project.queries';
import { GET_MIGRATION_RUN } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';
import {
    ChevronLeft,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    BarChart3,
    Calendar,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface EntitySummary {
    entityType: string;
    sourceCount: number;
    migratedCount: number;
    createdCount: number;
    updatedCount: number;
    failedCount: number;
    missingRefCount: number;
}

interface ReconciliationReport {
    id: string;
    migrationRunId: string;
    migrationProjectId: string;
    generatedAt: string;
    overallSuccessRate: number;
    entitySummaries: EntitySummary[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

const ENTITY_COLOR: Record<string, string> = {
    CATEGORIES: 'text-purple-400',
    PRODUCTS:   'text-blue-400',
    CUSTOMERS:  'text-cyan-400',
    ORDERS:     'text-amber-400',
};

function ScoreRing({ pct }: { pct: number }) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color =
        pct >= 95 ? '#10b981' :
        pct >= 80 ? '#f59e0b' :
        '#ef4444';

    return (
        <div className="flex flex-col items-center gap-2">
            <svg width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                    cx="64" cy="64" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    transform="rotate(-90 64 64)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text x="64" y="58" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="IBM Plex Mono, monospace">
                    {pct.toFixed(1)}%
                </text>
                <text x="64" y="76" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600" fontFamily="Space Grotesk, sans-serif">
                    SUCCESS RATE
                </text>
            </svg>
        </div>
    );
}

function EntityRow({ summary }: { summary: EntitySummary }) {
    const successRate = summary.sourceCount > 0
        ? ((summary.migratedCount / summary.sourceCount) * 100).toFixed(1)
        : '—';

    return (
        <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="py-3 px-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', ENTITY_COLOR[summary.entityType] ?? 'text-slate-400')}>
                    {summary.entityType}
                </span>
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">
                {summary.sourceCount.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs text-emerald-400">
                {summary.migratedCount.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs text-blue-400">
                {summary.createdCount.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs text-cyan-400">
                {summary.updatedCount.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs">
                <span className={summary.failedCount > 0 ? 'text-red-400' : 'text-slate-600'}>
                    {summary.failedCount.toLocaleString()}
                </span>
            </td>
            <td className="py-3 px-4 text-right font-mono text-xs">
                <span className={summary.missingRefCount > 0 ? 'text-amber-400' : 'text-slate-600'}>
                    {summary.missingRefCount.toLocaleString()}
                </span>
            </td>
            <td className="py-3 px-4 text-right">
                <span className={cn(
                    'text-[10px] font-semibold font-mono',
                    parseFloat(successRate) >= 95 ? 'text-emerald-400' :
                    parseFloat(successRate) >= 80 ? 'text-amber-400'   :
                    'text-red-400',
                )}>
                    {successRate}{successRate !== '—' ? '%' : ''}
                </span>
            </td>
        </tr>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReconciliationReport({ migrationRunId }: { migrationRunId: string }) {
    const { data: reportData, loading: reportLoading } = useQuery<{
        reconciliationReport: ReconciliationReport;
    }>(GET_RECONCILIATION_REPORT, { variables: { migrationRunId } });

    const { data: runData } = useQuery(GET_MIGRATION_RUN, {
        variables: { id: migrationRunId },
    });

    const report = reportData?.reconciliationReport;
    const run = runData?.migrationRun;

    if (reportLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
                <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                    <BarChart3 className="h-8 w-8 text-slate-500" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-white">No report available</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {run?.status === 'RUNNING' || run?.status === 'PENDING'
                            ? 'The migration is still in progress. The report will appear here when it completes.'
                            : 'A reconciliation report is generated automatically when a migration run completes successfully.'}
                    </p>
                </div>
                <Link
                    href={`/runs/${migrationRunId}`}
                    className="text-primary text-sm hover:underline"
                >
                    Back to Run
                </Link>
            </div>
        );
    }

    const generatedAt = new Date(report.generatedAt).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const hasIssues = report.entitySummaries.some(
        s => s.failedCount > 0 || s.missingRefCount > 0,
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
            {/* Back */}
            <Link
                href={`/runs/${migrationRunId}`}
                className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
            >
                <ChevronLeft className="h-4 w-4" /> Back to Run
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Reconciliation Report</h1>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        Generated {generatedAt}
                    </div>
                </div>
            </div>

            {/* Score + summary */}
            <div className="bg-[#131B2C]/70 border border-white/8 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
                <ScoreRing pct={report.overallSuccessRate} />

                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        {report.overallSuccessRate >= 95 ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                        )}
                        <div>
                            <p className="text-base font-semibold text-white">
                                {report.overallSuccessRate >= 95
                                    ? 'Migration completed successfully'
                                    : 'Migration completed with issues'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {report.entitySummaries.reduce((acc, s) => acc + s.migratedCount, 0).toLocaleString()} records
                                migrated across {report.entitySummaries.length} entity types
                            </p>
                        </div>
                    </div>

                    {/* Per-entity mini stats */}
                    <div className="grid grid-cols-2 gap-2">
                        {report.entitySummaries.map(s => (
                            <div key={s.entityType} className="flex items-center gap-2 text-[10px]">
                                <span className={cn('font-semibold uppercase', ENTITY_COLOR[s.entityType] ?? 'text-slate-400')}>
                                    {s.entityType}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span className="text-emerald-400 font-mono">{s.migratedCount}</span>
                                {s.failedCount > 0 && (
                                    <span className="text-red-400 font-mono">/ {s.failedCount} failed</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detail table */}
            <div className="bg-[#131B2C]/60 border border-white/8 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                    <h2 className="text-sm font-semibold text-white">Entity Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
                                {['Entity', 'Source', 'Migrated', 'Created', 'Updated', 'Failed', 'Missing Refs', 'Rate'].map(h => (
                                    <th key={h} className="py-3 px-4 text-right first:text-left font-semibold">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {report.entitySummaries.map(s => (
                                <EntityRow key={s.entityType} summary={s} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Issues callout */}
            {hasIssues && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-5 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-300">Some items require attention</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Failed records are available in the Dead Letter Queue for inspection and replay.
                        </p>
                        <Link href="/dlq" className="text-primary text-xs hover:underline mt-2 inline-block">
                            View Dead Letter Queue →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
