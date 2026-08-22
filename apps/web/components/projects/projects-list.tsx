'use client';

import { useQuery } from '@apollo/client';
import { GET_MIGRATION_PROJECTS } from '@/lib/graphql/queries/migration-project.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';

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

function getPlatformIcon(platform: string) {
    if (platform === 'SHOPIFY') return '🛒';
    if (platform === 'COMMERCETOOLS') return '📋';
    if (platform === 'BIGCOMMERCE') return '🛠️';
    return '🔌';
}

function getEntityTagClass(type: string) {
    switch (type) {
        case 'CATEGORY': return 'tag-cat';
        case 'PRODUCT': return 'tag-prod';
        case 'CUSTOMER': return 'tag-cust';
        case 'ORDER': return 'tag-ord';
        default: return 'tag-inv';
    }
}

function formatEntityName(type: string) {
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() + 's';
}

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
        <div className="view active" id="view-projects">
            <div className="section-header">
                <div>
                    <div className="section-title">Migration Projects</div>
                    <div className="section-sub">Persistent migration configurations between connections</div>
                </div>
                <Link href="/projects/new" className="btn btn-primary btn-sm">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
                    New Project
                </Link>
            </div>

            {projectsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading projects...</div>
            ) : projectsError ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--error)' }}>Error: {projectsError.message}</div>
            ) : projects.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found. Create one to get started.</div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="proj-table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Entities</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Records</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(project => {
                                const sourceCred = credMap[project.sourceConnectionId];
                                const targetCred = credMap[project.targetConnectionId];
                                
                                const sourceIcon = sourceCred ? getPlatformIcon(sourceCred.platform) : '🔌';
                                const targetIcon = targetCred ? getPlatformIcon(targetCred.platform) : '🔌';
                                
                                const sourceName = sourceCred ? sourceCred.alias : project.sourceConnectionId;
                                const targetName = targetCred ? targetCred.alias : project.targetConnectionId;
                                
                                const isArchived = project.status === 'ARCHIVED';
                                const isActive = project.status === 'ACTIVE';
                                
                                return (
                                    <tr key={project.id}>
                                        <td>
                                            <div className="proj-flow">
                                                <span>{sourceIcon} {sourceName}</span>
                                                <span className="proj-arrow">→</span>
                                                <span>{targetIcon} {targetName}</span>
                                            </div>
                                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                                {project.name}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="entity-tags">
                                                {project.entityTypes.map(t => (
                                                    <span key={t} className={`entity-tag ${getEntityTagClass(t)}`}>
                                                        {formatEntityName(t)}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            {isActive ? (
                                                <span className="pill pill-success">Active</span>
                                            ) : isArchived ? (
                                                <span className="pill pill-muted">Archived</span>
                                            ) : (
                                                <span className="pill pill-warning">Draft</span>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {new Date(project.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                                        </td>
                                        <td>
                                            <Link href={`/projects/${project.id}`} className="btn btn-ghost btn-sm">View ›</Link>
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
