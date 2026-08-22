'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import {
    Shield,
    User,
    ChevronDown,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Database,
    Cpu,
    Lock,
} from 'lucide-react';
import { GET_ME } from '@/lib/graphql/queries/tenant.queries';

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Section Card ─────────────────────────────────────────── */
function SectionCard({
    title,
    subtitle,
    icon: Icon,
    children,
}: {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <Icon style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
                </div>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-light)' }}>{title}</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

/* ─── Info Row ──────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string | undefined }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }} className="last:border-0">
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: '500', fontFamily: 'var(--font-data)' }}>
                {value ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
            </span>
        </div>
    );
}

/* ─── Health Row ────────────────────────────────────────────── */
function HealthRow({
    label,
    status,
    detail,
}: {
    label: string;
    status: 'ok' | 'error' | 'loading';
    detail?: string;
}) {
    const statusColor = status === 'ok' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--text-muted)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }} className="last:border-0">
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {status === 'loading' && <Loader2 style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} className="animate-spin" />}
                {status === 'ok' && <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--success)' }} />}
                {status === 'error' && <AlertCircle style={{ width: '16px', height: '16px', color: 'var(--error)' }} />}
                <span style={{ fontSize: '14px', fontWeight: '500', color: statusColor }}>
                    {status === 'loading' ? 'Checking…' : detail ?? (status === 'ok' ? 'Connected' : 'Unavailable')}
                </span>
            </div>
        </div>
    );
}

/* ─── Live Health — fetches real /health endpoint ───────────── */
function LiveHealth() {
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [detail, setDetail] = useState<string | undefined>();

    useEffect(() => {
        const apiBase =
            (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql').replace('/graphql', '');
        fetch(`${apiBase}/health`)
            .then((r) => r.json())
            .then((body: { status?: string; message?: string }) => {
                if (body?.status === 'ok') {
                    setStatus('ok');
                    setDetail('All checks passed');
                } else {
                    setStatus('error');
                    setDetail(body?.message ?? 'Health check failed');
                }
            })
            .catch(() => {
                setStatus('error');
                setDetail('API unreachable');
            });
    }, []);

    return (
        <div>
            <HealthRow label="MongoDB" status={status} detail={status === 'ok' ? 'Connected' : detail} />
            <HealthRow label="API Server" status={status} detail={status === 'ok' ? 'Reachable' : detail} />
        </div>
    );
}

/* ─── Main Settings Page ────────────────────────────────────── */
export default function SettingsPage() {
    const { data: meData, loading: meLoading } = useQuery<{
        me: { id: string; name: string; email: string };
    }>(GET_ME);

    const me = meData?.me;

    return (
        <div className="view" id="view-settings">
            <div className="section-header">
                <div>
                    <div className="section-title">Settings</div>
                    <div className="section-sub">Account information and system configuration</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                {/* Account */}
                <SectionCard title="Account" subtitle="Your tenant profile" icon={User}>
                    {meLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                            <span style={{ fontSize: '14px' }}>Loading account…</span>
                        </div>
                    ) : (
                        <div>
                            <InfoRow label="Tenant ID" value={me?.id} />
                            <InfoRow label="Name" value={me?.name} />
                            <InfoRow label="Email" value={me?.email} />
                        </div>
                    )}
                </SectionCard>

                {/* Security */}
                <SectionCard title="Security" subtitle="Encryption and isolation configuration" icon={Lock}>
                    <div>
                        <InfoRow label="Credential Encryption" value="AES-256-GCM" />
                        <InfoRow label="Token Type" value="JWT" />
                        <InfoRow label="Tenant Isolation" value="Enforced per query" />
                        <InfoRow label="Distributed Lock Key" value="lock:{tenantId}:{credentialId}" />
                    </div>
                </SectionCard>

                {/* Infrastructure — live from /health */}
                <SectionCard title="Infrastructure" subtitle="Live status from the API health endpoint" icon={Database}>
                    <LiveHealth />
                </SectionCard>

                {/* Pipeline constants */}
                <SectionCard title="Pipeline Defaults" subtitle="ETL engine configuration" icon={Cpu}>
                    <div>
                        <InfoRow label="Batch Size" value="50 items" />
                        <InfoRow label="Circuit Breaker Threshold" value="10 consecutive failures" />
                        <InfoRow label="DryRun" value="Enabled — skips target writes only" />
                        <InfoRow label="ETL Queue" value="QUEUE_ETL" />
                        <InfoRow label="Scrape Queue" value="QUEUE_SCRAPE" />
                    </div>
                </SectionCard>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', paddingTop: '32px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: '32px' }}>
                <Shield style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                    AES-256-GCM · JWT tenant isolation · Redlock distributed locking
                </span>
            </div>
        </div>
    );
}
