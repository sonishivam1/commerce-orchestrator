'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import { CREATE_MIGRATION_PROJECT } from '@/lib/graphql/mutations';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface Credential {
    id: string;
    platform: string;
    alias: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALL_ENTITY_TYPES = ['CATEGORIES', 'PRODUCTS', 'CUSTOMERS', 'ORDERS'];

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
        <div className="view active">
            <div className="table-header">
                <h2>New Migration Project</h2>
                <Link href="/projects" className="btn btn-ghost" style={{ fontSize: '0.875rem' }}>
                    Cancel
                </Link>
            </div>

            <form onSubmit={handleSubmit} style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                    <label className="form-label">Project Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. CT → Shopify Q3 Launch"
                        className="form-input"
                    />
                </div>

                {credsLoading ? (
                    <div style={{ color: 'var(--text-muted)' }}>Loading connections...</div>
                ) : credentials.length < 2 ? (
                    <div style={{ color: 'var(--status-failed)' }}>
                        You need at least two connections to create a project.{' '}
                        <Link href="/connections" style={{ textDecoration: 'underline' }}>
                            Add connections
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="form-group">
                            <label className="form-label">Source Connection</label>
                            <select
                                value={sourceConnectionId}
                                onChange={e => setSourceConnectionId(e.target.value)}
                                className="form-select"
                                required
                            >
                                <option value="" disabled>Select a source connection...</option>
                                {credentials.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.alias} ({c.platform})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Target Connection</label>
                            <select
                                value={targetConnectionId}
                                onChange={e => setTargetConnectionId(e.target.value)}
                                className="form-select"
                                required
                            >
                                <option value="" disabled>Select a target connection...</option>
                                {credentials.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.alias} ({c.platform})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label className="form-label">Entity Types to Migrate</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {ALL_ENTITY_TYPES.map(et => {
                            const selected = entityTypes.includes(et);
                            return (
                                <button
                                    key={et}
                                    type="button"
                                    onClick={() => toggleEntity(et)}
                                    className={`btn ${selected ? 'btn-primary' : 'btn-ghost'}`}
                                >
                                    {et}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {formError && (
                    <div style={{ color: 'var(--status-failed)', fontSize: '0.875rem' }}>
                        {formError}
                    </div>
                )}

                <div style={{ marginTop: '20px' }}>
                    <button
                        type="submit"
                        disabled={loading || credentials.length < 2}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        {loading ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </form>
        </div>
    );
}
