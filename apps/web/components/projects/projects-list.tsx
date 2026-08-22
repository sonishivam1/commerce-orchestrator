'use client';

import { useQuery } from '@apollo/client';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';
import { Plus } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

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
    alias: string;
    platform: string;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ProjectsList() {
    const { data: projectsData, loading: projectsLoading, error: projectsError } = useQuery<{ migrationProjects: MigrationProject[] }>(
        GET_MIGRATION_PROJECTS,
        { pollInterval: 10000 },
    );
    const { data: credsData } = useQuery<{ credentials: Credential[] }>(GET_CREDENTIALS);

    const projects = projectsData?.migrationProjects ?? [];
    const credentials = credsData?.credentials ?? [];
    // Map id → { alias, platform } so Source/Target columns show both
    const credMap = Object.fromEntries(
        credentials.map(c => [c.id, { alias: c.alias, platform: c.platform }]),
    );

    return (
        <div className="view">
            <div className="table-header">
                <h2>Migration Projects</h2>
                <Link href="/projects/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} />
                    New Project
                </Link>
            </div>

            {projectsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading projects...</div>
            ) : projectsError ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--status-failed)' }}>Error: {projectsError.message}</div>
            ) : projects.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found. Create one to get started.</div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Source</th>
                                <th>Target</th>
                                <th>Schedule</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(project => {
                                const sourceCred = credMap[project.sourceConnectionId];
                                const targetCred = credMap[project.targetConnectionId];
                                const sourceName = sourceCred
                                    ? `${sourceCred.platform} — ${sourceCred.alias}`
                                    : project.sourceConnectionId;
                                const targetName = targetCred
                                    ? `${targetCred.platform} — ${targetCred.alias}`
                                    : project.targetConnectionId;
                                
                                const statusClass = project.status === 'ACTIVE' ? 'status-completed' : project.status === 'ARCHIVED' ? 'status-failed' : 'status-pending';
                                
                                return (
                                    <tr key={project.id}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{project.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {project.id}</div>
                                        </td>
                                        <td>{sourceName}</td>
                                        <td>{targetName}</td>
                                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--bg-highlight)', padding: '2px 6px', borderRadius: '4px' }}>Manual</span></td>
                                        <td><span className={`status-badge ${statusClass}`}>{project.status}</span></td>
                                        <td>
                                            <Link href={`/projects/${project.id}`} className="btn btn-ghost btn-sm">View</Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
