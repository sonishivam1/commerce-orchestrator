'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
    Shield,
    User,
    Users,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Database,
    Cpu,
    Lock,
} from 'lucide-react';
import { GET_ME, GET_ORG_MEMBERS } from '@/lib/graphql/queries/tenant.queries';
import { ADD_ORG_MEMBER, SET_MEMBER_ACTIVE } from '@/lib/graphql/mutations';

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'OWNER' | 'MEMBER';
    status: string;
    createdAt: string;
}

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

/* ─── Members (organization users) ──────────────────────────── */
function MembersSection({ myRole }: { myRole?: string }) {
    const { data, loading } = useQuery<{ organizationMembers: Member[] }>(GET_ORG_MEMBERS);
    const members = data?.organizationMembers ?? [];
    const isOwner = myRole === 'OWNER';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const [addMember, { loading: adding }] = useMutation(ADD_ORG_MEMBER, {
        refetchQueries: [GET_ORG_MEMBERS],
        onCompleted() { setName(''); setEmail(''); setPassword(''); setFormError(null); },
        onError(e) { setFormError(e.message); },
    });
    const [setActive] = useMutation(SET_MEMBER_ACTIVE, { refetchQueries: [GET_ORG_MEMBERS] });

    return (
        <SectionCard title="Members" subtitle="People in your organization" icon={Users}>
            {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>Loading…</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {members.map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ fontSize: 14, color: 'var(--text-light)', fontWeight: 500 }}>
                                    {m.name} {m.status === 'disabled' && <span style={{ color: 'var(--text-muted)' }}>(disabled)</span>}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.email} · {m.role}</div>
                            </div>
                            {isOwner && m.role !== 'OWNER' && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setActive({ variables: { userId: m.id, active: m.status !== 'active' } })}
                                >
                                    {m.status === 'active' ? 'Disable' : 'Enable'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isOwner && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addMember({ variables: { input: { name, email, password } } });
                    }}
                    style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Add a member
                    </div>
                    <input className="form-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <input className="form-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input className="form-input" type="password" placeholder="Temporary password (min 8)" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    {formError && <div style={{ color: 'var(--error)', fontSize: 12 }}>{formError}</div>}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                        {adding ? 'Adding…' : 'Add member'}
                    </button>
                </form>
            )}
        </SectionCard>
    );
}

/* ─── Main Settings Page ────────────────────────────────────── */
export default function SettingsPage() {
    const { data: meData, loading: meLoading } = useQuery<{
        me: { id: string; name: string; email: string; role: string };
    }>(GET_ME);

    const me = meData?.me;

    return (
        <div className="view active" id="view-settings">
            <div className="section-header">
                <div>
                    <div className="section-title">Settings</div>
                    <div className="section-sub">Account information and system configuration</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                {/* Account */}
                <SectionCard title="Account" subtitle="Your user profile" icon={User}>
                    {meLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} />
                            <span style={{ fontSize: '14px' }}>Loading account…</span>
                        </div>
                    ) : (
                        <div>
                            <InfoRow label="Name" value={me?.name} />
                            <InfoRow label="Email" value={me?.email} />
                            <InfoRow label="Role" value={me?.role} />
                        </div>
                    )}
                </SectionCard>

                {/* Members */}
                <MembersSection myRole={me?.role} />

                {/* Security */}
                <SectionCard title="Security" subtitle="Encryption and isolation configuration" icon={Lock}>
                    <div>
                        <InfoRow label="Credential Encryption" value="AES-256-GCM" />
                        <InfoRow label="Token Type" value="JWT" />
                        <InfoRow label="Organization Isolation" value="Enforced per query" />
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
                        <InfoRow label="Retries" value="Exponential backoff, max 5" />
                        <InfoRow label="Dry run" value="Skips target writes / file output" />
                        <InfoRow label="Run Queue" value="QUEUE_ETL" />
                    </div>
                </SectionCard>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', paddingTop: '32px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: '32px' }}>
                <Shield style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                    AES-256-GCM · JWT organization isolation
                </span>
            </div>
        </div>
    );
}
